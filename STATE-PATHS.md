# CRG ScoreBoard State Path Reference

## Prefix
All state paths are prefixed with `ScoreBoard.CurrentGame.`
Custom views access via `WS.state['ScoreBoard.CurrentGame.<path>']`

---

## Team → Skater
**Path:** `Team(N).Skater(N)`
**Keyed by:** Skater index within team (not roster number)

| Field | Type | Meaning |
|-------|------|---------|
| `Name` | string | Skater's name |
| `RosterNumber` | string | Jersey number (e.g. "420") |
| `BaseRole` | string | Default role: Jammer, Pivot, or Blocker |
| `Flags` | string | e.g. "C" for Captain |
| `Pronouns` | string | Skater's pronouns |
| `PenaltyBox` | bool | Currently in penalty box |

---

## Period → Jam
**Path:** `Period(N).Jam(N)`

| Field | Type | Meaning |
|-------|------|---------|
| `PeriodNumber` | number | Copy of parent period number |
| `StarPass` | bool | True if EITHER team had a star pass |
| `Overtime` | bool | This is an overtime jam |
| `InjuryContinuation` | bool | Injury continuation |
| `Duration` | number | Duration in ms |
| `TeamJam(1)` / `TeamJam(2)` | TeamJam | Child — one per team |

---

## Period → Jam → TeamJam — **The key object for our view**
**Path:** `Period(N).Jam(N).TeamJam(N)` where last N = 1 or 2

| Field | Type | Writable | Meaning |
|-------|------|----------|---------|
| `JamScore` | number | no | Points scored this jam by this team |
| `AfterSPScore` | number | no | Points scored *after* star pass |
| `TotalScore` | number | no | Cumulative team score up to and including this jam |
| `LastScore` | number | no | Copy of Previous→TotalScore |
| `Lead` | bool | yes | Team had lead jammer |
| `DisplayLead` | bool | no | Display indicator for lead |
| `Lost` | bool | yes | Called off while NOT lead (illegal calloff) |
| `Calloff` | bool | yes | Jam was called off by this team |
| `StarPass` | bool | yes | Star was passed in this jam |
| `StarPassTrip` | id | yes | Reference to the ScoringTrip at which star was passed |
| `NoPivot` | bool | yes | No pivot available on track |
| `Injury` | bool | yes | Injury continuation linked across teams |
| `NoInitial` | bool | no | No initial jam (e.g. replay) |
| `CurrentTrip` | id | no | Currently active scoring trip |
| `CurrentTripNumber` | number | no | Copy of CurrentTrip→Number |
| `OsOffset` | number | yes | Override/score-adjustment offset |
| `Fielding(_position_)` | child | no | Fielding entry keyed by floor position |
| `ScoringTrip(_number_)` | child | no | Scoring trip entries |

---

## Period → Jam → TeamJam → Fielding
**Path:** `Period(N).Jam(N).TeamJam(N).Fielding(N)`

The number in Fielding(N) corresponds to **floor position**:
- **Position 1** = Jammer (starting jammer)
- **Position 2** = Pivot
- **Positions 3-5** = Blockers
- If star pass occurs, the pivot (or another skater) at a different position also has Position=Jammer

| Field | Type | Writable | Meaning |
|-------|------|----------|---------|
| `Skater` | reference | yes | Reference to Skater (e.g. "Skater(3)") |
| `SkaterNumber` | string | no | Copy of Skater→RosterNumber or "?"/"n/a" |
| `Position` | string | no | PositionId: "Jammer", "Pivot", "Blocker" |
| `NotFielded` | bool | yes | This position is not fielded |
| `PenaltyBox` | bool | yes | Skater in penalty box during this jam |
| `SitFor3` | bool | yes | Skater must sit for 3 jams due to expulsion |
| `BoxTripSymbols` | string | no | Penalty box symbol string |
| `BoxTripSymbolsBeforeSP` | string | no | Box symbols before star pass |
| `BoxTripSymbolsAfterSP` | string | no | Box symbols after star pass |

---

## Period → Jam → TeamJam → ScoringTrip
**Path:** `Period(N).Jam(N).TeamJam(N).ScoringTrip(N)`

Numbered sequentially within each TeamJam. Each trip = one pass through pack.

| Field | Type | Writable | Meaning |
|-------|------|----------|---------|
| `Score` | number | yes | Points awarded for this trip |
| `AfterSP` | bool | yes | Was scored after star pass |
| `Current` | bool | no | Currently being scored |
| `Duration` | number | no | Duration in ms |
| `JamClockStart` | number | no | Jam clock time at trip start |
| `JamClockEnd` | number | yes | Jam clock time at trip end |
| `Annotation` | string | yes | Free text annotation |

---

## Key Rules (derived from code + docs)

### Lead Jammer (`TeamJam.Lead`)
- Set by scoreboard operator (NSO)
- Only one team can be lead per jam (or neither)
- Lead jammer can call off the jam (`Calloff = true`) at any time
- Non-lead jammer calling off = `Lost = true` (penalty — other team keeps scoring)

### Star Pass (`TeamJam.StarPass`)
- Starting jammer gives helmet cover (the "star") to pivot or another teammate
- That skater becomes the new jammer, wearing the star
- Original jammer stays on track but can no longer score
- `TeamJam.StarPass = true` when this occurs
- `TeamJam.StarPassTrip` references which ScoringTrip it happened at (trips before this index are pre-SP)
- `ScoringTrip.AfterSP = true` for trips scored by the star-pass recipient
- `TeamJam.AfterSPScore` gives total points scored after star pass

### Fielding for Star Pass
- **Before SP**: `Fielding(1).Skater = starting jammer`, `Fielding(1).Position = "Jammer"`
- **After SP**: Same fielding, but `Fielding(2).Skater` (the pivot or recipient) also has `Position = "Jammer"`
- In practice, `Fielding(1)` is always the jammer position; after SP the pivot position fielding also gets Position="Jammer"

### Scoring Trip Mechanics
- Each trip = one pass through opposing blockers
- Points awarded based on how many opposing skaters are passed
- The scoreboard handles the exact calculation — we just read `.Score`
- Trips are numbered sequentially 0, 1, 2, ... per TeamJam
- If no `ScoringTrip(N)` exists but `JamScore > 0`, there's an old-style single unsplit score

### Calloff
- `TeamJam.Calloff = true` = this team's jammer ended the jam
- Only the lead jammer can legally call off
- If non-lead calls off, both `Calloff = true` AND `Lost = true`
