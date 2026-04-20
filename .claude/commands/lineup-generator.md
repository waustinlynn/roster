---
description: Generate a fair-rotation defensive lineup CSV for 8U softball. Enforces per-player infield minimums, weights assignments by analysis data and game remarks, and writes the exact import CSV format.
---

## User Input

```text
$ARGUMENTS
```

Parse arguments:
- If a game date (`YYYY-MM-DD`) or opponent name is given → use that game's `inningCount`; default to 6 if the game isn't found.
- If `preview` appears → print the grid to the conversation but do **not** write the CSV file.
- If no arguments → target the most recently created game (by event order); write the file.

---

## Step 1: Load State

> **If this skill was invoked from `softball-analyst`**, state (players, games, analysis scores, remarks) is already built — skip directly to Step 2 and use that state.

Otherwise, load events from Kafka:

```bash
kcat -b localhost:9092 -t roster-events -e -q
```

If the connection is refused, inform the user that Redpanda is not running and suggest `docker compose up -d`. Do not proceed.

Reconstruct state exactly as described in the `softball-analyst` skill's Step 2:
- **Players**: `{ playerId, name, isActive, skills: { Hitting, Throwing, Catching } }`
- **Games**: `{ gameId, date, opponent, inningCount, isLocked, battingOrder[], fieldingByInning, scoreByInning, remark }`
  - `GameRemarkRecorded` → set `remark = Remark` (latest wins)
  - `GameScoresRecorded` → record all inning scores in batch

Resolve all player IDs to names before proceeding.

---

## Step 2: Identify Target Game and Available Players

1. Match the user's argument to a game by date or opponent name (case-insensitive substring match). If no argument, take the last game by event order.
2. Note: `inningCount`, `battingOrder` (the ordered player list for batting), and `remark`.
3. **Available players** = active players NOT in the game's `absentPlayerIds`. If `battingOrder` is set, use that order for the CSV rows (batting order defines row order). If not set, sort by `Hitting` skill descending.
4. Let `N` = number of available players.
5. Let `I` = `inningCount`.

---

## Coach-Pitch Context (8U)

This is **8U coach-pitch softball**. The coach (not a player) throws pitches. This fundamentally changes how positions are valued:

- **Pitcher**: The player at P does not pitch. Their job is to **field comebackers and ground balls and throw to 1B for the out**. Throwing is by far the most important skill. Catching (soft hands to field the ball cleanly) matters secondarily. This is still the highest-value defensive position.
- **Catcher**: With no live pitcher, there are **no wild pitches to block**. The catcher's job is primarily to receive throws back from the field and back up plays at the plate. This is the **lowest-value infield-adjacent position** — place a solid but not elite defender here.
- **Position priority (high → low)**: P → 1B → SS → 3B → 2B → C → Outfield

Do not contradict these fundamentals anywhere in the analysis or assignments.

---

## Step 3: Score Each Player at Each Position

For every player, compute a **fitness score** (0–100) for each position. Use this scale:

### Base skill score by position

| Position    | Primary skill | Weight | Secondary skill | Weight | Notes |
|-------------|--------------|--------|----------------|--------|-------|
| P           | Throwing     | 80     | Catching       | 20     | Coach pitches — P fields comebackers and throws to 1B |
| 1B          | Catching     | 80     | Throwing       | 20     | Receives nearly every infield throw |
| SS          | Throwing     | 70     | Catching       | 30     | Longest routine throw at 8U |
| 3B          | Catching     | 65     | Throwing       | 35     | 3B→1B throw is 80+ ft — fielding cleanly matters more |
| 2B          | Throwing     | 55     | Catching       | 45     | Shortest infield throw; most achievable at 8U |
| C           | Catching     | 55     | Throwing       | 45     | Coach pitch: no wild pitches; primary job is receiving and backing up |
| LF/LC/RC/RF | Catching     | 60     | Throwing       | 40     | Limit extra bases; outfield Throwing rarely produces outs at 8U |

Base score = `(primary_skill / 5 × primary_weight) + (secondary_skill / 5 × secondary_weight)`

This produces a score in [0, 100].

### Historical bonus (from analysis data, if available)

For each player-position pair that has historical fielding data from prior games:
- Count `shutdown_good` innings and `rough_bad` innings at that position.
- `historicalBonus = (shutdown_good / (shutdown_good + rough_bad)) × 20`  (capped at +20)
- If fewer than 2 data points, set `historicalBonus = 0` (insufficient data).

### Remark bonus

Parse the game's `remark` field (if present). For any player named **positively** at a position (e.g. "Bailey pitched well", "Kiara excelled at 3B"):
- Add **+25** to that player's fitness score at that position.
- This override reflects coach-observed ground truth and intentionally outweighs statistical noise.

### Final score

`fitnessScore[player][position] = baseScore + historicalBonus + remarkBonus`

---

## Step 4: Compute Per-Player Infield Targets

Infield positions: **P, 1B, 2B, SS, 3B** (5 positions per inning).

Total infield slots across the game: `totalInfieldSlots = 5 × I`

Hard minimum per player: **2 infield innings** (no exceptions).
Soft maximum per player: **3 infield innings** (may be exceeded only when math requires it — e.g. very small rosters).

Compute target infield innings per player:
1. Start each player at `target = 2` (the hard minimum).
2. Remaining infield slots to distribute: `remaining = totalInfieldSlots - (N × 2)`
3. Sort players by their **average infield fitness score** (P + 1B + SS + 3B + 2B) descending.
4. Distribute one extra infield inning to each player in order until `remaining = 0`.
   - Cap each player at 3 unless `remaining > 0` after a full pass at cap 3, in which case allow cap 4 for the top players (rare, small rosters only).

Record `infieldTarget[player]` = the target infield innings for each player.

---

## Step 5: Build the Assignment Grid — Inning by Inning

Build a grid `assignment[inning][position] = playerName` and track `infieldCount[player]`.

### Inning processing order

- **Innings 1 through `ceil(I/2)`** ("early innings"): prioritize strongest players at key positions.
- **Innings `ceil(I/2)+1` through `I`** ("late innings"): rotate weaker players and ensure minimums are met.

### Position fill order within each inning

Fill positions in this order for every inning: **P → 1B → SS → 3B → 2B → C → outfield slots → BENCH**

Outfield slots to fill per inning = `N - 6` (the 6 infield+catcher spots). Outfield positions to use, in order of preference: LC, LF, RC, RF. If `N < 9`, some outfield slots may not exist; if `N > 9`, extras go to BENCH.

Wait — actually compute field slots precisely:
- Infield + C = 6 positions (P, 1B, 2B, 3B, SS, C)
- Outfield slots = `min(N - 6, 4)` using LC, LF, RC, RF in that order
- BENCH slots = `max(N - 10, 0)`

Every inning, **every player appears exactly once** and **every position appears at most once** (BENCH may appear multiple times if `N > 10`).

### Player selection rule (greedy with lookahead)

For each position in the fill order:

1. **Eligibility filter**: exclude players already assigned in this inning.
2. **Infield constraint**:
   - If filling an infield position: prefer players where `infieldCount[player] < infieldTarget[player]`. If all eligible players already meet their target, still pick the best available (the soft cap can flex).
   - If filling a non-infield position: prefer players who have already met their `infieldTarget` for infield. But **never assign a non-infield position to a player if doing so would make it mathematically impossible for them to reach their infield minimum** in the remaining innings.
     - Check: `infieldCount[player] + remaining_innings_for_player ≥ infieldTarget[player]`. If this constraint would be violated by assigning them to a non-infield slot, skip them and pick the next best.
3. **Score-based selection**: among all eligible players passing the constraint check, pick the one with the highest `fitnessScore[player][position]`.
4. Assign, increment `infieldCount[player]` if the position is infield.

### Early vs. late inning strategy

- **Early innings (1 to ceil(I/2))**: when picking for P, 1B, SS — bias toward highest-fitness players even if they already have infield time. The constraint check still applies.
- **Late innings**: when picking for P, 1B, SS — among eligible players, prefer those whose `infieldCount` is farthest below their `infieldTarget` to ensure even distribution.

---

## Step 6: Validate the Grid

After building the full grid, run these checks:

1. **No duplicates**: each position appears exactly once per inning (BENCH excepted). If a duplicate exists, it is a bug in Step 5 — log the conflict and resolve by swapping the conflicting player to an open slot.
2. **Infield minimum met**: every player has `infieldCount[player] ≥ 2`. If any player is short, find the inning where they are in the least important outfield/bench slot and a player with `infieldCount > 3` is in an infield slot — swap them. Repeat until satisfied.
3. **Every player appears exactly once per inning**: no player is missing or double-booked.

Log any swaps made during validation with a brief note explaining why.

---

## Step 7: Write the CSV

Format the grid as a CSV exactly matching the import format:

```
Player,1,2,3,4,5,6
PlayerName,P,1B,SS,2B,3B,LF
PlayerName,C,P,1B,SS,2B,3B
```

Rules:
- Row 1: `Player` followed by inning numbers `1` through `I`.
- Rows 2+: player name (exactly as stored), then the position abbreviation for each inning in order.
- Row order: follow the `battingOrder` from the game. If no batting order exists, sort by `Hitting` skill descending.
- Player names must match the stored names exactly (they are used as import keys).

**Position abbreviations:**

| Abbreviation | Full Name          |
|--------------|--------------------|
| P            | Pitcher            |
| C            | Catcher            |
| 1B           | 1st Base           |
| 2B           | 2nd Base           |
| 3B           | 3rd Base           |
| SS           | Shortstop          |
| LF           | Left Field         |
| LC           | Left-Centre Field  |
| RC           | Right-Centre Field |
| RF           | Right Field        |
| BENCH        | Bench              |

Unless `preview` was requested, write the CSV to:
```
recommended-lineup-<YYYY-MM-DD>.csv
```
using today's date. Confirm the file path after writing.

---

## Step 8: Print Summary

After writing the file (or in preview mode, instead of writing), print the lineup grid as a readable table, then list:

- **Infield innings per player**: a row for each player showing how many infield innings they received and at which positions.
- **Constraint check**: confirm every player hit their infield minimum. Call out any player who received more than 3 infield innings and explain why.
- **Key placement rationale**: 1–2 sentences per priority position (P, 1B, SS) naming the players assigned in innings 1–3 and why (skill score, historical performance, or remark bonus).

---

## Constraints Reference (do not violate)

| Rule | Type | Detail |
|------|------|--------|
| Infield minimum | **Hard** | Every player ≥ 2 infield innings (P, 1B, 2B, SS, 3B). No exceptions. |
| Infield maximum | **Soft** | Every player ≤ 3 infield innings. May exceed only when roster math forces it. |
| No position duplicates | **Hard** | Each non-BENCH position assigned to exactly one player per inning. |
| Every player appears once per inning | **Hard** | No player double-booked; no player missing from any inning. |
| Remark overrides stats | **Hard** | Coach remarks about a player excelling at a position must boost that assignment above what raw data alone would suggest. |
| Fair play | **Guidance** | Lean toward rotation; avoid concentrating all infield time on a few players unless skill gap is extreme. |
| Position priority | **Guidance** | Coach-pitch 8U: P is highest value (fielding/throwing to 1B), then 1B, SS, 3B, 2B. Catcher is lowest-value infield-adjacent position — no wild pitches to block. Place solid but not elite defenders at C. |
| Throwing > Catching at P | **Hard** | The pitcher in coach-pitch does not throw pitches. Score Throwing at 80% weight for P. Never place a high-Catching / low-Throwing player at P over a high-Throwing / low-Catching player. |
