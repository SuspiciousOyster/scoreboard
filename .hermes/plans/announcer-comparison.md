# Announcer View Comparison: Announcer Jammers vs Thin Mint

## Repository Size Comparison

| Metric | Announcer Jammers (ours) | Thin Mint (theirs) |
|--------|------------------------|-------------------|
| Total lines | 1,545 (3 files) | 7,804 (1 file) |
| JS | 822 | ~5,400 (embedded) |
| CSS | 647 | ~2,100 (embedded) |
| HTML | 76 | ~300 (embedded) |

---

## Architecture

### Ours: Modular / WS.Register pattern
- **3 files**: HTML + CSS + `announcer-jammers-render.js`
- **Shared render engine**: Uses CRG ScoreBoard's native `WS.Register` / `WS.AfterLoad` callback system
- **Reactive**: Registered path patterns trigger `queueRender()` → debounced `fullRender()`
- **Demo**: Separate test harness (`mock-ws.js`) injects state via `WS.Set()`
- **Build**: Symlinks canonical files into `demo/`; Pages deploy resolves symlinks

### Thin Mint: Monolithic / Direct WS
- **1 file**: Everything embedded (7804 lines)
- **Custom WS client**: Direct `new WebSocket(...)` → `ws.onmessage` → `applyState(S, update)`
- **Manual render**: `render()` called at the end of `applyState()`, re-renders entire DOM
- **Ignored native WS.Register**: Instead they send the CRG server a list of paths to subscribe to, then parse the JSON state blobs directly
- **State caching**: `localStorage`-based jam history, game state recovery across reloads
- **Remote mode**: Works as a standalone page via `?mode=remote`

### Key Architectural Difference

**Thin Mint reimplements what CRG already provides** — instead of using WS.Register/WS.AfterLoad (which the scoreboard's `core.js` already handles in-page), it bypasses the native JS bridge and talks WebSocket directly. This means it doesn't need to be a "custom view" installed on the scoreboard at all — it can be loaded from any browser pointing at any CRG instance.

Our approach integrates properly with CRG's custom view system, staying reactive rather than poll-driven.

---

## UI/UX Comparison

### What Thin Mint does better (things we should absorb)

| Feature | Thin Mint | Ours |
|---------|-----------|------|
| **Visual polish** | Gradient backgrounds, panel shadows, edge highlights, glow effects on 🔋 | Flat, no depth |
| **Full lineup** | Shows all 5 positions + penalty box status | No lineup — per-jammer stats only |
| **Score differential** | Arrows + number showing which team leads by how much | Not shown |
| **Wall clock** | Real-time clock in top bar | Not shown |
| **Period/Jam clock** | Countdown clocks in top bar | Not shown |
| **Power jam indicator** | ⚡ bolt with glow when opponent jammer is in box | Not shown |
| **Star pass indicator** | ★ color changes (lead=green, SP=cyan, nil=dim) | SP badge on name only |
| **State badge** | Color-coded current state (Lead/Lineup/Timeout/OR) | Not shown |
| **Penalty heat** | Compact center column showing active penalties per team | Separate section below timeline |
| **Jam history** | Bottom bar: compact per-jam summary (who scored, outcome) | No jam history row |
| **Period summary** | Grid of stats per period (lead count, PPJ, penalty count, SP) | No per-period breakdown |
| **Mirror layout** | Team 2 panel reverses layout for symmetry | Side-by-side tables, no mirror |
| **Responsive** | Desktop/tablet/compact/phone breakpoints | Single desktop layout |
| **Light/Dark** | Toggle with `D` key | Dark-only |
| **Keyboard shortcuts** | A/J/P/X/D/I for various panels | None |
| **Modal popups** | Jam history, penalty detail, skater stats, debug panel | None |
| **Wall clock** | Left side top bar, always visible | Not shown |
| **"Inside Track"** | Context engine — rotatable commentary snippets for announcers | Not shown |
| **Game state persistence** | Survives page reload via localStorage | Demo only, no persistence |
| **Remote mode** | Works as standalone browser page | Requires deployment as custom view |

### What we do better (things Thin Mint lacks)

| Feature | Ours | Thin Mint |
|---------|------|-----------|
| **Per-jammer advanced stats** | Lead %, PPJ, team contribution %, lap scores per jam | Shows jammer name only — no stats |
| **Scoring pass breakdown** | `[4,3] [1,5] [2,2,1]` per-jam grouping with * for after-SP trips | Shows total jam score only |
| **Score timeline** | Bar chart: per-jam scoring visualization | No timeline at all |
| **Penalty per-skater** | Each skater with emoji codes and penalty count | "Penalty heat" shows numbers in circles only |
| **Tooltip help** | ⓘ on each column header with explanation | No column explanations |
| **Data accuracy principle** | Displays exactly what the scoreboard reports, no interpretation | Tracks power jams, star passes, and "inside track" via manual heuristics |
| **Modular codebase** | 3 files, 1,545 lines | 1 file, 7,804 lines |

---

## What to Absorb (feature/reskin)

### High priority — visual polish
1. **Gradient backgrounds + panel depth** — radial gradient edges, box shadows, `::before` edge highlight pseudo-element
2. **Star pass visual** — ★ icon with color transitions (lead-green, SP-cyan, nil-dim)
3. **Power jam indicator** — ⚡ bolt with `drop-shadow` glow effect
4. **Modular CSS variable system** — well-organized theme tokens like Thin Mint (separate semantic vars from raw values)
5. **Panel card treatment** — rounded corners, subtle borders, consistent spacing rhythm

### Medium priority — additional data views
1. **Score differential** — arrow + number showing lead margin
2. **Full lineup** — show all 5 positions in the panel with penalty box status
3. **Period summary grid** — compact per-period stats (lead count, PPJ, penalty count, SP count)
4. **Jam history bar** — compact recent-jam summary at bottom
5. **State badge** — current game state (Lead/Lineup/Timeout/OR/InJam) with color coding
6. **Clocks** — period clock and jam clock display

### Lower priority — interactions
1. **Light/Dark theme** — toggle support
2. **Keyboard shortcuts** — simple hotkey bindings for toggling views
3. **Responsive breakpoints** — at minimum, a "compact" layout for narrower windows

### Explicitly NOT absorbing
- **"Inside Track" context engine** — this adds opinionated content that violates data accuracy principle
- **Game state persistence** — overkill for our use case
- **Penalty heat (Thin Mint style)** — our per-skater penalty display is better
- **Remote mode** — our deployment model (GitHub Pages + mock-ws) serves the same purpose
- **jam history popup modals** — we may want our own popups for different purposes

---

## Implementation Order

1. **Phase 1 — Visual reskin**: Apply Thin Mint's visual styling (gradient backgrounds, panel cards, shadows, border highlights, refined color palette)
2. **Phase 2 — Power jam + Star pass indicators**: Add visual indicators to team headers
3. **Phase 3 — Differential + State badge**: Add center-column score differential and state indicator
4. **Phase 4 — Full lineup display**: Integrate the 5-position lineup into the team panels
5. **Phase 5 — Clocks + Jam history bar**: Add top-bar clocks and bottom-bar jam history
