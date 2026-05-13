#!/usr/bin/env python3
"""Create 12 jams, then set all data. Separates jam creation from data writing."""
import json, time, sys, websocket, re

PREFIX = "ScoreBoard.CurrentGame"
ws = None

def sc(**k):
    ws.send(json.dumps(k))
    time.sleep(0.08)

def set_key(key, value):
    sc(action="Set", key=f"{PREFIX}.{key}", value=str(value), flag="")

def drain():
    ws.settimeout(0.3)
    try:
        while True: ws.recv()
    except: pass
    ws.settimeout(3)

t1_skaters = [("Bones","420"),("Smash","777"),("Blitz","99"),("Crash","11"),("Rivet","88")]
t2_skaters = [("Viper","13"),("Fury","8"),("Blade","42"),("Storm","7"),("Bolt","23")]

def gi(t, li):
    return li if t == 1 else li + 5

JAMS = [
    (0,0, True,False, [4,3],[1], None,[]),
    (0,1, False,True, [1],[3,2,2], None,[]),
    (1,0, True,False, [3,1],[2], None,[]),
    (0,0, True,False, [5],[], None,[]),
    (1,0, False,True, [],[4,1,1], None,[]),
    (0,0, True,False, [2,2,1],[1], None,[]),
    (0,1, False,True, [1],[3], 2,[2]),
    (1,0, True,False, [2,2],[2,1], 2,[1,2,1]),
    (0,0, True,False, [4,2],[], None,[]),
    (2,1, False,True, [2],[5], None,[]),
    (0,0, True,False, [3,3],[2,1], None,[]),
    (1,3, False,True, [2,2],[4,2,1], 2,[1,2,1]),
]

BLOCKERS = [
    (1,2,3, 1,2,3), (1,2,3, 0,2,3), (0,2,3, 1,2,3), (1,2,3, 1,2,3),
    (0,2,3, 0,2,3), (1,2,3, 1,2,4), (1,3,4, 0,2,3), (0,3,4, 1,2,4),
    (1,2,3, 1,2,3), (0,1,3, 0,2,3), (1,2,3, 1,2,4), (0,3,4, 0,1,3),
]

# Connect
ws = websocket.create_connection("ws://localhost:8000/WS/?source=game_operator")
ws.settimeout(3)
time.sleep(0.3)
try:
    while True: ws.recv()
except: pass

# Start game
print("Creating game...", file=sys.stderr)
sc(action="StartNewGame", data={"Team1":"WFTDA","Team2":"WFTDA","Ruleset":"wftda2018","Advance":False})
time.sleep(2)

# Teams & skaters
set_key("Team(1).Name", "Thunderbirds")
set_key("Team(2).Name", "Valkyries")
for i,(n,num) in enumerate(t1_skaters):
    set_key(f"Team(1).Skater({i}).Name", n)
    set_key(f"Team(1).Skater({i}).RosterNumber", num)
for i,(n,num) in enumerate(t2_skaters):
    g = i + 5
    set_key(f"Team(2).Skater({g}).Name", n)
    set_key(f"Team(2).Skater({g}).RosterNumber", num)
time.sleep(1)
drain()

# PHASE 1: Create all 12 jams
print("Creating 12 jams...", file=sys.stderr)
for i in range(12):
    sc(action="Set", key=f"{PREFIX}.StartJam", value="true", flag="")
    time.sleep(1.5)
    sc(action="Set", key=f"{PREFIX}.StopJam", value="true", flag="")
    time.sleep(1)
    drain()
print("Jams created.", file=sys.stderr)

# PHASE 2: Set all data for each jam
print("Writing jam data...", file=sys.stderr)
run_t1, run_t2 = 0, 0
for jam_idx, jam in enumerate(JAMS):
    t1s,t2s, t1l,t2l, t1t,t2t, t1_sp_to, t1_sp_t = jam[:8]
    blk = BLOCKERS[jam_idx]
    t1_b, t2_b = blk[:3], blk[3:]
    j_num = jam_idx + 1
    
    t1_total = sum(t1t) + sum(t1_sp_t)
    t2_total = sum(t2t)
    run_t1 += t1_total
    run_t2 += t2_total
    
    tj1 = f"Period(1).Jam({j_num}).TeamJam(1)"
    tj2 = f"Period(1).Jam({j_num}).TeamJam(2)"
    
    set_key(f"{tj1}.JamScore", t1_total)
    set_key(f"{tj1}.Lead", "true" if t1l else "false")
    set_key(f"{tj2}.JamScore", t2_total)
    set_key(f"{tj2}.Lead", "true" if t2l else "false")
    
    # Fielding
    set_key(f"{tj1}.Fielding(Jammer).Skater", gi(1, t1s))
    set_key(f"{tj2}.Fielding(Jammer).Skater", gi(2, t2s))
    set_key(f"{tj1}.Fielding(Blocker1).Skater", gi(1, t1_b[0]))
    set_key(f"{tj1}.Fielding(Blocker2).Skater", gi(1, t1_b[1]))
    set_key(f"{tj1}.Fielding(Blocker3).Skater", gi(1, t1_b[2]))
    set_key(f"{tj2}.Fielding(Blocker1).Skater", gi(2, t2_b[0]))
    set_key(f"{tj2}.Fielding(Blocker2).Skater", gi(2, t2_b[1]))
    set_key(f"{tj2}.Fielding(Blocker3).Skater", gi(2, t2_b[2]))
    # Pivot
    all_local = set(range(5))
    pivot1 = sorted(all_local - {t1s} - set(t1_b))[0]
    pivot2 = sorted(all_local - {t2s} - set(t2_b))[0]
    set_key(f"{tj1}.Fielding(Pivot).Skater", gi(1, t1_sp_to if t1_sp_to is not None else pivot1))
    set_key(f"{tj2}.Fielding(Pivot).Skater", gi(2, pivot2))
    
    # Scoring trips
    for ti, score in enumerate(t1t + t1_sp_t):
        after_sp = ti >= len(t1t)
        set_key(f"{tj1}.ScoringTrip({ti+1}).Score", score)
        set_key(f"{tj1}.ScoringTrip({ti+1}).AfterSP", "true" if after_sp else "false")
    for ti, score in enumerate(t2t):
        set_key(f"{tj2}.ScoringTrip({ti+1}).Score", score)
        set_key(f"{tj2}.ScoringTrip({ti+1}).AfterSP", "false")
    
    if t1_sp_to is not None:
        set_key(f"{tj1}.StarPass", "true")
    
    set_key("Team(1).Score", run_t1)
    set_key("Team(2).Score", run_t2)
    
    print(f"  Jam {j_num}: T1={t1_total}, T2={t2_total}", file=sys.stderr)
    time.sleep(0.3)

print(f"\nComplete! Final: {run_t1} : {run_t2}", file=sys.stderr)
ws.close()
