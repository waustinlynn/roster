---
description: Analyze softball defensive lineup strengths and weaknesses across all games using Kafka events and 8U youth softball domain knowledge. Optionally generate a recommended lineup CSV.
---

## User Input

```text
$ARGUMENTS
```

Parse the arguments:
- If `csv` appears → generate a recommended lineup CSV file at the end of the analysis.
- If a specific game is referenced (by date like `2026-05-01` or opponent name like `Tigers`) → use that game's inning count for the CSV, but use the full season for analysis context.
- If no arguments → run full season analysis only.

---

## Step 1: Load All Events from Kafka

Run the following command to consume all events from the beginning of the topic and exit when caught up:

```bash
kcat -b localhost:9092 -t roster-events -e -q
```

If this fails (connection refused), inform the user that Redpanda is not running and suggest `docker compose up -d` from the repo root. Do not proceed.

Each line of output is a JSON object representing one domain event. Collect all lines.

---

## Step 2: Reconstruct Full State from Events

Process events in the order they were emitted. Build the following state:

### Players
Key: `playerId`
Track: `name`, `isActive` (default true), `skills` = `{ Hitting: 0, Throwing: 0, Catching: 0 }`

Events that affect players:
- `PlayerAdded` → register player with name
- `PlayerRenamed` → update name
- `PlayerDeactivated` → set isActive = false
- `PlayerSkillRated` → set `skills[SkillName] = Rating` (1–5)

### Games
Key: `gameId`
Track: `date`, `opponent`, `inningCount`, `isLocked`, `battingOrder[]`, `fieldingByInning` = `{ "1": { position: playerId }, ... }`, `scoreByInning` = `{ "1": { home, away } }`

Events that affect games:
- `GameCreated` → register game
- `GameLocked` → set isLocked = true
- `BattingOrderSet` → record ordered player ID list
- `InningFieldingAssigned` → for each assignment in `Assignments`, map `position → playerId` for that inning
- `InningScoreRecorded` → record `{ homeScore, awayScore }` for that inning

After processing all events, resolve player IDs to names everywhere for readability.

---

## Step 3: Build Defensive Correlation Matrix

For each game, for each inning that has both fielding data AND a recorded score:
- Extract the "away score" for that inning — this is the runs the **opponent** scored, which measures how the defensive lineup performed.
- Record a data point: `{ game, inning, awayRuns, positions: { P: playerName, "1st Base": playerName, SS: playerName, ... } }`

Classify innings:
- **Shutdown inning**: opponent scored 0 runs
- **Good inning**: opponent scored 1–2 runs
- **Rough inning**: opponent scored 3–4 runs
- **Bad inning**: opponent scored 5+ runs

For each priority position (in order: Pitcher, 1st Base, Shortstop, 3rd Base, 2nd Base, Catcher), calculate:
- How many shutdown/good innings did each player have at that position?
- How many rough/bad innings?
- Their skill ratings for reference

---

## Step 4: Produce the Analysis Report

Output the following structured report. Be specific — name players and use numbers. Avoid vague language.

---

### Season Overview

- Total games analyzed, total innings with fielding + score data
- Overall runs allowed: total, per game average, per inning average
- Note any games or innings missing score data (can't be analyzed)

---

### Position-by-Position Analysis

For each priority position in this order: **Pitcher → 1st Base → Shortstop → 3rd Base → 2nd Base → Catcher**:

For each position, show a table:

| Player | Innings at Position | Shutdown/Good | Rough/Bad | Avg Runs Allowed | Throwing | Catching |
|--------|---------------------|---------------|-----------|------------------|----------|----------|

Then write 2–4 sentences interpreting what the data suggests:
- Which players show a pattern of stronger defensive outcomes at this position?
- Which players show a pattern of weaker outcomes?
- Does the skill data (Throwing/Catching ratings) align with the on-field results? Flag mismatches.
- Any positions that are consistently a weak point regardless of who plays there?

Use the domain knowledge below to contextualize. For example, if runs spike when a low-Catching player is at 1B, note that dropped throws to first are a likely contributor. If runs spike with a low-Throwing player at SS, note the difficulty of the SS-to-1B throw at this age.

---

### Batting Order Analysis

- List current batting order tendencies (which players tend to bat at the top vs bottom)
- Note players with highest Hitting ratings — are they near the top of the order?
- Flag if strong hitters are buried deep in a lineup where they get fewer at-bats

---

### Lineup Recommendations

Suggest the optimal defensive lineup for the **next game** using this logic:

1. **Pitcher**: highest combined Throwing + Catching among available active players (ideally both ≥ 3)
2. **1st Base**: highest Catching rating (receiving throws is everything here); Throwing secondary
3. **Shortstop**: highest Throwing rating among remaining players (longest routine throw in the infield); Catching also important
4. **3rd Base**: good Catching to field balls cleanly; Throwing is secondary because the 3B-to-1B distance is very difficult at 8U — a player with good Catching but moderate Throwing is preferable to a high-Throwing player who can't field cleanly
5. **2nd Base**: moderate Throwing + Catching; this position gets fewer hard plays at 8U
6. **Catcher**: second-best Catching rating (after 1B); Throwing matters less at this age since throwing out baserunners is rare
7. **Outfield**: distribute remaining players; players with higher Throwing can be placed in center/left-center to limit extra bases on balls that get through

Respect any imbalance you observed in the data — if the data shows a particular player consistently performs well at a position, weight that above skill ratings alone.

For batting order recommendation:
- Sort by Hitting rating (high → low) for the top of the order
- All players bat at 8U, so the full order matters

---

### Key Observations Summary

End with a brief bulleted list of the 3–5 most important takeaways from the analysis. Focus on what is actually actionable — specific players, specific positions, specific patterns.

---

## Step 5: Generate CSV (only if requested)

If the user asked for a CSV, generate a recommended lineup file.

**Format** (must match the import format exactly):

```
Player,1,2,3,4,5,6
PlayerName,P,1B,SS,2B,3B,LF
PlayerName,C,P,1B,SS,2B,3B
```

Rules:
- First row: `Player` followed by inning numbers (1 through N, where N = inningCount of the target game, default 6)
- Each subsequent row: player name (must match exactly as stored), then one position abbreviation per inning
- Every player in the recommended batting order must appear exactly once
- Every position must be assigned to exactly one player per inning (Bench is allowed for extras)
- Rotate players through key positions across innings so no one sits too long

**Position abbreviations for the CSV**:

| Abbreviation | Full Name         |
|--------------|-------------------|
| P            | Pitcher           |
| C            | Catcher           |
| 1B           | 1st Base          |
| 2B           | 2nd Base          |
| 3B           | 3rd Base          |
| SS           | Shortstop         |
| LF           | Left Field        |
| LC           | Left-Centre Field |
| RC           | Right-Centre Field|
| RF           | Right Field       |
| BENCH        | Bench             |

Put the strongest defenders at key positions (P, 1B, SS) in **innings 1–3** when the game is typically most contested. Rotate weaker players through the infield in later innings to ensure fair play time, as is standard at 8U.

Write the CSV to a file named `recommended-lineup-<YYYY-MM-DD>.csv` using today's date. Confirm the file path after writing.

---

## Domain Reference: 8U Youth Softball

This section is your ground truth for all analysis and recommendations. Do not contradict these fundamentals.

### The Sport

Softball is a bat-and-ball game. The defensive team has 9–10 players on the field. The goal of the defense is to record 3 outs per half-inning to stop the offense from scoring runs. Outs are made by:
- Catching a batted ball in the air (fly out)
- Throwing to a base before a runner arrives (force out or tag out)
- Tagging a runner with the ball

At 8U, most action is ground balls and short pop-ups. Very few balls are hit deep to the outfield.

### Why These Positions Matter Most (in order)

**1. Pitcher (P)**
The pitcher fields more balls than any other player at this age because:
- Comebackers (balls hit directly to the pitcher) are the most common batted ball at 8U
- The pitcher covers first base on balls hit to the right side of the infield
- The pitcher-to-first combination is the most reliable out in 8U softball
- A weak pitcher who can't field or throw means more errors and more runs
- Pitcher Throwing + Catching are both critical

**2. First Base (1B)**
The first baseman receives throws on almost every ground ball in the infield. At 8U:
- Most outs depend on the first baseman catching a throw cleanly
- A dropped throw means an out becomes a run
- Catching skill is the single most important attribute for 1B
- The first baseman also fields bunts and slow rollers in their own area
- A weak 1B multiplies every other infielder's errors

**3. Shortstop (SS)**
The shortstop covers the most ground in the infield and has the most difficult routine throw:
- The SS-to-1B throw is approximately 60–70 feet — achievable for a strong 8U player but the longest routine throw in the infield
- Players with weak Throwing at SS will generate errors even on balls they field cleanly
- SS also backs up second base and covers steal attempts

**4. Third Base (3B)**
Third base gets fewer balls than SS but is still important:
- The 3B-to-1B throw is 80+ feet — this is extremely difficult for most 8U players
- **A high-Throwing player at 3B does NOT necessarily prevent runs** because most players cannot make this throw reliably
- At 8U, 3B plays are more about fielding the ball cleanly and eating it (not throwing) or throwing to second
- A player with good Catching (to field cleanly) but moderate Throwing is often more effective here than a high-Throwing player who fields poorly
- Do not overrate the 3B throwing distance; flag in analysis if a player with high Throwing but low Catching is placed at 3B

**5. Second Base (2B)**
Second base is the most achievable infield throw:
- The 2B-to-1B throw is roughly 60 feet and is underhand-friendly
- 2B also turns double plays with SS (rare but possible at 8U)
- Moderate skill requirements; a good place to develop newer infielders
- Balls hit between 1B and 2B often become runs at 8U if no one covers first

**6. Catcher (C)**
The catcher is important primarily for:
- Blocking wild pitches — passed balls directly allow baserunners to advance and score
- Receiving the pitcher — a poor Catching-rated catcher means more wild pitches = more runs allowed
- Throwing out runners stealing 2B: **near-impossible at 8U**, do not factor this into analysis
- Calling the pitch location matters far less at this age; fielding and blocking are what matters
- The catcher-pitcher combination together creates a "battery" — if both are weak, runs mount fast from wild pitches and passed balls alone

**7. Outfield (LF, LC, RF, RC)**
At 8U, the outfield is less critical for getting outs but still matters:
- Most balls hit to the outfield result in base hits — the goal is to limit them to singles
- A player with low Catching in the outfield will let balls drop, turning singles into doubles/triples
- Throwing from the outfield rarely results in outs at 8U — do not place your best Throwing player in the outfield for defensive purposes
- Outfield is a reasonable place to develop players with lower ratings without losing as many outs as putting them at SS or 3B

### Skill Ratings and What They Mean in Context

The system uses three skills rated 1–5:

- **Hitting** (1–5): How well the player makes contact and gets on base. Matters for batting order placement. Does not affect defensive analysis directly, but a team of high-Hitting players can overcome defensive weaknesses through scoring.

- **Throwing** (1–5): Arm strength and accuracy. Most critical at Pitcher and SS where throws must travel distance and arrive on target. Less important at 1B and outfield. At 3B, throwing ability matters less than expected because the distance to 1B often exceeds what an 8U player can throw accurately.

- **Catching** (1–5): Soft hands and receiving ability. Most critical at 1B (receiving all infield throws) and Catcher (blocking pitches). Also important at every other position for fielding ground balls cleanly before any throw is attempted.

### A Note on Causation vs. Correlation

Runs allowed in an inning are not solely caused by the defensive lineup. At 8U, runs can come from:
- Errors (strongly related to player skill and positioning)
- Wild pitches / passed balls (pitcher-catcher battery)
- Hit batters (coach/machine pitch format)
- Lucky hits that wouldn't be expected to go for hits

When analyzing, note any innings where a rough defensive outcome may be due to the pitcher-catcher battery rather than the infield (e.g., all runs came from wild pitches) if the pattern is clear. Use judgment, not certainty.

### Fair Play Expectations at 8U

At 8U, all players bat and every player is expected to play in the field each game. When generating lineup recommendations:
- No player should be benched for an entire game
- Stronger players can play more innings at key positions (P, 1B, SS), but everyone should rotate through
- Weaker players can play more outfield innings, but should get at least 1–2 infield innings per game
- Flag in the analysis if the historical lineups show a player who never played a key position — this may represent an opportunity to develop that player

---

## Output Guidelines

- Be specific and data-driven. Cite actual inning counts and run totals.
- Be direct about weaknesses — the coach needs honest analysis, not vague encouragement.
- Acknowledge data limitations (e.g., "only 3 innings have both fielding and score data for this position combination").
- Use the domain knowledge above to explain *why* a pattern matters, not just *that* a pattern exists.
- Keep recommendations grounded in what 8U players can realistically do.
