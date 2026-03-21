# Implementation Plan: Youth Sports Roster Management

**Branch**: `001-roster-management` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-roster-management/spec.md`

## Summary

A full-stack monorepo application for youth sports coaches to manage team rosters,
record per-inning fielding assignments, and track season-wide playing-time balance.
The API is event-sourced: all state changes are domain events published to a Redpanda
(Kafka-compatible) topic. On startup, the API container replays the full event log to
rebuild in-memory aggregates before signalling healthy. The UI is a React + Vite SPA
that consumes a generated OpenAPI client via TanStack Query hooks, persisting the team
access secret in browser localStorage for frictionless return visits.

## Technical Context

**Language/Version**: C# / .NET 10 (API), TypeScript / React + Vite latest (UI)
**Primary Dependencies**:
- API: ASP.NET Core 10, MediatR (CQRS), Swashbuckle.AspNetCore, Confluent.Kafka,
  xUnit, FluentAssertions, NSubstitute, Testcontainers.dotnet
- UI: React 19, Vite 6, TanStack Query v5, orval (OpenAPI client + hook generation)
**Storage**: Redpanda (Kafka-compatible event log on ECS Fargate + EFS); in-memory
aggregates rebuilt on each container start; Redpanda Tiered Storage offloads log
segments to S3 for durability
**Testing**: xUnit + FluentAssertions + NSubstitute (unit); Testcontainers.dotnet
with Redpanda image (integration); WebApplicationFactory + Swashbuckle (contract)
**Target Platform**: Linux containers on AWS ECS Fargate; UI hosted on S3 + CloudFront
**Project Type**: REST web service (API) + SPA (UI) in a monorepo
**Performance Goals**: API health-check passes (aggregate replay complete) within 30s
on a cold start with a full 20-game season; API responses < 300ms p95 under normal load
**Constraints**: In-memory aggregates only (v1, no secondary DB); single Redpanda node;
one ECS task per service (no horizontal scaling in v1)
**Scale/Scope**: ~15 players, ~20 games, ~1 concurrent user per team; light overall traffic

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Monorepo Structure** — All changes are in `ui/`, `api/`, and `infra/`. No
  cross-workspace source imports. UI consumes only deployed API endpoints.
- [x] **II. DDD Layering** — Four projects: `Roster.Domain`, `Roster.Application`,
  `Roster.Infrastructure`, `Roster.Api`. Dependency arrow flows strictly inward.
  `IEventStore` and `ITeamRepository` are defined in Domain; implemented in Infrastructure.
- [x] **III. SOLID** — Aggregates have single responsibility; all dependencies injected
  via .NET DI container; MediatR handlers follow open/closed; interfaces are focused.
  Reviewer must confirm no violations before merge.
- [x] **IV. TDD** — All Domain and Application layer tests are written and confirmed
  RED before any production code is committed. Red-Green-Refactor strictly enforced.
  Test tasks precede implementation tasks in tasks.md.
- [x] **V. OpenAPI-First** — Swashbuckle configured in `Roster.Api` from the first
  commit. All controllers carry `[ProducesResponseType]` annotations. CI exports the
  spec as `openapi.json`; orval regenerates the UI client from it.
- [x] **VI. IaC** — All AWS resources (ECS cluster, Fargate services, EFS, ALB,
  S3 buckets, CloudFront, ECR, IAM) are provisioned via Terraform in `infra/`.
  No console changes to tracked resources.
- [x] **VII. Frontend Data Layer** — All API calls in `ui/` go through orval-generated
  client functions wrapped in TanStack Query `useQuery`/`useMutation` hooks. No bare
  `fetch` or `axios` calls to the Roster API.

## Project Structure

### Documentation (this feature)

```text
specs/001-roster-management/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # REST endpoint contracts
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
ui/
├── src/
│   ├── api/                    # orval-generated client (do not hand-edit)
│   │   └── roster-client.ts
│   ├── components/
│   │   ├── roster/             # Player list, add-player form, skill rating inputs
│   │   ├── game/               # Game card, batting order, inning fielding grid
│   │   └── balance/            # Position balance matrix table
│   ├── hooks/                  # TanStack Query hooks wrapping generated client
│   │   ├── useTeam.ts
│   │   ├── useRoster.ts
│   │   ├── useGame.ts
│   │   └── useBalance.ts
│   ├── pages/
│   │   ├── Landing.tsx         # Enter/create team access secret
│   │   ├── TeamDashboard.tsx   # Hub: roster, games, balance links
│   │   ├── RosterPage.tsx
│   │   ├── GamePage.tsx        # Batting order + inning fielding assignment
│   │   └── BalancePage.tsx
│   └── main.tsx
├── orval.config.ts             # Points at API openapi.json, outputs to src/api/
├── vite.config.ts
└── package.json

api/
├── Roster.sln
├── Roster.Domain/
│   ├── Aggregates/
│   │   ├── TeamAggregate.cs
│   │   └── GameAggregate.cs
│   ├── Events/                 # All 10 domain events (immutable records)
│   │   ├── DomainEvent.cs      # Abstract base with TeamId, EventId, Timestamp
│   │   ├── TeamCreated.cs
│   │   ├── PlayerAdded.cs
│   │   ├── PlayerSkillRated.cs
│   │   ├── PlayerDeactivated.cs
│   │   ├── GameCreated.cs
│   │   ├── PlayerMarkedAbsent.cs
│   │   ├── PlayerAbsenceRevoked.cs
│   │   ├── BattingOrderSet.cs
│   │   ├── InningFieldingAssigned.cs
│   │   └── GameLocked.cs
│   ├── ValueObjects/
│   │   ├── Position.cs         # Sealed record; Bench is a valid position
│   │   ├── SkillRating.cs      # Validated 1-5 integer
│   │   └── TeamId.cs           # Typed ID wrapper (Guid)
│   └── Interfaces/
│       ├── IEventStore.cs      # AppendAsync(DomainEvent[])
│       └── ITeamRepository.cs  # GetByIdAsync, GetBySecretHashAsync
│
├── Roster.Domain.Tests/
│   ├── Aggregates/
│   │   ├── TeamAggregateTests.cs
│   │   └── GameAggregateTests.cs
│   └── ValueObjects/
│       ├── PositionTests.cs
│       └── SkillRatingTests.cs
│
├── Roster.Application/
│   ├── Commands/
│   │   ├── CreateTeam/         # CreateTeamCommand + Handler
│   │   ├── AddPlayer/
│   │   ├── RatePlayerSkill/
│   │   ├── DeactivatePlayer/
│   │   ├── CreateGame/
│   │   ├── MarkPlayerAbsent/
│   │   ├── RevokePlayerAbsence/
│   │   ├── SetBattingOrder/
│   │   ├── AssignInningFielding/
│   │   └── LockGame/
│   ├── Queries/
│   │   ├── GetTeam/
│   │   ├── GetRoster/
│   │   ├── GetGames/
│   │   ├── GetGame/
│   │   └── GetBalanceMatrix/
│   └── Interfaces/
│       └── IInMemoryStore.cs   # Read interface for in-memory aggregate access
│
├── Roster.Application.Tests/
│   └── Commands/               # Handler tests (Domain + InMemoryStore mocked)
│
├── Roster.Infrastructure/
│   ├── EventStore/
│   │   └── RedpandaEventStore.cs   # Confluent.Kafka producer; implements IEventStore
│   ├── InMemory/
│   │   ├── InMemoryStore.cs         # Implements ITeamRepository + IInMemoryStore
│   │   └── AggregateReplayService.cs # IHostedService: replays from offset 0, sets ready flag
│   └── Security/
│       └── AccessSecretService.cs   # Generates + hashes secrets (SHA-256)
│
├── Roster.Infrastructure.Tests/
│   └── InMemory/
│       └── AggregateReplayServiceTests.cs  # Uses Testcontainers Redpanda
│
├── Roster.Api/
│   ├── Controllers/
│   │   ├── TeamsController.cs
│   │   ├── PlayersController.cs
│   │   ├── GamesController.cs
│   │   └── BalanceController.cs
│   ├── Middleware/
│   │   └── TeamAccessMiddleware.cs  # Validates X-Team-Secret header; injects TeamId
│   ├── Health/
│   │   └── AggregateReadinessCheck.cs  # IHealthCheck; unhealthy until replay done
│   └── Program.cs
│
└── Roster.Api.Tests/           # Contract tests via WebApplicationFactory

infra/
├── modules/
│   ├── networking/             # VPC, subnets, security groups, NAT gateway
│   ├── ecs-cluster/            # ECS cluster resource
│   ├── api-service/            # ECS task def + service for Roster.Api; ALB; ECR repo
│   ├── redpanda-service/       # ECS task def + service for Redpanda; EFS volume
│   ├── ui-hosting/             # S3 bucket + CloudFront + ACM certificate
│   ├── event-store/            # S3 bucket for Redpanda Tiered Storage
│   └── iam/                    # ECS task roles + policies
└── environments/
    ├── dev/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── terraform.tfvars
    └── prod/
        ├── main.tf
        ├── variables.tf
        └── terraform.tfvars
```

**Structure Decision**: Monorepo with three top-level workspaces matching the constitution
(`ui/`, `api/`, `infra/`). The API uses the full DDD four-project layout. Terraform
environments share reusable modules; dev and prod differ only in sizing and domain names.

## Complexity Tracking

*No constitution violations requiring justification.*
