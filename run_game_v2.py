#!/usr/bin/env python3
"""
Full game driver — properly creates game, sets up teams/skaters, runs 12 jams.
Uses ScoreBoard.CurrentGame.* paths which ARE writable via WS Set.
"""
import json, time, sys, websocket

PREFIX = "ScoreBoard.CurrentGame"
ws = None

def sc(action, **kw):
    d = {"action": action}
    d.update(kw)
    ws.send(json.dumps(d))
    time.sleep(0.12)

def set_key(key, value):
    sc("Set", key=f"{PREFIX}.{key}", value=str(value), flag="")

def connect():
    global ws
    ws = websocket.create_connection("ws://localhost:8000/WS/?source=game_operator")
    ws.settimeout(2)
    time.sleep(0.3)
    try:
        while True: ws.recv()
    except: pass

# ═══════════════════════════════════════
# Data
# ═══════════════════════════════════════
t1_skaters = [("Bones","420"),("Smash","777"),("Blitz","99"),("Crash","11")]
t2_skaters = [("Viper","13"),("Fury","8"),("Blade","42"),("Storm","7")]

# Each jam: period,jam, t1_jammer_idx, t2_jammer_idx, t1_lead, t2_lead, t1_trips, t2_trips, [t1_sp_to, t1_sp_trips]
JAMS = [
    (1,1,0,4, True,False, [4,3],[1]),
    (1,2,0,5, False,True, [1],[3,2,2]),
    (1,3,1,4, True,False, [3,1],[2]),
    (1,4,0,4, True,False, [5],[]),
    (1,5,1,4, False,True, [],[4,1,1]),
    (1,6,0,4, True,False, [2,2,1],[1]),
    (1,7,0,5, False,True, [1],[3],
        # Star pass: Bones -> Blitz
        2,[2]),
    (1,8,1,4, True,False, [2,2],[2,1],
        # Star pass: Smash -> Blitz
        2,[1,2,1]),
    (2,1,0,4, True,False, [4,2],[]),
    (2,2,2,5, False,True, [2],[5]),
    (2,3,0,4, True,False, [3,3],[2,1]),
    (2,4,1,3, False,True, [2,2],[4,2,1],
        # Star pass: Smash -> Blitz
        2,[1,2,1]),
]

# ═══════════════════════════════════════
# Run Game
# ═══════════════════════════════════════
connect()
print("Connected.", file=sys.stderr)

# Create game
sc("StartNewGame", data={"Team1":"WFTDA","Team2":"WFTDA","Ruleset":"wftda2018","Advance":False})
time.sleep(2)  # Wait for full init

# Set teams
print("Setting teams...", file=sys.stderr)
set_key("Team(1).Name", "Thunderbirds")
set_key("Team(2).Name", "Valkyries")
time.sleep(0.3)

# Set skaters
for i,(n,num) in enumerate(t1_skaters):
    set_key(f"Team(1).Skater({i}).Name", n)
    set_key(f"Team(1).Skater({i}).RosterNumber", num)
for i,(n,num) in enumerate(t2_skaters):
    set_key(f"Team(2).Skater({i+4}).Name", n)
    set_key(f"Team(2).Skater({i+4}).RosterNumber", num)
time.sleep(0.5)

# Verify
sc("Register", paths=[f"{PREFIX}.Team(1).Name", f"{PREFIX}.Team(2).Name",
    f"{PREFIX}.Team(1).Skater(0).Name"])
time.sleep(0.5)
for m in [1,2]:
    try:
        d=json.loads(ws.recv())
        if "state" in d:
            for k,v in d["state"].items():
                print(f"  {k} = {v}", file=sys.stderr)
    except: pass

# ═══════════════════════════════════════
# Run Jams
# ═══════════════════════════════════════
# Running totals
run_t1 = 0
run_t2 = 0

for idx, jam in enumerate(JAMS):
    p,j, t1s,t2s, t1l,t2l, t1t,t2t = jam[:8]
    t1_sp_to = jam[8] if len(jam) > 8 else None
    t1_sp_t = jam[9] if len(jam) > 9 else []
    
    t1_name = t1_skaters[t1s][0]
    t2_name = t2_skaters[t2s-4][0]
    print(f"Jam {idx+1}/{len(JAMS)}: {t1_name} vs {t2_name}...", end=" ", file=sys.stderr)
    
    t1_total = sum(t1t) + sum(t1_sp_t)
    t2_total = sum(t2t)
    run_t1 += t1_total
    run_t2 += t2_total
    
    set_key(f"Period({p}).Jam({j}).TeamJam(1).JamScore", t1_total)
    set_key(f"Period({p}).Jam({j}).TeamJam(1).Lead", "true" if t1l else "false")
    set_key(f"Period({p}).Jam({j}).TeamJam(2).JamScore", t2_total)
    set_key(f"Period({p}).Jam({j}).TeamJam(2).Lead", "true" if t2l else "false")
    
    # Fielding
    set_key(f"Period({p}).Jam({j}).TeamJam(1).Fielding(Jammer).Skater", f"Skater({t1s})")
    set_key(f"Period({p}).Jam({j}).TeamJam(1).Fielding(Jammer).SkaterNumber", t1_skaters[t1s][1])
    set_key(f"Period({p}).Jam({j}).TeamJam(1).Fielding(Jammer).Position", "Jammer")
    
    set_key(f"Period({p}).Jam({j}).TeamJam(2).Fielding(Jammer).Skater", f"Skater({t2s})")
    set_key(f"Period({p}).Jam({j}).TeamJam(2).Fielding(Jammer).SkaterNumber", t2_skaters[t2s-4][1])
    set_key(f"Period({p}).Jam({j}).TeamJam(2).Fielding(Jammer).Position", "Jammer")
    
    # Scoring trips
    all_t1_trips = t1t + t1_sp_t
    for ti, score in enumerate(all_t1_trips):
        after_sp = ti >= len(t1t)
        set_key(f"Period({p}).Jam({j}).TeamJam(1).ScoringTrip({ti}).Score", score)
        set_key(f"Period({p}).Jam({j}).TeamJam(1).ScoringTrip({ti}).AfterSP", "true" if after_sp else "false")
    
    for ti, score in enumerate(t2t):
        set_key(f"Period({p}).Jam({j}).TeamJam(2).ScoringTrip({ti}).Score", score)
        set_key(f"Period({p}).Jam({j}).TeamJam(2).ScoringTrip({ti}).AfterSP", "false")
    
    # Star pass fielding
    if t1_sp_to is not None:
        set_key(f"Period({p}).Jam({j}).TeamJam(1).StarPass", "true")
        set_key(f"Period({p}).Jam({j}).TeamJam(1).Fielding(Pivot).Skater", f"Skater({t1_sp_to})")
        set_key(f"Period({p}).Jam({j}).TeamJam(1).Fielding(Pivot).SkaterNumber", t1_skaters[t1_sp_to][1])
        set_key(f"Period({p}).Jam({j}).TeamJam(1).Fielding(Pivot).Position", "Jammer")
    
    set_key("Team(1).Score", run_t1)
    set_key("Team(2).Score", run_t2)
    
    time.sleep(1.2)
    print(f"done (T1:{t1_total}, T2:{t2_total})", file=sys.stderr)

final_t1 = run_t1
final_t2 = run_t2
print(f"\nGame complete! Final: {final_t1} : {final_t2}", file=sys.stderr)
ws.close()
