# Roster Management

A youth sports roster management application for coaches to track players, record
per-inning fielding assignments, and monitor season-wide playing-time balance.

## Architecture Overview

```
ui/       React + Vite SPA (TanStack Query, orval-generated API client)
api/      .NET 10 API — event-sourced, DDD four-project layout
infra/    Terraform — ECS Fargate, ALB, EFS, S3, CloudFront
```

The API is **event-sourced**: every state change is appended as an immutable domain event
to a Redpanda (Kafka-compatible) topic. On startup the API replays the full event log to
rebuild in-memory aggregates; there is no separate database. Reads are served entirely
from in-memory state; writes go through Redpanda.

---

## Local Development

### Prerequisites

| Tool | Notes |
|------|-------|
| Docker Desktop | Runs the local Redpanda broker |
| .NET 10 SDK | `dotnet --version` should report `10.x` |
| Node.js 20+ | `node --version` |

> **WSL users**: there is no Linux .NET SDK installed. Use the Windows binary instead:
> `/mnt/c/Program\ Files/dotnet/dotnet.exe`. All commands below use `dotnet` — substitute
> that path if your shell does not resolve it automatically.

---

### 1. Start Redpanda

```bash
docker compose up -d redpanda
```

This starts a single-node Redpanda broker on `localhost:9092` and auto-creates the
`roster-events` topic with 6 partitions. An optional Redpanda Console UI is available
at `http://localhost:8080` once the `redpanda-console` container is running.

Wait for the broker to become healthy before starting the API:

```bash
docker compose ps   # wait until redpanda shows "healthy"
```

---

### 2. Run the API

```bash
dotnet run --project api/Roster.Api
```

The API starts on `http://localhost:5001` by default. On first start it connects to
Redpanda, replays the (empty) event log, marks itself ready, then begins serving requests.

- Swagger UI: `http://localhost:5001/swagger`
- Health check: `http://localhost:5001/health` — returns `{"status":"Healthy"}` once
  aggregate replay is complete (should be near-instant on an empty topic)

Environment variables used (see `api/.env.example` for the full list):

| Variable | Default | Purpose |
|----------|---------|---------|
| `Redpanda__BootstrapServers` | `localhost:9092` | Kafka broker address |
| `Redpanda__Topic` | `roster-events` | Event topic name |
| `ASPNETCORE_ENVIRONMENT` | `Development` | Enables Swagger UI |

Development defaults are already set in `api/Roster.Api/appsettings.Development.json`;
no `.env` file is required for local dev.

---

### 3. Run the UI

```bash
cd ui
npm install
npm run dev
```

The UI starts on `http://localhost:5173` and proxies API calls to `localhost:5001`.

If the API contracts changed, regenerate the client before starting:

```bash
# From the repo root — requires the openapi.json at the root to be up to date
cd ui && npx orval --config ./orval.config.ts
```

Or export a fresh spec from the running API first:

```bash
curl http://localhost:5001/swagger/v1/swagger.json > openapi.json
cd ui && npx orval --config ./orval.config.ts
```

---

### 4. Run the Tests

**API unit + integration tests:**

```bash
dotnet test api/Roster.sln
```

Integration tests (Phases 2 + 7) use [Testcontainers.Redpanda](https://testcontainers.com/)
and spin up a Redpanda container automatically — no pre-running broker is needed for tests.

**UI (no tests in this iteration):** tracked in `specs/001-roster-management/tasks.md`.

---

### Full local session (quick reference)

```bash
# Terminal 1 — broker
docker compose up -d redpanda && docker compose logs -f redpanda

# Terminal 2 — API
dotnet run --project api/Roster.Api

# Terminal 3 — UI
cd ui && npm run dev
```

---

## Domain Model

The core of the system is two aggregates that own all business rules.

### TeamAggregate

**Source**: `api/Roster.Domain/Aggregates/TeamAggregate.cs`

Owns the team identity, roster, and skill ratings. A Team is also the season boundary —
starting a new season means creating a new Team.

```
TeamAggregate
├── TeamId          Guid
├── Name            string
├── Sport           Sport value object (skills + valid positions)
├── AccessSecretHash string  (SHA-256 of the plaintext secret; plaintext never stored)
├── Version         int (event count)
└── Players         Dictionary<PlayerId, PlayerState>
                    └── PlayerState { PlayerId, Name, IsActive, Skills{skillName → 1–5} }
```

**Events it processes:**

| Event | Effect |
|-------|--------|
| `TeamCreated` | Sets TeamId, Name, Sport, AccessSecretHash; guards against duplicate |
| `PlayerAdded` | Inserts a new active PlayerState with empty skills |
| `PlayerSkillRated` | Updates one skill rating; rejects if player is inactive |
| `PlayerDeactivated` | Sets `IsActive = false`; historical data preserved |

---

### GameAggregate

**Source**: `api/Roster.Domain/Aggregates/GameAggregate.cs`

Owns a single game record: the batting order, per-inning fielding assignments, and the
locked flag. All state is mutable until `GameLocked` is applied, after which any write
attempt throws `DomainException`.

```
GameAggregate
├── GameId              Guid
├── TeamId              Guid
├── Date                DateOnly
├── Opponent            string?
├── InningCount         int (1–12)
├── IsLocked            bool
├── AbsentPlayerIds     List<Guid>
├── BattingOrder        List<Guid>  (ordered player IDs)
└── InningAssignments   Dictionary<inningNumber, List<FieldingAssignment>>
                        └── FieldingAssignment { PlayerId, Position }
                            Position is one of the sport's positions or "Bench"
```

**Events it processes:**

| Event | Effect |
|-------|--------|
| `GameCreated` | Initialises all fields |
| `PlayerMarkedAbsent` | Adds to AbsentPlayerIds |
| `PlayerAbsenceRevoked` | Removes from AbsentPlayerIds |
| `BattingOrderSet` | Replaces the full batting order |
| `InningFieldingAssigned` | Replaces all assignments for one inning; enforces no two non-Bench players share the same position |
| `GameLocked` | Sets `IsLocked = true`; all subsequent writes are rejected |

---

### Value Objects

| Value Object | Location | Purpose |
|---|---|---|
| `Sport` | `Roster.Domain/ValueObjects/Sport.cs` | Defines skill names + valid fielding positions for a sport; `Sport.Softball` is the seeded instance |
| `SkillRating` | `Roster.Domain/ValueObjects/SkillRating.cs` | Validates rating is 1–5; throws `DomainException` outside range |
| `Position` | `Roster.Domain/ValueObjects/Position.cs` | Case-insensitive position name; `IsBench` derived property |

---

### Event Flow

```
HTTP Request
    │
    ▼
TeamAccessMiddleware          validates X-Team-Secret header → injects TeamId
    │
    ▼
MediatR Command Handler       loads aggregate from InMemoryStore, calls aggregate
    │                         methods, constructs domain event(s)
    ▼
RedpandaEventStore            appends events to roster-events topic (retry ≤ 5s;
    │                         throws EventStoreUnavailableException → 503 on failure)
    ▼
AggregateReplayService        (background) consumes live events, applies to InMemoryStore
    │
    ▼
InMemoryStore                 updated in-memory state for subsequent reads
```

Read queries bypass Redpanda entirely — they read directly from `InMemoryStore`.

---

## Project Structure

```
api/
├── Roster.Domain/            Aggregates, events, value objects, domain interfaces
├── Roster.Domain.Tests/      Unit tests — written RED before each implementation
├── Roster.Application/       MediatR commands + queries (CQRS handlers)
├── Roster.Application.Tests/ Handler unit tests
├── Roster.Infrastructure/    RedpandaEventStore, InMemoryStore, AggregateReplayService
├── Roster.Infrastructure.Tests/ Integration tests via Testcontainers
├── Roster.Api/               Controllers, middleware, health checks, DI wiring
└── Roster.Api.Tests/         Contract tests via WebApplicationFactory

ui/
├── src/api/                  Auto-generated orval client — do not hand-edit
├── src/hooks/                TanStack Query hooks (useTeam, useRoster, useGame, useBalance)
├── src/components/           roster/, game/, balance/ component folders
└── src/pages/                Landing, TeamDashboard, RosterPage, GamePage, BalancePage

specs/
└── 001-roster-management/    Spec, plan, data model, API contracts, tasks
```

---

## Authentication

All endpoints except `POST /teams` and `GET /health` require the `X-Team-Secret` header
set to the plaintext secret issued at team creation. The middleware hashes it (SHA-256)
and looks up the team. There are no user accounts in v1 — the secret grants full team
access.

The UI stores the secret in `localStorage` under the key `roster_team` and injects it
automatically via an Axios interceptor on every request.
