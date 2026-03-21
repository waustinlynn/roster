# Data Model: Youth Sports Roster Management

## Aggregates

Aggregates are the in-memory units of consistency. They are rebuilt on API startup by
replaying all domain events from the Redpanda event log. Each aggregate is an append-only
projection of its events; no aggregate is ever persisted to a traditional database.

---

### TeamAggregate

The root aggregate. Encompasses team identity, the full player roster, and all skill
ratings. All games for a team are stored in separate `GameAggregate` instances but are
linked by `TeamId`.

```
TeamAggregate
├── TeamId            : Guid           (immutable, set by TeamCreated)
├── Name              : string         (non-empty, max 100 chars)
├── Sport             : Sport          (value object — see below)
├── AccessSecretHash  : string         (SHA-256 of the plaintext secret; never reversed)
├── Players           : List<Player>
│   └── Player
│       ├── PlayerId     : Guid
│       ├── Name         : string      (non-empty, max 100 chars)
│       ├── Skills       : Dictionary<string, SkillRating>
│       │                  (key = skill name defined by Sport, value = 1–5)
│       └── IsActive     : bool        (false after PlayerDeactivated event)
└── Version           : int            (event count; used for optimistic concurrency later)
```

**Invariants enforced by the aggregate:**
- `AccessSecretHash` is set exactly once (on `TeamCreated`); subsequent events cannot
  change it.
- Player names need not be unique (coaches may have two players with the same name —
  they are distinguished by PlayerId).
- A deactivated player cannot have skill ratings updated.

**Events that mutate TeamAggregate** (applied in sequence):

| Event | Mutation |
|---|---|
| `TeamCreated` | Sets TeamId, Name, Sport, AccessSecretHash |
| `PlayerAdded` | Appends Player with empty Skills |
| `PlayerSkillRated` | Sets or updates one entry in Player.Skills |
| `PlayerDeactivated` | Sets Player.IsActive = false |

---

### GameAggregate

One aggregate per game. Holds the batting order, per-inning fielding assignments, absence
list, and locked state. Scoped to a team via `TeamId`.

```
GameAggregate
├── GameId            : Guid           (immutable, set by GameCreated)
├── TeamId            : Guid           (immutable link to TeamAggregate)
├── Date              : DateOnly
├── Opponent          : string?        (optional, max 100 chars)
├── InningCount       : int            (1–12; default 6)
├── IsLocked          : bool           (true after GameLocked event; no further mutations)
├── AbsentPlayerIds   : HashSet<Guid>
├── BattingOrder      : List<Guid>     (ordered player IDs; last BattingOrderSet wins)
└── InningAssignments : Dictionary<int, List<FieldingAssignment>>
    └── FieldingAssignment
        ├── PlayerId  : Guid
        └── Position  : Position       (fielding position or Bench)
```

**Invariants enforced by the aggregate:**
- Once `IsLocked = true`, any command that emits a mutating event MUST be rejected with
  a domain error before emission.
- `InningAssignments[n]` contains exactly one `FieldingAssignment` per active, non-absent
  player for that inning (when the assignment is submitted — partial innings are allowed
  during entry but must be complete before saving).
- No two `FieldingAssignment` entries in the same inning may share the same non-Bench
  `Position`. Bench may appear multiple times.
- `BattingOrder` may contain all available players (present, active) in any order.

**Events that mutate GameAggregate** (applied in sequence):

| Event | Mutation |
|---|---|
| `GameCreated` | Sets GameId, TeamId, Date, Opponent, InningCount |
| `PlayerMarkedAbsent` | Adds PlayerId to AbsentPlayerIds |
| `PlayerAbsenceRevoked` | Removes PlayerId from AbsentPlayerIds |
| `BattingOrderSet` | Replaces BattingOrder with the new ordered list |
| `InningFieldingAssigned` | Replaces InningAssignments[inning] with new list |
| `GameLocked` | Sets IsLocked = true |

---

## Value Objects

Value objects are immutable and validated at construction time. They live in
`Roster.Domain/ValueObjects/`.

### Position

```
Position
├── Name  : string   (non-empty; one of the sport's defined positions or "Bench")
└── IsBench : bool   (derived: true when Name == "Bench")
```

Equality is by `Name` (case-insensitive). The set of valid non-Bench positions is
defined by the `Sport` value object, not by `Position` itself.

### SkillRating

```
SkillRating
└── Value : int   (1–5 inclusive; throws DomainException outside range)
```

### Sport

```
Sport
├── Name       : string
├── Skills     : IReadOnlyList<string>    (ordered list of skill names)
└── Positions  : IReadOnlyList<string>    (ordered list of valid fielding position names)
```

Softball (the seed sport, loaded at startup):
```
Sport {
  Name = "Softball",
  Skills = ["Hitting", "Catching", "Throwing"],
  Positions = [
    "Pitcher", "Catcher",
    "1st Base", "2nd Base", "3rd Base", "Shortstop",
    "Left Field", "Left-Centre Field", "Right-Centre Field", "Right Field"
  ]
}
```

"Bench" is NOT in `Positions` — it is a system-level special value defined by the
`Position` value object. Every sport implicitly supports Bench.

---

## Domain Events

All events inherit from `DomainEvent` (abstract base). Events are serialized to JSON
and published to Redpanda. They are **immutable records** — never modified after
emission.

### Base Record

```
DomainEvent (abstract)
├── EventId    : Guid         (new Guid per event)
├── TeamId     : Guid         (partition key for Kafka; all events for a team go here)
├── OccurredAt : DateTimeOffset
└── EventType  : string       (discriminator for polymorphic deserialization)
```

### Team Events

```
TeamCreated : DomainEvent
├── Name             : string
├── SportName        : string
└── AccessSecretHash : string   (SHA-256 hex; plaintext is NEVER stored)

PlayerAdded : DomainEvent
├── PlayerId : Guid
└── Name     : string

PlayerSkillRated : DomainEvent
├── PlayerId  : Guid
├── SkillName : string
└── Rating    : int      (1–5)

PlayerDeactivated : DomainEvent
└── PlayerId : Guid
```

### Game Events

```
GameCreated : DomainEvent
├── GameId      : Guid
├── Date        : string        (ISO 8601 date: "2026-04-12")
├── Opponent    : string?
└── InningCount : int

PlayerMarkedAbsent : DomainEvent
├── GameId   : Guid
└── PlayerId : Guid

PlayerAbsenceRevoked : DomainEvent
├── GameId   : Guid
└── PlayerId : Guid

BattingOrderSet : DomainEvent
├── GameId           : Guid
└── OrderedPlayerIds : List<Guid>   (complete, ordered batting list)

InningFieldingAssigned : DomainEvent
├── GameId       : Guid
├── InningNumber : int
└── Assignments  : List<{ PlayerId: Guid, Position: string }>
                   (complete assignment for this inning; "Bench" is a valid position)

GameLocked : DomainEvent
└── GameId : Guid
```

---

## In-Memory Store

Lives in `Roster.Infrastructure/InMemory/InMemoryStore.cs`. Singleton in the DI
container. Implements both `ITeamRepository` and `IInMemoryStore`.

```
InMemoryStore
├── _teams   : ConcurrentDictionary<Guid, TeamAggregate>      (keyed by TeamId)
├── _games   : ConcurrentDictionary<Guid, GameAggregate>      (keyed by GameId)
└── _secrets : ConcurrentDictionary<string, Guid>             (secretHash → TeamId)

Methods (ITeamRepository):
├── GetByIdAsync(Guid teamId) → TeamAggregate?
├── GetBySecretHashAsync(string hash) → TeamAggregate?
└── Apply(DomainEvent e) → void   (routes event to correct aggregate; creates if needed)

Methods (IInMemoryStore — read-only, used by query handlers):
├── GetTeam(Guid teamId) → TeamAggregate?
├── GetGame(Guid gameId) → GameAggregate?
└── GetGamesForTeam(Guid teamId) → IEnumerable<GameAggregate>
```

**Thread safety**: `ConcurrentDictionary` is used throughout. Events are applied
single-threaded by `AggregateReplayService` during startup. After replay, events are
applied one at a time as commands are processed (no concurrent writes in v1).

---

## Kafka Topic Design

**Topic**: `roster-events`

**Partitioning key**: `TeamId` (string representation of the Guid)
All events for one team land on the same partition, guaranteeing per-team ordering.

**Message format**:
```json
{
  "eventType": "PlayerAdded",
  "eventId": "...",
  "teamId": "...",
  "occurredAt": "2026-04-12T19:30:00Z",
  "playerId": "...",
  "name": "Jane Smith"
}
```

**Consumer group** (for live consumption after replay):
`roster-api-{instanceId}` — each API instance uses a unique consumer group so it
receives all events (no load-balancing between instances; each instance maintains its
own complete in-memory state).

**Replay on startup** (`AggregateReplayService`):
1. Create a consumer with `auto.offset.reset = earliest`, `enable.auto.commit = false`.
2. Assign all partitions of `roster-events` manually.
3. Consume to the watermark (end offset at replay start time); stop consuming when
   caught up.
4. Apply each event to `InMemoryStore.Apply()`.
5. Set `_isReady = true` on the readiness flag.
6. Switch to live consumption mode (commit offsets; continue consuming new events).
7. `AggregateReadinessCheck` returns `Healthy` once step 5 completes.

---

## Derived Read Model: PositionSummary

Not stored separately — computed on demand by `GetBalanceMatrix` query handler by
iterating over all `GameAggregate` instances for a team.

```
PositionSummary (computed, not persisted)
└── Rows : List<PlayerPositionRow>
    └── PlayerPositionRow
        ├── PlayerId   : Guid
        ├── PlayerName : string
        └── Counts     : Dictionary<string, int>   (position name → inning count)
                         Includes "Bench" as a key.
```

Computation: for each `GameAggregate` in the team, iterate `InningAssignments`, sum
each player's position occurrences. O(games × innings × players) — trivially fast
for v1 data volumes.
