# Research: Youth Sports Roster Management

## Decision 1: .NET Kafka Client

**Decision**: Confluent.Kafka (direct client)

**Rationale**: The startup aggregate-replay pattern requires precise control over
consumer offset assignment and watermark detection — specifically: manually assign all
partitions, seek to offset 0, consume to the high-watermark offset recorded at replay
start, then switch to live consumption. Confluent.Kafka exposes `Assign()`,
`QueryWatermarkOffsets()`, and `Consume()` directly. MassTransit and other higher-level
abstractions hide these primitives behind opinionated consumer pipelines, making the
replay-then-live pattern difficult or impossible to implement cleanly.

**Alternatives considered**:
- **MassTransit**: Excellent for service-bus-style messaging, but its consumer lifecycle
  management is not designed for "read-to-watermark then continue" patterns. Abstraction
  is too high.
- **KafkaFlow**: Another abstraction layer with similar limitations for low-level offset
  control. Better suited for high-throughput stream processing pipelines.

---

## Decision 2: In-Memory Aggregate Replay Pattern

**Decision**: `AggregateReplayService : BackgroundService` (IHostedService) with a
shared `CancellationTokenSource`-based readiness flag consumed by an `IHealthCheck`.

**Rationale**: `BackgroundService` is the idiomatic .NET pattern for long-running startup
work. The key insight for ECS readiness: ASP.NET Core's hosted services start and run
concurrently with Kestrel by default (as of .NET 6). This means Kestrel begins listening
while replay runs — but the ALB health check targets `GET /health`, which returns `503`
until the `AggregateReadinessCheck` flips to healthy. ECS will not route traffic until
the health check passes, giving the container effectively unlimited time to replay.

**Startup sequence**:
1. `BackgroundService.StartAsync` is called → begins Redpanda consumer.
2. Consumer reads from `auto.offset.reset = earliest` to the watermark offsets sampled
   at replay start (to avoid an infinite loop on a live topic).
3. Each consumed event is applied to `InMemoryStore.Apply()`.
4. On catching up: set `_replayCompleted = true`; switch to live-consumption loop.
5. `AggregateReadinessCheck.CheckHealthAsync` returns `Healthy` once `_replayCompleted`.
6. ALB marks the task healthy; traffic begins.

**Important**: the consumer used during replay runs with a unique consumer group ID
(`replay-{instanceId}`) so it does not interfere with any future live-consumer group
and always reads from the beginning regardless of committed offsets.

**Alternatives considered**:
- **`IStartupFilter`**: Runs before the request pipeline is built, not after services
  start. Cannot await async I/O (Redpanda connection) without blocking the DI container
  setup. Rejected.
- **`IHostApplicationLifetime.ApplicationStarted` hook**: Fires after all hosted services
  have started, but the hook itself is synchronous and cannot block traffic. Rejected.
- **`WebApplication.WaitForShutdownAsync` loop**: Not applicable to startup gating.

---

## Decision 3: ECS Fargate Health Check for Readiness

**Decision**: ASP.NET Core built-in health checks (`AddHealthChecks()`) with a tagged
readiness endpoint at `/health` returning RFC-compliant JSON. ECS ALB health check polls
`GET /health` with a `startPeriod` of 30s and `retries` of 6 (60s total tolerance).

**Rationale**: ASP.NET Core 8+ health checks support tag-based routing. A single
`/health` endpoint is registered to include only the `AggregateReadinessCheck`
(tagged `"ready"`). The ECS task definition's `healthCheck.startPeriod` gives the
container time to start before the check counts. With `interval=10s` and `retries=6`,
the container has up to 90s of tolerance — well above the worst-case replay time for
a full 20-game season.

**Health check response bodies**:
- `200 OK` with `{"status":"Healthy"}` — replay complete, ready for traffic.
- `503 Service Unavailable` with `{"status":"Unhealthy","reason":"..."}` — still
  replaying; ECS will not route traffic to this task.

**Alternatives considered**:
- **TCP health check**: Can only verify the port is open, not that aggregates are ready.
  Rejected — insufficient for this pattern.
- **Custom `/readyz` + `/livez` endpoints**: Kubernetes convention; not needed for ECS
  ALB which uses a single target group health check path.

---

## Decision 4: Redpanda Persistent Storage on ECS Fargate

**Decision**: Amazon EFS (Elastic File System) mounted into the Redpanda Fargate task
via an EFS volume in the task definition.

**Rationale**: ECS Fargate on Linux supports EBS volumes (announced GA in 2023), but EBS
volumes are AZ-specific and require pre-provisioning. EFS is multi-AZ, automatically
scales, and is the simpler choice for a single stateful Fargate task. For Redpanda v1
(single-node, light traffic), EFS throughput is more than sufficient. The EFS mount
point is set to Redpanda's `data/` directory so logs survive container restarts.

**Single-node Redpanda configuration**: Redpanda's `rpk` bootstrap sets
`--overprovisioned` and `--smp=1 --memory=512M --reserve-memory=0M` for the Fargate
task sizing (1 vCPU, 2 GB RAM). `replication_factor=1` for all topics.

**Alternatives considered**:
- **EBS for Fargate**: GA but more complex to provision per-AZ. Overkill for v1.
- **ephemeral storage only**: Data lost on task restart — defeats the purpose of
  Redpanda as the event store. Rejected.
- **Self-managed EC2 + EBS**: Increases operational overhead; Fargate is simpler. Rejected.

---

## Decision 5: S3 as Durable Event Archive (Redpanda Tiered Storage)

**Decision**: Enable Redpanda Tiered Storage, configured to offload log segments to an
S3 bucket after they reach a configurable age/size threshold (e.g., 1 hour or 100 MB).

**Rationale**: Redpanda's Tiered Storage transparently offloads sealed log segments to S3
asynchronously — no application code required. The write path is: event → EFS (primary
durable store, acknowledged to producer) → S3 (async archive, after segment seals).
EFS is the real-time durability guarantee (multi-AZ, 99.99% SLA). S3 is the
disaster-recovery archive for if EFS needs to be rebuilt; there is always a small
window (configurable, e.g., 10 min) where the most recent events are on EFS but not yet
in S3. For this use case (youth sports, light traffic) this is entirely acceptable.
The local EFS volume stays small because only hot/recent segments remain local.

**Required Redpanda configuration**:
```yaml
cloud_storage_enabled: true
cloud_storage_bucket: roster-events-archive-{env}
cloud_storage_region: us-east-1
cloud_storage_credentials_source: aws_instance_metadata  # uses ECS task IAM role
```

**Alternatives considered**:
- **Separate Kafka Connect S3 Sink connector**: Adds another service to manage. Overkill
  for v1. Rejected.
- **Custom consumer that mirrors events to S3**: More control, but adds boilerplate.
  Tiered Storage achieves the same goal natively. Rejected.
- **S3 only (no Redpanda)**: Directly appending events to S3 objects loses Kafka's
  ordering guarantees and the consumer-group replay model. Rejected.

---

## Decision 6: OpenAPI Client Generation — orval

**Decision**: orval

**Rationale**: orval is the current standard for generating TypeScript API clients with
first-class TanStack Query v5 support. It generates typed `useQuery` and `useMutation`
hooks directly from the OpenAPI spec — the output maps 1:1 to what the UI's `hooks/`
layer needs. Configuration is a single `orval.config.ts` file that points at the
Swashbuckle-generated `swagger.json` URL. The generated output is clean, tree-shakeable,
and regenerated in a single `npm run generate-client` command.

**Alternatives considered**:
- **openapi-typescript-codegen**: Older project; does not generate TanStack Query hooks
  natively. Requires manual wrapping in `useQuery`. Rejected.
- **Hey API (openapi-ts)**: Promising but less mature TanStack Query integration as of
  early 2026. Rejected.
- **swagger-typescript-api**: Generates plain fetch/axios clients without Query hooks.
  Would require manual hook authoring. Rejected.

---

## Decision 7: Team Access Secret Generation

**Decision**: `RandomNumberGenerator.GetBytes(32)` encoded as URL-safe Base64
(no padding), stored as `SHA-256(secret)` hex in the `TeamCreated` event.

**Rationale**: 32 random bytes = 256 bits of entropy, making brute-force infeasible.
URL-safe Base64 without padding produces a 43-character string, easy to copy/paste.
Storing only the SHA-256 hash in the event log means the plaintext never persists
anywhere — only the coach who received it at team-creation time knows it. SHA-256 is
sufficient for a non-password token (no need for bcrypt/Argon2 since the secret is
already high-entropy and not a human-chosen password).

**Implementation sketch**:
```csharp
var bytes = RandomNumberGenerator.GetBytes(32);
var secret = Base64UrlEncoder.Encode(bytes);              // plaintext — returned once
var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(secret)));
// Store hash in TeamCreated event; return secret to caller
```

**Alternatives considered**:
- **GUID as secret**: Only 122 bits of randomness; UUID format is predictable.
  Rejected.
- **bcrypt for hashing**: Designed for slow human-password verification; adds latency
  to every API request. Overkill for a high-entropy token. Rejected.
- **Store plaintext in event**: Exposes the secret in the event log (Redpanda, S3,
  logs). Security anti-pattern. Rejected.

---

## Decision 8: Kafka Topic Partitioning Strategy

**Decision**: Single `roster-events` topic, partitioned by `TeamId` as the message key
(string representation of the Guid).

**Rationale**: Using `TeamId` as the partition key guarantees that all events for one
team are stored on the same partition in the same order they were produced. This is the
minimal requirement for correct in-memory aggregate replay — events for a team must be
applied in production order to reconstruct the correct state. A single topic keeps the
consumer simple (subscribe once, consume all). For v1 scale (a handful of teams), a
small partition count (e.g., 6) is sufficient.

**Consumer group strategy for live events**: After replay, the API instance joins a
live consumer group (`roster-api-live`). Since all instances maintain their own complete
in-memory state (no shard-per-partition), all instances use the same group — this means
each partition is consumed by exactly one instance. In v1 (single task), this is trivial.
If multiple tasks run in the future, each task must use a unique consumer group to
receive all events for all partitions.

**Alternatives considered**:
- **Per-team topics** (`roster-team-{teamId}`): Allows per-team replay, but requires
  dynamic topic creation and has Kafka/Redpanda broker limits on topic count. Rejected
  for v1.
- **Single partition**: Eliminates ordering concerns but limits future horizontal scaling.
  Fine for v1 but 6 partitions costs nothing and avoids a future migration.
