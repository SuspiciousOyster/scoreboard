#!/usr/bin/env python3
"""
Clean 20-jam simulation: 2 periods x 10 jams.
Full rosters, penalties (blockers + jammers), star passes, power jams, no-lead jams.
"""
import json, time, sys, websocket

PREFIX = "ScoreBoard.CurrentGame"
ws = None

def sc(**k):
    ws.send(json.dumps(k))
    time.sleep(0.05)

def sk(key, value):
    sc(action="Set", key=f"{PREFIX}.{key}", value=str(value), flag="")

def drain():
    ws.settimeout(0.3)
    try:
        while True: ws.recv()
    except: pass
    ws.settimeout(3)

# ═══════ DATA ═══════
T1_SKATERS = [
    ("Bones","420","Jammer"),("Smash","777","Jammer"),("Blitz","99","Jammer"),
    ("Crash","11","Blocker"),("Rivet","88","Blocker"),("Apex","7","Pivot"),
    ("Vortex","23","Blocker"),("Kaos","13","Blocker"),("Fuse","45","Blocker"),
    ("Hex","2","Pivot"),("Nitro","33","Blocker"),("Pulse","19","Blocker"),
    ("Sarge","55","Blocker"),("Tank","77","Blocker"),("Zen","0","Pivot"),
]
T2_SKATERS = [
    ("Viper","13","Jammer"),("Fury","8","Jammer"),("Blade","42","Jammer"),
    ("Storm","7","Blocker"),("Bolt","23","Blocker"),("Shadow","17","Pivot"),
    ("Strike","21","Blocker"),("Ghost","3","Blocker"),("Vixen","44","Pivot"),
    ("Wraith","9","Blocker"),("Ember","31","Blocker"),("Claw","27","Blocker"),
    ("Rogue","18","Blocker"),("Slyte","66","Blocker"),("Tempest","5","Pivot"),
]
PENALTIES = ["IllegalProcedure","BackBlock","LowBlock","HighBlock","IllegalContact",
    "IllegalZone","Misconduct","Unnecessary","Cutting","DirectionOfPlay","Interference","OutOfPlay"]

# Penalty data — set AFTER all jams complete to ensure persistence
# Only skaters with at least 1 recorded jam as jammer are "jammers"
# T1 jammers: local idx 0=Bones,1=Smash,2=Blitz | T2 jammers: 0=Viper,1=Fury,2=Blade
T1_PENALTIES = [
    (0, "IllegalProcedure"),  # Bones (jammer) — power jam
    (3, "LowBlock"), (3, "BackBlock"),      # Crash — 2 penalties
    (4, "HighBlock"),                         # Rivet — 1
    (6, "Cutting"), (6, "DirectionOfPlay"),  # Apex (pivot) — 2
    (7, "IllegalContact"), (7, "Misconduct"), (7, "Unnecessary"),  # Vortex — 3
    (10, "Interference"),                     # Nitro — 1
    (12, "OutOfPlay"), (12, "LowBlock"),     # Pulse — 2
]
T2_PENALTIES = [
    (15, "IllegalZone"), (15, "BackBlock"),  # Viper (jammer) — 2
    (17, "BackBlock"),                        # Storm — 1
    (18, "LowBlock"), (18, "HighBlock"), (18, "IllegalZone"),  # Bolt — 3
    (19, "Cutting"),                          # Shadow (pivot) — 1
    (20, "DirectionOfPlay"),                  # Strike — 1
    (22, "Interference"), (22, "Misconduct"), # Ember — 2
    (23, "OutOfPlay"),                        # Claw — 1
    (24, "LowBlock"),                         # Rogue — 1
]

def gi(t, li):
    return li if t == 1 else li + 15

JAMS = [
    # (lead_team, t1_j_idx, t2_j_idx, t1_scores, t2_scores, sp_team, notes)
    # Period 1
    (1, 0, 0, [4,3], [1],        None,    "standard"),
    (2, 1, 1, [1],   [3,2,2],   None,    "T2 calls off"),
    (1, 0, 1, [3,1], [2],        None,    "T2 no-initial"),
    (2, 2, 0, [2],   [4,1],     None,    "standard"),
    (0, 0, 0, [1,2], [1,2],     None,    "NO LEAD — both jammers fail"),
    (1, 1, 1, [2,2,1],[1],      None,    "standard"),
    (1, 0, 0, [4,2], [1],       1,       "STAR PASS T1 — pivot scores 2 after SP"),
    (2, 2, 1, [0],   [5,3],     None,    "POWER JAM — T1 jammer penalized, T2 scores freely"),
    (1, 1, 0, [3,3], [0],       None,    "T2 jammer penalized (power jam for T1)"),
    (2, 0, 1, [1],   [2,2,1],   None,    "standard"),
    # Period 2
    (1, 2, 0, [5],   [2],       None,    "T1 big jam"),
    (2, 0, 1, [2],   [4,1],     2,       "STAR PASS T2 — pivot scores after SP"),
    (0, 1, 0, [0],   [0],       None,    "NO LEAD + NO-INITIAL both — scoreless"),
    (1, 0, 2, [3,2], [1,1],     1,       "STAR PASS T1"),
    (2, 1, 1, [1,1], [3,2],     None,    "POWER JAM T1 jammer penalty"),
    (1, 2, 0, [4,1], [2],       1,       "STAR PASS T1 + T2 jammer penalized"),
    (2, 0, 2, [2],   [5,1],     None,    "standard"),
    (1, 1, 1, [3],   [1],       None,    "T1 calls off early"),
    (0, 0, 0, [2],   [3],       None,    "NO LEAD"),
    (1, 2, 1, [4,3], [2,2],     1,       "STAR PASS T1 — finale"),
]

# ═══════ MAIN ═══════
ws = websocket.create_connection("ws://localhost:8000/WS/ScoreBoard")
ws.settimeout(3)
time.sleep(0.3)
try:
    while True: ws.recv()
except: pass

print("Creating game...", file=sys.stderr)
sc(action="StartNewGame", data={"Team1":"WFTDA","Team2":"WFTDA","Ruleset":"wftda2018","Advance":False})
time.sleep(2)
drain()

# SETUP
sk("Team(1).Name", "Thunderbirds")
sk("Team(1).AlternateName(operator)", "Thunderbirds")
sk("Team(1).Color(overlay.bg)", "#1f3a6b")
sk("Team(1).Color(overlay.fg)", "#ffffff")
sk("Team(2).Name", "Valkyries")
sk("Team(2).AlternateName(operator)", "Valkyries")
sk("Team(2).Color(overlay.bg)", "#6b1f1f")
sk("Team(2).Color(overlay.fg)", "#ffffff")

for i,(n,num,role) in enumerate(T1_SKATERS):
    sk(f"Team(1).Skater({i}).Name", n)
    sk(f"Team(1).Skater({i}).RosterNumber", num)
    sk(f"Team(1).Skater({i}).BaseRole", role)
    sk(f"Team(1).Skater({i}).Id", str(i))
for i,(n,num,role) in enumerate(T2_SKATERS):
    g = i + 15
    sk(f"Team(2).Skater({g}).Name", n)
    sk(f"Team(2).Skater({g}).RosterNumber", num)
    sk(f"Team(2).Skater({g}).BaseRole", role)
    sk(f"Team(2).Skater({g}).Id", str(g))
time.sleep(0.5)
drain()

# PENALTY ASSIGNMENTS (static — assigned to specific skaters)
run_t1, run_t2 = 0, 0

for jam_idx, (lead_t, t1j, t2j, t1s, t2s, sp_team, note) in enumerate(JAMS, 1):
    period = 1
    jam = jam_idx  # Sequential 1-20, all under Period 1
    t1_local_j = t1j
    t2_local_j = t2j
    
    # Determine per-jam flags
    is_lead_t1 = lead_t == 1
    is_lead_t2 = lead_t == 2
    no_lead = lead_t == 0
    no_init_t1 = "no-initial" in note and note.startswith("T2")  # only T2 had no-initial
    no_init_t2 = "no-initial" in note and "T2" not in note
    
    # Correct no-initial assignment
    if "NO-INITIAL" in note.upper() or "no-initial" in note:
        # Both no-initial if no lead AND described as such
        if "BOTH" in note.upper() or "scoreless" in note:
            no_init_t1 = True
            no_init_t2 = True
        elif "T1" in note:
            no_init_t1 = True
        else:
            no_init_t2 = True
    
    t1_score = sum(t1s)
    t2_score = sum(t2s)
    run_t1 += t1_score
    run_t2 += t2_score
    
    # Print status
    t1n = T1_SKATERS[t1_local_j][0]
    t2n = T2_SKATERS[t2_local_j][0]
    extras = []
    if no_lead: extras.append("NO-LEAD")
    if sp_team: extras.append(f"SP-T{sp_team}")
    extra_str = f" ({', '.join(extras)})" if extras else ""
    print(f"  P{period}J{jam:02d}: {t1n} vs {t2n} = {t1_score}:{t2_score}{extra_str}", file=sys.stderr)
    
    # ═══════ START JAM ═══════
    sk("StartJam", "true")
    time.sleep(1.2)
    drain()
    
    # ═══════ SET DATA ═══════
    tj1 = f"Period({period}).Jam({jam}).TeamJam(1)"
    tj2 = f"Period({period}).Jam({jam}).TeamJam(2)"
    
    # JamScore
    sk(f"{tj1}.JamScore", t1_score)
    sk(f"{tj2}.JamScore", t2_score)
    
    # Lead — only one team can be lead, or neither
    if no_lead:
        sk(f"{tj1}.Lead", "false")
        sk(f"{tj2}.Lead", "false")
    else:
        sk(f"{tj1}.Lead", "true" if is_lead_t1 else "false")
        sk(f"{tj2}.Lead", "true" if is_lead_t2 else "false")
    
    # Calloff — lead team sometimes calls it off
    call_t1 = is_lead_t1 and jam % 3 == 0
    call_t2 = is_lead_t2 and jam % 4 == 0
    sk(f"{tj1}.Calloff", "true" if call_t1 else "false")
    sk(f"{tj2}.Calloff", "true" if call_t2 else "false")
    
    # Star pass
    sp_t1 = sp_team == 1
    sp_t2 = sp_team == 2
    sk(f"{tj1}.StarPass", "true" if sp_t1 else "false")
    sk(f"{tj2}.StarPass", "true" if sp_t2 else "false")
    
    # No initial
    sk(f"{tj1}.NoInitial", "true" if no_init_t1 else "false")
    sk(f"{tj2}.NoInitial", "true" if no_init_t2 else "false")
    
    # Fielding — T1
    sk(f"{tj1}.Fielding(Jammer).Skater", gi(1, t1_local_j))
    sk(f"{tj1}.Fielding(Pivot).Skater", gi(1, (5 + jam) % 3))  # rotate pivots
    for bi in range(3):
        blk = 3 + ((bi + jam) % 4)  # rotate blockers
        sk(f"{tj1}.Fielding(Blocker{bi+1}).Skater", gi(1, blk))
    
    # Fielding — T2
    sk(f"{tj2}.Fielding(Jammer).Skater", gi(2, t2_local_j))
    sk(f"{tj2}.Fielding(Pivot).Skater", gi(2, 5 + (jam * 2) % 3))
    for bi in range(3):
        blk = 3 + ((bi * 2 + jam) % 4)
        sk(f"{tj2}.Fielding(Blocker{bi+1}).Skater", gi(2, blk))
    
    # Scoring trips — T1
    for ti, score in enumerate(t1s):
        after_sp = sp_t1 and ti >= len(t1s) - (2 if sp_t1 else 0)  # last 2 trips are after SP
        sk(f"{tj1}.ScoringTrip({ti+1}).Score", score)
        sk(f"{tj1}.ScoringTrip({ti+1}).AfterSP", "true" if after_sp else "false")
    
    # Scoring trips — T2
    for ti, score in enumerate(t2s):
        after_sp = sp_t2 and ti >= len(t2s) - 1
        sk(f"{tj2}.ScoringTrip({ti+1}).Score", score)
        sk(f"{tj2}.ScoringTrip({ti+1}).AfterSP", "true" if after_sp else "false")
    
    # Update running scores
    sk("Team(1).Score", run_t1)
    sk("Team(2).Score", run_t2)
    
    # ═══════ STOP JAM ═══════
    sk("StopJam", "true")
    time.sleep(0.8)
    drain()

# ═══════ POST-GAME: SET PENALTIES ═══════
# Setting penalties after all jams ensures they persist (scoreboard
# overwrites WS.Set for PenaltyCount during active gameplay).
print("Setting penalties...", file=sys.stderr)

def set_penalty_block(team, penalties_list):
    """Set penalty codes for a team. Returns (skater_counts, total)."""
    counts = {}
    for gs, code in penalties_list:
        counts[gs] = counts.get(gs, 0) + 1
    total = len(penalties_list)
    
    for gs, code in penalties_list:
        idx = penalties_list[:penalties_list.index((gs, code))].count((gs, code))
        # Don't set PenaltyCount — scoreboard auto-manages it
        sk(f"Team({team}).Skater({gs}).Penalty({idx}).Code", code)
    
    sk(f"Team({team}).TotalPenalties", total)
    return counts, total

t1_counts, t1_total = set_penalty_block(1, T1_PENALTIES)
t2_counts, t2_total = set_penalty_block(2, T2_PENALTIES)
time.sleep(1)
drain()

print(f"\nComplete! Final: {T1_SKATERS[0][0]} {run_t1} : {run_t2} {T2_SKATERS[0][0]}", file=sys.stderr)
print(f"Penalties — T1: {t1_total} ({len(t1_counts)} skaters), T2: {t2_total} ({len(t2_counts)} skaters)", file=sys.stderr)
ws.close()
