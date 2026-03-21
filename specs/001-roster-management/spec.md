# Feature Specification: Youth Sports Roster Management

**Feature Branch**: `001-roster-management`
**Created**: 2026-03-17
**Status**: Draft
**Input**: User description: "This will be a roster setting application for youth sports leagues..."

## User Scenarios & Testing *(mandatory)*

### User Story 0 - Team Creation & Setup (Priority: P0)

A coach creates a new team by providing a team name and selecting the sport. The system
generates a shareable access secret that the coach uses to access the team from any device.
All subsequent data — players, games, and balance statistics — belongs to this team. A team
represents a single continuous period of play (there is no separate "season" concept; if a
coach wants to start a new season, they create a new team).

**Why this priority**: Team creation is the prerequisite for every other workflow. Without
a team, there is no context in which to add players or record games.

**Independent Test**: A coach can create a team named "Thunderbolts" for softball, receive
an access secret, and immediately access an empty roster — with no other features required.

**Acceptance Scenarios**:

1. **Given** no existing team, **When** the coach creates a team with a name and sport,
   **Then** the team is created with a generated access secret displayed to the coach.
2. **Given** a team access secret, **When** the coach presents it on a subsequent visit,
   **Then** full access to that team's data is granted and the secret is stored in the
   browser so future visits auto-load the team.
3. **Given** a previously accessed team stored in the browser, **When** the coach opens
   the application, **Then** that team's data loads directly without requiring the coach
   to re-enter the access secret.
4. **Given** a loaded team, **When** the coach chooses to switch teams, **Then** they are
   returned to the landing page where they can enter a different access secret.
5. **Given** an incorrect or missing access secret, **When** any team data is requested,
   **Then** the request is rejected with an appropriate error.

---

### User Story 1 - Roster Setup & Player Skill Ratings (Priority: P1)

A coach builds their team roster by manually adding players one at a time, then assigning
each player skill ratings (1–5) for each sport-specific skill. For softball, those skills
are hitting, catching, and throwing. With a complete, rated roster, the coach has the
foundation to make informed lineup decisions for every game.

**Why this priority**: Nothing else in the system is useful without a roster. This is the
entry point for all downstream workflows — lineup creation and position tracking all depend
on having players with skill data.

**Independent Test**: A coach can manually add 15 players, assign skill ratings to all of
them, and view the complete rated roster — delivering a usable team profile with no other
features needed.

**Acceptance Scenarios**:

1. **Given** an existing player in the roster, **When** the coach assigns a hitting rating
   of 3, a catching rating of 5, and a throwing rating of 2, **Then** those ratings are
   saved and displayed on the player's profile.
2. **Given** a roster with 15 players, **When** the coach views the team roster,
   **Then** all players are listed with their current skill ratings visible at a glance.

---

### User Story 2 - Game Lineup Creation (Priority: P2)

Before each game, a coach creates a game record (date, optional opponent, and number of
innings). They set the batting order once for the game, then assign fielding positions
inning-by-inning — players are expected to rotate positions throughout the game. While
assigning positions for each inning, the system displays each player's season inning-count
per position alongside their skill ratings. Players can be marked as absent and excluded
from the lineup for that game.

**Why this priority**: Setting the game lineup is the primary recurring action coaches take
throughout the season. It directly produces the inning-level playing-time data used for
balance tracking. Games remain editable to accommodate real-game changes (plans vs actuals)
until the coach explicitly locks the record.

**Independent Test**: A coach can create a 6-inning game, mark one player absent, set a
full batting order, assign 10 fielding positions for each of the 6 innings, and save the
lineup — producing a complete, printable game card with inning-by-inning positions.

**Acceptance Scenarios**:

1. **Given** a team with 12 active players, **When** the coach creates a new game and sets
   the batting order, **Then** all 12 players are assignable to batting slots and the saved
   order is reflected in the game record.
2. **Given** a game with a saved batting order, **When** the coach assigns fielding
   positions for inning 1, **Then** each player shows their season inning-count per
   position next to their name to inform the assignment.
3. **Given** fielding positions assigned for inning 1, **When** the coach moves to
   inning 2, **Then** the previous inning's assignments are shown as a starting point
   and can be adjusted for the new inning.
4. **Given** a player marked absent for a game, **When** the coach views the lineup
   builder, **Then** that player does not appear in the available pool for batting or
   fielding slots in any inning.
5. **Given** a completed game lineup with all innings assigned, **When** the coach saves
   it, **Then** each inning's position assignments are recorded individually and
   team inning-totals per position update immediately.
6. **Given** a saved game whose actuals are confirmed, **When** the coach locks the game,
   **Then** the game is marked as locked and no further edits to that game are permitted.
7. **Given** a locked game, **When** the coach attempts to edit any part of it,
   **Then** the system rejects the change and displays a clear message that the game
   is locked.

---

### User Story 3 - Season Playing Time Balance View (Priority: P3)

A coach reviews a team-wide dashboard showing how many innings each player has been
assigned to each fielding position — including Bench — across all recorded games. The view
highlights which players have had limited exposure to specific positions (or excessive bench
time), making it easy to identify who needs more variety. This information is available both
as a summary (player × position matrix, with Bench as a column) and filtered by individual
player.

**Why this priority**: This is the analytical payoff of tracking lineups game by game.
Coaches need this view to fulfil the goal of fair, balanced participation.

**Independent Test**: After recording 5 games (each with 6 innings of fielding), a coach
can open the balance dashboard and see a complete position-distribution matrix showing
inning counts per player per position, immediately identifying the player who has caught
the fewest innings.

**Acceptance Scenarios**:

1. **Given** 5 recorded games with complete inning-by-inning fielding assignments,
   **When** the coach opens the season balance view, **Then** a matrix shows every
   player's inning count per position accumulated across all games.
2. **Given** the balance matrix, **When** the coach filters by a specific position (e.g.,
   pitcher), **Then** only that position column is shown, sorted by fewest innings so
   the most-underserved players appear first.
3. **Given** a player who has never played a particular position, **When** that position
   appears in the matrix, **Then** the cell is visually distinct (e.g., highlighted) to
   draw the coach's attention.

---

### Edge Cases

- A game is recorded with fewer players than fielding positions (e.g., only 8 players
  available for a 10-position sport) — system MUST allow lineup creation with unfilled
  positions per inning and flag the gap. Extra players beyond the 10 fielding slots are
  assigned Bench for that inning.
- A player joins the team mid-season — their position history starts from their first
  recorded game; prior games show them as not participating.
- The batting order is different from the fielding roster size (e.g., all 12 players
  bat but only 10 field per inning) — batting order and inning fielding assignments
  are managed independently.
- A coach partially completes inning assignments mid-game (e.g., game is rained out
  after 3 innings) — the system MUST save partial assignments and count only the
  innings actually recorded.
- A team has no recorded games yet — balance view shows the roster with zero counts
  rather than an error.
- Redpanda is temporarily unavailable when a coach submits a write command — the system
  MUST apply a short automatic retry (total window < 5 seconds) before returning
  `503 Service Unavailable`. Read operations (viewing roster, games, balance matrix)
  MUST continue to work unaffected from in-memory state during this window.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow coaches to manually add individual players to a team
  roster with at minimum a name.
- **FR-003**: System MUST allow coaches to assign a numeric skill rating of 1–5 for each
  sport-specific skill per player (for softball: hitting, catching, throwing).
- **FR-004**: System MUST allow coaches to create game records with a date and optional
  opponent name.
- **FR-005**: System MUST allow coaches to mark individual players as absent/unavailable
  for a specific game; absent players MUST be excluded from that game's lineup pool.
- **FR-006**: System MUST allow coaches to set and save a batting order for each game
  (an ordered list of available players).
- **FR-007**: System MUST allow coaches to assign a fielding position to each available
  player on a per-inning basis. A game is divided into innings (number set when creating
  the game) and players may hold different positions in different innings. Each inning's
  assignment is saved independently. "Bench" is a valid assignment for players who do not
  field in a given inning and MUST be treated as a first-class position for tracking
  purposes.
- **FR-008**: System MUST record each player's fielding position assignment per inning per
  game and accumulate inning-counts per position across all games in the season.
- **FR-009**: System MUST display a balance matrix showing, for each player, the total
  number of innings assigned to each fielding position including Bench. Bench innings MUST
  appear in the matrix alongside fielding positions so coaches can see total sitting-out
  time per player at a glance.
- **FR-011**: System MUST define sport types with their own set of skills and fielding
  positions, so that adding a new sport requires no changes to core application logic.
- **FR-012**: System MUST allow coaches to create a team by providing a name and selecting
  a sport. On creation, the system MUST generate and display a unique access secret for
  that team. All players, games, and balance statistics are scoped to that team.
- **FR-016**: A team and a season are the same logical entity. To track a new season, a
  coach creates a new team. There is no "archive" or "season switch" within a single team.
- **FR-013**: System MUST allow coaches to remove a player from the roster or mark them
  as inactive without deleting historical game data.
- **FR-017**: System MUST allow coaches to edit any aspect of a game (batting order,
  absent players, inning assignments) at any time while the game is unlocked.
- **FR-020**: System MUST prevent two players from being assigned the same non-Bench
  fielding position in the same inning. Validation MUST occur at both the presentation
  layer (immediate feedback before submission) and the domain layer (assignments are
  rejected if any conflict is detected server-side).
- **FR-021**: Inning fielding assignments and batting order MUST be committed atomically.
  If validation fails at the domain layer, no changes are persisted and no domain events
  are emitted. Partial saves are not permitted.
- **FR-018**: System MUST provide a "lock game" action that marks a game as final and
  permanently prevents further edits to that game record.
- **FR-019**: System MUST clearly indicate on any locked game that it cannot be edited,
  and MUST reject any edit attempt with an informative error.
- **FR-014**: System MUST restrict access to a team's data to requests that present a
  valid team access secret (a shared token/key configured when the team is created).
  Access MUST be all-or-nothing for this version (no per-user roles).
- **FR-015**: The access-control mechanism MUST be implemented as an isolated layer so
  that it can be replaced with user accounts and role-based permissions in a future
  version without modifying domain or application logic.
- **FR-022**: The application MUST store the most recently used team access secret in the
  browser (e.g., local storage) so that returning visits auto-load the team without
  re-entry. Only one access secret is stored at a time.
- **FR-023**: The application MUST provide a way to return to the landing page from within
  a loaded team, allowing the coach to enter a different access secret and switch teams.

### Key Entities

- **Sport**: A sport type that defines its own set of trackable skills and valid fielding
  positions. Softball defines skills: hitting, catching, throwing; and 10 fielding positions:
  pitcher, catcher, 1st base, 2nd base, 3rd base, shortstop, left field, left-centre field,
  right-centre field, right field. Other sports can be configured with different skill sets
  and position lists without code changes.
- **Team**: The single top-level entity. Represents both the team identity and its period
  of play (i.e., what would traditionally be called a "season"). A team has a name, a sport,
  and a generated access secret. All players, games, and balance statistics belong to a team.
  To start a new season, a coach creates a new team. Designed to support user accounts and
  roles in a future version.
- **Player**: An individual on a team roster. Carries a name and a set of sport-specific
  skill ratings (1–5 per skill). Can be active or inactive; historical data is preserved
  when a player is deactivated.
- **Game**: A single match belonging to a team. Has a date, optional opponent name, a defined
  number of innings, a list of players marked absent, and a locked flag. Games are fully
  editable until the coach explicitly locks them. A locked game is read-only and its
  assignments are considered the final record.
- **Lineup**: The batting order for a specific game — an ordered list of available players.
  Managed independently from fielding assignments.
- **FieldingAssignment**: A player's assignment to a named position for a specific inning
  within a specific game. One record per player per inning per game. Valid positions are
  the sport's defined fielding positions plus the special value "Bench" (for players who
  sit out that inning). This is the atomic unit of playing-time tracking.
- **PositionSummary**: An aggregated view (derived from FieldingAssignments) showing the
  total number of innings each player has been assigned to each position within a team
  (i.e., across all games recorded for that team).

### Domain Events

The system is event-sourced. All state changes are captured as immutable domain events.
Current state is derived by replaying events; no event is ever modified or deleted.
Events are emitted **only** when all validation rules pass — there are no partial or
speculative writes.

**Team events** (aggregate: Team)

| Event | Emitted when | Key data |
|---|---|---|
| `TeamCreated` | A new team is set up | team name, sport, generated access secret |
| `PlayerAdded` | A player is manually added to the roster | player name |
| `PlayerSkillRated` | A skill rating is assigned or updated for a player | player, skill name, rating (1–5) |
| `PlayerDeactivated` | A player is marked inactive | player reference |

**Game events** (aggregate: Game, scoped to a Team)

| Event | Emitted when | Key data |
|---|---|---|
| `GameCreated` | A new game record is created | date, optional opponent, inning count |
| `PlayerMarkedAbsent` | A player is flagged absent for a game | player reference |
| `PlayerAbsenceRevoked` | An absence marking is removed | player reference |
| `BattingOrderSet` | A valid, complete batting order is submitted | ordered list of player references |
| `InningFieldingAssigned` | A valid, complete set of fielding assignments for one inning is submitted — no two players share the same non-Bench position | inning number, list of {player, position} pairs (position may be Bench) |
| `GameLocked` | The coach marks a game as final | — |

**Editing**: Re-emitting `BattingOrderSet` or `InningFieldingAssigned` for the same
game/inning supersedes the previous values for that game and inning when state is
projected. `GameLocked` prevents any further events from being accepted for that game.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A coach can manually add a complete team roster of 15 players and assign
  skill ratings to all of them in under 5 minutes.
- **SC-002**: A coach can create a full batting order plus fielding assignments for all
  innings of a 6-inning, 12-player game in under 10 minutes.
- **SC-003**: After saving a game's inning assignments, the season balance matrix updates
  immediately and reflects the new inning counts without any manual refresh.
- **SC-004**: A coach can identify the player with the fewest innings at any given
  position in under 30 seconds using the balance view.
- **SC-005**: The system accurately tracks inning-level position assignments across a full
  20-game season with no data loss or miscounts.
- **SC-006**: Adding a new sport type (with different skills and positions) requires zero
  changes to existing player, game, or balance-tracking logic.

## Assumptions

- "Team" and "season" are synonymous. One team entity covers both team identity and its
  playing period. Starting a new season means creating a new team.
- A single coach accesses one team at a time. The most recently used access secret is
  persisted in the browser; returning visits auto-load that team. The coach can return to
  the landing page to enter a different secret. Multi-team management UI is out of scope.
- Team access is controlled by a single shared secret (token/key) generated at team
  creation. There are no individual user accounts in this version. The access layer is
  designed to be swapped for full user auth + RBAC in a future version without domain
  changes.
- "Playing time balance" is measured by inning-count per position, not clock time.
- Batting order and inning fielding assignments are independent — a player can bat without
  fielding in a given inning (bench situations), and the batting list is typically longer
  than the 10 fielding slots per inning.
- The first sport supported is softball with 10 fielding positions (4 outfielders) and
  3 tracked skills (hitting, catching, throwing). Other sports can be configured without
  code changes.
- There is no calendar-driven season boundary; the team entity itself is the data boundary.
- The number of innings in a game is set by the coach when creating the game record;
  it defaults to 6 for softball but can be changed (e.g., shortened games).
- The event store is a single-node Redpanda instance running in one ECS Fargate task
  (no clustering, no HA guarantee). This is a deliberate cost tradeoff for v1. If the
  Redpanda task restarts (typically < 2 minutes), read operations continue unaffected
  (served from in-memory aggregates); write commands retry automatically for up to 5
  seconds then return `503 Service Unavailable`.
- Event durability is two-tiered: (1) **EFS** — events are durable as soon as Redpanda
  acknowledges the write (EFS is multi-AZ, 99.99% SLA); (2) **S3 via Redpanda Tiered
  Storage** — sealed log segments are uploaded to S3 asynchronously (configurable
  threshold, e.g., 10 minutes or 10 MB). S3 is the disaster-recovery archive, not the
  primary write path. There is no application-level code for S3 writes; Redpanda handles
  this entirely. A small window exists where the most recent events are on EFS but not
  yet on S3; this is acceptable for this use case.

## Clarifications

### Session 2026-03-17

- Q: Is fielding assigned once per game or per-inning? → A: Per-inning; players rotate positions between innings.
- Q: How many fielding positions does the league use? → A: 10 (4 outfielders: left, left-centre, right-centre, right field).
- Q: How is team access controlled? → A: Single shared secret grants full access; auth layer must be replaceable with RBAC later.
- Q: Is CSV import needed? → A: No — manual entry only for this version.
- Q: Is the lineup suggestion feature in scope? → A: No — removed from this version.
- Q: Are "team" and "season" separate entities, and is team/season creation in scope? → A: They are synonymous — one team entity covers both. Team creation is in scope. A new season = a new team.
- Q: Should bench time be explicitly tracked in the balance matrix? → A: Yes — Bench is a first-class assignment alongside fielding positions and appears as a column in the balance matrix.
- Q: Can saved games be edited after saving? → A: Yes — games are fully editable to reflect plan-vs-actual changes, until the coach explicitly locks the game, after which it is read-only.
- Q: How should duplicate position assignments in one inning be handled? → A: Hard block — validated at both UI and domain layers; assignments only persist (events only emit) when fully valid; no partial saves.
- Q: Should the app support accessing multiple teams? → A: One team at a time; most recent access secret stored in browser for auto-load on return; a "switch team" option returns to the landing page to enter a new secret.

### Session 2026-03-17 (infrastructure)

- Q: Write behaviour when Redpanda is temporarily unavailable? → A: Retry automatically for up to 5 seconds, then return 503; reads continue from in-memory aggregates unaffected. Single-node Redpanda, no HA, deliberate cost tradeoff.
