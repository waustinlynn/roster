---
description: "Task list for Youth Sports Roster Management — api/ and ui/ workspaces only"
---

# Tasks: Youth Sports Roster Management

**Input**: Design documents from `specs/001-roster-management/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api.md ✅

> **⚠ Infrastructure not included**: Tasks for `infra/` (Terraform, ECS, EFS, CloudFront,
> S3) are tracked separately. Create `specs/002-infrastructure/tasks.md` before
> any deployment work begins.

**TDD note (constitution IV)**: For all `api/Roster.Domain` and `api/Roster.Application`
work, test tasks are NON-OPTIONAL and precede implementation tasks.
Tests are written, confirmed RED, then implementation follows.

**Testing tools**: Testcontainers.dotnet (integration tests — spins up Redpanda
automatically, no pre-running container needed); `docker-compose.yml` is for
local developer convenience only, not used by the test suite.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story (US0–US3) the task belongs to

---

## Phase 1: Setup

**Purpose**: Monorepo skeleton, project creation, local dev tooling. No business logic.

- [x] T001 Create top-level monorepo directory structure: `ui/`, `api/`, `infra/` (placeholder README only), `.editorconfig` at repo root
- [x] T002 Create `api/Roster.sln` and scaffold eight projects: `Roster.Domain`, `Roster.Domain.Tests`, `Roster.Application`, `Roster.Application.Tests`, `Roster.Infrastructure`, `Roster.Infrastructure.Tests`, `Roster.Api`, `Roster.Api.Tests` — each as a class library or xUnit project as appropriate
- [x] T003 Configure DDD project references in `api/Roster.sln`: `Roster.Api` → `Roster.Infrastructure` → `Roster.Application` → `Roster.Domain`; test projects reference their target project + xUnit packages; no reverse references permitted
- [x] T004 [P] Add NuGet packages to each project: `MediatR` + `MediatR.Extensions.Microsoft.DependencyInjection` (Application); `Confluent.Kafka` (Infrastructure); `Swashbuckle.AspNetCore` (Api); `xUnit` + `FluentAssertions` + `NSubstitute` + `Testcontainers.Redpanda` (test projects)
- [x] T005 [P] Scaffold React + Vite project in `ui/` using `npm create vite@latest` (React + TypeScript template); add `@tanstack/react-query`, `@tanstack/react-query-devtools`, `orval`; create `ui/orval.config.ts` pointing at `http://localhost:5001/swagger/v1/swagger.json` with output to `ui/src/api/`
- [x] T006 [P] Create `docker-compose.yml` at repo root for local Redpanda development: single-node Redpanda on port 9092, Redpanda Console on port 8080, auto-creates `roster-events` topic with 6 partitions on startup
- [x] T007 [P] Create `api/Dockerfile`: multi-stage build (sdk:10 → aspnet:10), EXPOSE 8080, ENTRYPOINT `dotnet Roster.Api.dll`
- [x] T008 Configure Swashbuckle in `api/Roster.Api/Program.cs`: `AddEndpointsApiExplorer`, `AddSwaggerGen` with title "Roster API v1"; `UseSwagger` + `UseSwaggerUI` in Development; export `openapi.json` on app start via `IApiDescriptionGroupCollectionProvider`
- [x] T009 Configure MediatR, health checks, and environment variables in `api/Roster.Api/Program.cs`: register `AddMediatR` scanning `Roster.Application` assembly; `AddHealthChecks`; bind `Redpanda__BootstrapServers` and `Redpanda__Topic` from config
- [x] T010 [P] Create `ui/src/main.tsx` with `QueryClientProvider` wrapping `<App />`; create `ui/src/pages/Landing.tsx` (placeholder), `ui/src/pages/TeamDashboard.tsx` (placeholder), `ui/src/pages/RosterPage.tsx` (placeholder), `ui/src/pages/GamePage.tsx` (placeholder), `ui/src/pages/BalancePage.tsx` (placeholder); set up React Router with routes
- [x] T011 [P] Create `api/appsettings.Development.json` with `Redpanda__BootstrapServers: localhost:9092` and `Redpanda__Topic: roster-events`; create `api/.env.example` documenting all required environment variables

**Checkpoint**: `dotnet build api/Roster.sln` succeeds; `npm run dev --prefix ui` starts; `docker compose up -d redpanda` starts a local broker.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Event sourcing infrastructure, DDD skeleton, middleware, and DI wiring.
Must be complete before any user story implementation begins.

**⚠ CRITICAL**: No user story work starts until this phase is complete.

- [x] T012 Define `DomainEvent` abstract base record in `api/Roster.Domain/Events/DomainEvent.cs`: `EventId: Guid`, `TeamId: Guid`, `OccurredAt: DateTimeOffset`, `EventType: string` (init-only; set by each subtype)
- [x] T013 [P] Define all 10 domain event records in `api/Roster.Domain/Events/` (one file each, all inheriting `DomainEvent`): `TeamCreated` (Name, SportName, AccessSecretHash), `PlayerAdded` (PlayerId, Name), `PlayerSkillRated` (PlayerId, SkillName, Rating), `PlayerDeactivated` (PlayerId), `GameCreated` (GameId, Date, Opponent?, InningCount), `PlayerMarkedAbsent` (GameId, PlayerId), `PlayerAbsenceRevoked` (GameId, PlayerId), `BattingOrderSet` (GameId, OrderedPlayerIds), `InningFieldingAssigned` (GameId, InningNumber, Assignments), `GameLocked` (GameId)
- [x] T014 [P] Define value objects in `api/Roster.Domain/ValueObjects/`: `SkillRating` (sealed record, validates 1–5, throws `DomainException` outside range); `Position` (sealed record, Name + IsBench derived property, case-insensitive equality); `Sport` (record with Name, Skills: `IReadOnlyList<string>`, Positions: `IReadOnlyList<string>`) with static `Softball` property seeding the 10 positions and 3 skills
- [x] T015 [P] Define domain interfaces in `api/Roster.Domain/Interfaces/`: `IEventStore` with `AppendAsync(IReadOnlyList<DomainEvent> events, CancellationToken ct)` and `ITeamRepository` with `GetByIdAsync(Guid teamId)`, `GetBySecretHashAsync(string secretHash)`, `Apply(DomainEvent e)`
- [x] T016 [P] Define `IInMemoryStore` in `api/Roster.Application/Interfaces/IInMemoryStore.cs`: read-only interface with `GetTeam(Guid teamId)`, `GetGame(Guid gameId)`, `GetGamesForTeam(Guid teamId)` — used by all query handlers
- [x] T017 Create empty aggregate skeletons in `api/Roster.Domain/Aggregates/`: `TeamAggregate` (empty class with `Apply(DomainEvent e)` dispatch method) and `GameAggregate` (same) — stubs only; implementation driven by TDD in story phases
- [x] T018 Implement `InMemoryStore` in `api/Roster.Infrastructure/InMemory/InMemoryStore.cs`: singleton implementing `ITeamRepository` + `IInMemoryStore`; three `ConcurrentDictionary` fields (`_teams`, `_games`, `_secrets`); `Apply(DomainEvent e)` routes Team events to `TeamAggregate`, Game events to `GameAggregate`, creating aggregates on first event; `_secrets` updated on `TeamCreated`
- [x] T019 Implement `AggregateReplayService` in `api/Roster.Infrastructure/InMemory/AggregateReplayService.cs`: `BackgroundService`; on `ExecuteAsync` connects to Redpanda via `Confluent.Kafka`, assigns all partitions of `roster-events`, seeks to offset 0, consumes to watermark sampled at start, calls `InMemoryStore.Apply()` per event, sets `_isReady = true`, then continues consuming live events; exposes `bool IsReady` property
- [x] T020 [P] Implement `AggregateReadinessCheck` in `api/Roster.Api/Health/AggregateReadinessCheck.cs`: `IHealthCheck` that returns `Healthy` when `AggregateReplayService.IsReady` is true, otherwise `Unhealthy` with description "Aggregate replay in progress"; register with tag `"ready"` and map `/health` endpoint to this check
- [x] T021 [P] Implement `TeamAccessMiddleware` in `api/Roster.Api/Middleware/TeamAccessMiddleware.cs`: reads `X-Team-Secret` header, SHA-256 hashes it, calls `ITeamRepository.GetBySecretHashAsync`, returns `401` if not found; stores resolved `TeamId` in `HttpContext.Items["TeamId"]`; applies to all routes except `POST /teams` and `GET /health`
- [x] T022 Implement `RedpandaEventStore` in `api/Roster.Infrastructure/EventStore/RedpandaEventStore.cs`: implements `IEventStore`; `Confluent.Kafka` producer; serializes events to JSON with `eventType` discriminator; uses `TeamId` as partition key; retry policy: up to 3 attempts over < 5 seconds total using `Polly` or manual retry loop; throws `EventStoreUnavailableException` after exhausting retries (caught by controllers to return 503)
- [x] T023 [P] Add `DomainException` and `EventStoreUnavailableException` to `api/Roster.Domain/Exceptions/`; add global exception handler in `api/Roster.Api/Program.cs` mapping `DomainException` → 400 ProblemDetails, `EventStoreUnavailableException` → 503 ProblemDetails
- [x] T024 Wire all DI registrations in `api/Roster.Api/Program.cs`: `AddSingleton<InMemoryStore>`, register as `ITeamRepository` and `IInMemoryStore`; `AddSingleton<AggregateReplayService>` and register as `IHostedService`; `AddSingleton<RedpandaEventStore>` as `IEventStore`; `AddHealthChecks().AddCheck<AggregateReadinessCheck>("replay", tags: ["ready"])`; `UseMiddleware<TeamAccessMiddleware>`

**Checkpoint**: `dotnet build api/Roster.sln` succeeds. API starts, hits Redpanda (via docker-compose), replays empty topic, `/health` returns `{"status":"Healthy"}`.

---

## Phase 3: User Story 0 — Team Creation & Setup (Priority: P0) 🎯 MVP

**Goal**: A coach can create a team and receive a one-time access secret, then return to the app and have it auto-load.

**Independent Test**: `POST /teams` returns a teamId + accessSecret. `GET /teams/{teamId}` with the secret returns team details. Refreshing the UI auto-loads the team from localStorage.

### Tests for US0 — Write FIRST, confirm RED before any implementation

- [x] T025 [P] [US0] Write failing unit tests for `TeamAggregate` in `api/Roster.Domain.Tests/Aggregates/TeamAggregateTests.cs`: `Apply(TeamCreated)` sets TeamId, Name, Sport (assert Softball positions loaded), AccessSecretHash; assert `Version` increments; assert second `TeamCreated` on same aggregate throws `DomainException`
- [x] T026 [P] [US0] Write failing unit tests for `CreateTeamCommandHandler` in `api/Roster.Application.Tests/Commands/CreateTeamCommandHandlerTests.cs`: emits exactly one `TeamCreated` event with correct fields; AccessSecretHash is SHA-256 of returned plaintext; plaintext is NOT stored in the event; handler calls `IEventStore.AppendAsync` once

### Implementation for US0

- [x] T027 [US0] Implement `AccessSecretService` in `api/Roster.Infrastructure/Security/AccessSecretService.cs`: `GenerateSecret()` returns `(plaintext: string, hash: string)` using `RandomNumberGenerator.GetBytes(32)` + `Convert.ToBase64Url` for plaintext, `SHA256.HashData` + hex encoding for hash
- [x] T028 [US0] Implement `TeamAggregate.Apply(TeamCreated)` in `api/Roster.Domain/Aggregates/TeamAggregate.cs`: sets all fields; loads `Sport.Softball` by name; guards against duplicate TeamCreated. Confirm T025 now passes GREEN.
- [x] T029 [US0] Implement `CreateTeamCommand` + `CreateTeamCommandHandler` in `api/Roster.Application/Commands/CreateTeam/`: validates sport name exists, calls `AccessSecretService`, constructs and appends `TeamCreated` event, returns `(TeamId, PlaintextSecret)`. Confirm T026 now passes GREEN.
- [x] T030 [P] [US0] Implement `GetTeamQuery` + `GetTeamQueryHandler` in `api/Roster.Application/Queries/GetTeam/`: reads from `IInMemoryStore.GetTeam(teamId)`, returns team name + sport details (skills + positions list)
- [x] T031 [US0] Implement `TeamsController` in `api/Roster.Api/Controllers/TeamsController.cs`: `POST /teams` (unauthenticated, sends `CreateTeamCommand`, returns 201 with teamId + accessSecret); `GET /teams/{teamId}` (authenticated, sends `GetTeamQuery`, returns 200); add `[ProducesResponseType]` for all status codes per contracts/api.md
- [x] T032 [US0] Implement UI Landing page in `ui/src/pages/Landing.tsx`: "Create Team" form (name + sport dropdown seeded with "Softball"); "Enter Secret" form; on successful create, store secret in `localStorage` key `roster_secret`, redirect to `TeamDashboard`; on enter-secret, validate against API, store in localStorage; `ui/src/hooks/useTeam.ts` with `useCreateTeam` (mutation) and `useGetTeam` (query) wrapping orval-generated client; run `npm run generate-client` after TeamsController is implemented

**Checkpoint**: A coach can create a team, receive the secret, return to the app, and have it auto-load. `GET /health` returns `Healthy`. US0 is independently demonstrable.

---

## Phase 4: User Story 1 — Roster Setup & Player Skill Ratings (Priority: P1)

**Goal**: A coach can add players manually and rate each player's skills 1–5.

**Independent Test**: Add 15 players, assign all skill ratings, view the complete rated roster — verified via `GET /teams/{teamId}/players`.

### Tests for US1 — Write FIRST, confirm RED before any implementation

- [x] T033 [P] [US1] Write failing unit tests in `api/Roster.Domain.Tests/Aggregates/TeamAggregateTests.cs`: `Apply(PlayerAdded)` appends a player with empty skills; `Apply(PlayerSkillRated)` sets the named skill; `Apply(PlayerSkillRated)` on a deactivated player throws `DomainException`; `Apply(PlayerDeactivated)` sets `IsActive = false`
- [x] T034 [P] [US1] Write failing unit tests for `AddPlayerCommandHandler`, `RatePlayerSkillCommandHandler`, `DeactivatePlayerCommandHandler` in `api/Roster.Application.Tests/Commands/`: each handler emits the correct event; `RatePlayerSkill` rejects invalid skill names for the team's sport; `RatePlayerSkill` rejects ratings outside 1–5

### Implementation for US1

- [x] T035 [US1] Implement `TeamAggregate.Apply(PlayerAdded)`, `Apply(PlayerSkillRated)`, `Apply(PlayerDeactivated)` in `api/Roster.Domain/Aggregates/TeamAggregate.cs`. Confirm T033 GREEN.
- [x] T036 [P] [US1] Implement `AddPlayerCommand` + handler in `api/Roster.Application/Commands/AddPlayer/`: assigns new `PlayerId` (Guid.NewGuid()), appends `PlayerAdded` event. Confirm relevant T034 tests GREEN.
- [x] T037 [P] [US1] Implement `RatePlayerSkillCommand` + handler in `api/Roster.Application/Commands/RatePlayerSkill/`: validates skill name against team's sport, validates rating 1–5, appends `PlayerSkillRated`. Confirm relevant T034 tests GREEN.
- [x] T038 [P] [US1] Implement `DeactivatePlayerCommand` + handler in `api/Roster.Application/Commands/DeactivatePlayer/`: appends `PlayerDeactivated`; returns 409 if already inactive. Confirm relevant T034 tests GREEN.
- [x] T039 [US1] Implement `GetRosterQuery` + handler in `api/Roster.Application/Queries/GetRoster/`: returns all players (active + inactive) with name, isActive, and skills dictionary from `IInMemoryStore.GetTeam`
- [x] T040 [US1] Implement `PlayersController` in `api/Roster.Api/Controllers/PlayersController.cs`: `GET /teams/{teamId}/players` (200), `POST /teams/{teamId}/players` (201), `PUT /teams/{teamId}/players/{playerId}/skills/{skillName}` (204), `DELETE /teams/{teamId}/players/{playerId}` (204); `[ProducesResponseType]` on all actions
- [x] T041 [US1] Implement `ui/src/pages/RosterPage.tsx` + `ui/src/components/roster/` (PlayerList, AddPlayerForm, SkillRatingRow); `ui/src/hooks/useRoster.ts` with `useGetRoster`, `useAddPlayer`, `useRateSkill`, `useDeactivatePlayer`; run `npm run generate-client` after PlayersController is implemented

**Checkpoint**: US1 independently testable. Add 15 players, rate all skills, view roster — fully functional without any game features.

---

## Phase 5: User Story 2 — Game Lineup Creation (Priority: P2)

**Goal**: A coach creates a game, sets the batting order, assigns fielding positions inning-by-inning (including Bench), and locks the game when complete.

**Independent Test**: Create a 6-inning game, mark one player absent, set batting order, assign all 10 positions + bench players for each inning, lock the game — verified end-to-end.

### Tests for US2 — Write FIRST, confirm RED before any implementation

- [x] T042 [P] [US2] Write failing unit tests for `GameAggregate` init in `api/Roster.Domain.Tests/Aggregates/GameAggregateTests.cs`: `Apply(GameCreated)` sets all fields; `Apply(PlayerMarkedAbsent)` adds to AbsentPlayerIds; `Apply(PlayerAbsenceRevoked)` removes from AbsentPlayerIds; applying any mutating event after `Apply(GameLocked)` throws `DomainException`
- [x] T043 [P] [US2] Write failing unit tests for `GameAggregate` lineup in `api/Roster.Domain.Tests/Aggregates/GameAggregateTests.cs`: `Apply(BattingOrderSet)` replaces batting order; `Apply(InningFieldingAssigned)` replaces assignments for that inning; `Apply(InningFieldingAssigned)` with two players sharing the same non-Bench position throws `DomainException`; Bench shared by multiple players is valid
- [x] T044 [P] [US2] Write failing unit tests for command handlers in `api/Roster.Application.Tests/Commands/`: `CreateGameCommandHandler` emits `GameCreated`; `MarkPlayerAbsentCommandHandler` emits `PlayerMarkedAbsent`; `SetBattingOrderCommandHandler` emits `BattingOrderSet`; `SetBattingOrderCommandHandler` rejects absent or inactive players; `AssignInningFieldingCommandHandler` emits `InningFieldingAssigned`; `AssignInningFieldingCommandHandler` rejects if game is locked; `LockGameCommandHandler` emits `GameLocked`

### Implementation for US2

- [x] T045 [US2] Implement full `GameAggregate` in `api/Roster.Domain/Aggregates/GameAggregate.cs`: `Apply` methods for all 6 game events; enforce `IsLocked` guard on all mutating events; enforce no duplicate non-Bench positions in `Apply(InningFieldingAssigned)`. Confirm T042 + T043 GREEN.
- [x] T046 [P] [US2] Implement `CreateGameCommand` + handler in `api/Roster.Application/Commands/CreateGame/`: validates inning count 1–12, emits `GameCreated`. Confirm relevant T044 tests GREEN.
- [x] T047 [P] [US2] Implement `MarkPlayerAbsentCommand` + `RevokePlayerAbsenceCommand` + handlers in `api/Roster.Application/Commands/MarkPlayerAbsent/` and `RevokePlayerAbsence/`: validate player exists on team; emit respective events. Confirm relevant T044 tests GREEN.
- [x] T048 [P] [US2] Implement `SetBattingOrderCommand` + handler in `api/Roster.Application/Commands/SetBattingOrder/`: validate all players are active and non-absent; no duplicate IDs; emit `BattingOrderSet`. Confirm relevant T044 tests GREEN.
- [x] T049 [US2] Implement `AssignInningFieldingCommand` + handler in `api/Roster.Application/Commands/AssignInningFielding/`: validate inning number ≤ game's inning count; validate all active non-absent players present exactly once; validate no two non-Bench players share a position; validate all non-Bench positions are valid for the team's sport; emit `InningFieldingAssigned`. Confirm relevant T044 tests GREEN.
- [x] T050 [P] [US2] Implement `LockGameCommand` + handler in `api/Roster.Application/Commands/LockGame/`: validate game is not already locked; emit `GameLocked`. Confirm relevant T044 tests GREEN.
- [x] T051 [US2] Implement `GetGameQuery` + `GetGamesQuery` + handlers in `api/Roster.Application/Queries/GetGame/` and `GetGames/`: read from `IInMemoryStore`; include inningAssignments and battingOrder in GetGame response
- [x] T052 [US2] Implement `GamesController` in `api/Roster.Api/Controllers/GamesController.cs`: all 9 game endpoints per contracts/api.md; catch `EventStoreUnavailableException` → 503; `[ProducesResponseType]` on all actions including 409 for locked-game attempts
- [x] T053 [US2] Implement `ui/src/pages/GamePage.tsx` + `ui/src/components/game/`: GameHeader (date, opponent, lock button), AbsenceToggle (per player), BattingOrderList (reorderable), InningFieldingGrid (tab per inning, 10 position slots + bench assignments, client-side duplicate position warning); `ui/src/hooks/useGame.ts` with all game mutations and queries; run `npm run generate-client` after GamesController is implemented

**Checkpoint**: US2 independently testable. Full 6-inning game card — batting order + all fielding assignments — can be created, edited, and locked end-to-end.

---

## Phase 6: User Story 3 — Season Playing Time Balance View (Priority: P3)

**Goal**: A coach views a player × position matrix showing total innings at each position (including Bench) across all games.

**Independent Test**: After 5 recorded games, open the balance view and verify the matrix shows correct inning counts and zero-count cells are visually distinct.

### Tests for US3 — Write FIRST, confirm RED before any implementation

- [x] T054 [P] [US3] Write failing unit tests for `GetBalanceMatrixQueryHandler` in `api/Roster.Application.Tests/Queries/GetBalanceMatrixQueryHandlerTests.cs`: given 3 games with known inning assignments, verify player row counts are correct; verify Bench appears as a key in Counts; verify zero-count positions are present with value 0 (not absent from the dictionary); verify inactive players still appear (historical record)

### Implementation for US3

- [x] T055 [US3] Implement `GetBalanceMatrixQuery` + handler in `api/Roster.Application/Queries/GetBalanceMatrix/`: iterate `IInMemoryStore.GetGamesForTeam`, sum `InningAssignments` per player per position including Bench; initialise all sport positions + Bench to 0 for each player so no nulls in response. Confirm T054 GREEN.
- [x] T056 [US3] Implement `BalanceController` in `api/Roster.Api/Controllers/BalanceController.cs`: `GET /teams/{teamId}/balance` → 200 with full matrix per contracts/api.md; `[ProducesResponseType]`
- [x] T057 [US3] Implement `ui/src/pages/BalancePage.tsx` + `ui/src/components/balance/BalanceMatrix.tsx`: sticky player-name column, position columns (all 10 + Bench), zero-count cells visually highlighted; column filter dropdown (show one position at a time, sorted fewest-first); `ui/src/hooks/useBalance.ts` with `useGetBalance` query; run `npm run generate-client` after BalanceController is implemented

**Checkpoint**: Full feature complete. All 4 user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T058 [P] Write integration test for `AggregateReplayService` in `api/Roster.Infrastructure.Tests/InMemory/AggregateReplayServiceTests.cs` using Testcontainers (`Testcontainers.Redpanda`): publish 5 known events to Redpanda, start `AggregateReplayService`, assert `IsReady = true` and `InMemoryStore` reflects all events correctly
- [ ] T059 [P] Write integration test for Redpanda retry/503 behaviour in `api/Roster.Infrastructure.Tests/EventStore/RedpandaEventStoreTests.cs` using Testcontainers: stop Redpanda mid-publish, assert `EventStoreUnavailableException` is thrown after < 5 seconds; verify no partial events persisted
- [ ] T060 [P] Write contract tests in `api/Roster.Api.Tests/` using `WebApplicationFactory` + `Microsoft.AspNetCore.Mvc.Testing`: verify all endpoints return correct HTTP status codes per contracts/api.md; verify OpenAPI spec is reachable at `/swagger/v1/swagger.json`; seed in-memory store with test data
- [ ] T061 [P] Add structured logging via `Microsoft.Extensions.Logging` throughout `api/`: log event published (teamId, eventType), replay start/complete (event count, duration), aggregate-not-found 404, domain validation failures, Redpanda retry attempts; avoid logging `AccessSecretHash` or raw secrets
- [x] T062 Export `openapi.json` to repo root on API startup (via `IStartupFilter` or a post-build step) so orval can consume it without a live server; add `npm run generate-client` script to `ui/package.json` that reads `../openapi.json`
- [ ] T063 Run quickstart.md validation checklist end-to-end: `docker compose up -d redpanda`, `dotnet run --project api/Roster.Api`, `npm run generate-client --prefix ui`, `npm run dev --prefix ui`; verify all checklist items pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — blocks all user stories
- **Phase 3 (US0)**: Depends on Phase 2
- **Phase 4 (US1)**: Depends on Phase 2; independent of US0 (different aggregate methods)
- **Phase 5 (US2)**: Depends on Phase 2 and US1 (needs player IDs to validate absence/batting)
- **Phase 6 (US3)**: Depends on Phase 5 (needs game/fielding data to compute balance)
- **Phase 7 (Polish)**: Depends on all user stories complete

### Within Each User Story

1. Test tasks MUST be written and confirmed RED first (constitution IV)
2. Aggregate `Apply` methods before command handlers
3. Command handlers before controllers
4. Controllers before UI hooks and pages
5. `npm run generate-client` after each controller batch

### Parallel Opportunities

- T004, T005, T006, T007, T010, T011 — all Phase 1 setup tasks are independent
- T013, T014, T015, T016 — domain primitives are independent of each other
- T020, T021 — health check and middleware are independent
- T025, T026 — US0 test tasks are independent
- T033, T034 — US1 test tasks are independent
- T036, T037, T038 — US1 handler implementations are independent after T035
- T042, T043, T044 — US2 test tasks are independent
- T046, T047, T048 — US2 handler implementations are independent after T045
- T058, T059, T060, T061 — all polish tasks are independent

---

## Implementation Strategy

### MVP (US0 only — Team Creation)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational)
3. Complete Phase 3 (US0)
4. **STOP & VALIDATE**: Team creation works; API replays events on restart; localStorage persists secret

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. US0 → team creation and secret-based access ✅
3. US1 → roster management ✅ (demo-able to coach)
4. US2 → game lineup creation ✅ (core value delivered)
5. US3 → balance matrix ✅ (full feature complete)
6. Polish → integration tests, logging, contract tests

---

## Notes

- `[P]` = different files, no blocking dependencies — safe to parallelise
- `[Story]` label maps each task to a user story for traceability
- Each story phase is independently deployable and demonstrable
- TDD: always commit the failing test before the implementation
- `npm run generate-client` must be re-run after any controller change
- Redpanda connection details come from environment variables, never hardcoded
- `infra/` tasks tracked separately — do not begin ECS deployment until a
  dedicated infra tasks.md is created (`specs/002-infrastructure/tasks.md`)

---

## Future UI Test Opportunities

*(No UI tests in this iteration — tracked here for a future testing sprint)*

When UI tests are added, the highest-value targets in priority order:

| Component | Test type | What to test |
|---|---|---|
| `ui/src/hooks/useGame.ts` — position conflict detection | Vitest unit | Client-side duplicate position validation fires before API call; Bench duplicates allowed |
| `ui/src/components/game/InningFieldingGrid.tsx` | React Testing Library | Correct positions rendered; absent players excluded; copy-from-previous-inning populates correctly |
| `ui/src/components/balance/BalanceMatrix.tsx` | React Testing Library | Zero cells highlighted; column filter sorts by fewest innings; Bench column present |
| `ui/src/pages/Landing.tsx` | React Testing Library | localStorage read on mount auto-redirects; invalid secret shows error; create team form validation |
| `ui/src/hooks/useRoster.ts` | Vitest unit | `useAddPlayer` mutation invalidates roster query cache on success |
| Full coach workflow | Playwright E2E | Create team → add players → create game → assign innings → lock → view balance |
