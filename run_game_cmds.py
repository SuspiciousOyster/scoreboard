#!/usr/bin/env python3
"""
Drive the CRG ScoreBoard through a full 12-jam game using StartJam/StopJam
Commands (which create Period/Jam objects) + WS.Set to fill scoring data.

Usage: Run with scoreboard already started on port 8000.
"""
import json, time, sys, websocket

PREFIX = "ScoreBoard.CurrentGame"
ws = None

def sc(**k):
    ws.send(json.dumps(k))
    time.sleep(0.1)

def set_key(key, value):
    sc(action="Set", key=f"{PREFIX}.{key}", value=str(value), flag="")

def cmd_set(path, value):
    sc(action="Set", key=f"{PREFIX}.{path}", value=str(value), flag="")

def sleep(s):
    time.sleep(s)

# ═══════════ Data ═══════════
t1_skaters = [("Bones","420"),("Smash","777"),("Blitz","99"),("Crash","11")]
t2_skaters = [("Viper","13"),("Fury","8"),("Blade","42"),("Storm","7")]

# Each jam: t1_jammer_idx, t2_jammer_idx, t1_lead, t2_lead, t1_trips, t2_trips, sp_to, sp_trips
JAMS = [
    (0,4, True,False, [4,3],[1], None,[]),          # Jam 1
    (0,5, False,True, [1],[3,2,2], None,[]),        # Jam 2
    (1,4, True,False, [3,1],[2], None,[]),           # Jam 3
    (0,4, True,False, [5],[], None,[]),              # Jam 4
    (1,4, False,True, [],[4,1,1], None,[]),          # Jam 5
    (0,4, True,False, [2,2,1],[1], None,[]),         # Jam 6
    (0,5, False,True, [1],[3], 2,[2]),               # Jam 7 — Star pass: Bones→Blitz
    (1,4, True,False, [2,2],[2,1], 2,[1,2,1]),      # Jam 8 — Star pass: Smash→Blitz
    (0,4, True,False, [4,2],[], None,[]),            # Jam 9
    (2,5, False,True, [2],[5], None,[]),             # Jam 10
    (0,4, True,False, [3,3],[2,1], None,[]),         # Jam 11
    (1,3, False,True, [2,2],[4,2,1], 2,[1,2,1]),    # Jam 12 — Star pass: Smash→Blitz
]

# ═══════════ Connect ═══════════
ws = websocket.create_connection("ws://localhost:8000/WS/?source=game_operator")
ws.settimeout(3)
time.sleep(0.3)
try:
    while True: ws.recv()
except: pass

print("Creating game...", file=sys.stderr)
sc(action="StartNewGame", data={"Team1":"WFTDA","Team2":"WFTDA","Ruleset":"wftda2018","Advance":False})
sleep(2)

# Set teams
set_key("Team(1).Name", "Thunderbirds")
set_key("Team(2).Name", "Valkyries")

# Set skaters
for i,(n,num) in enumerate(t1_skaters):
    set_key(f"Team(1).Skater({i}).Name", n)
    set_key(f"Team(1).Skater({i}).RosterNumber", num)
for i,(n,num) in enumerate(t2_skaters):
    set_key(f"Team(2).Skater({i+4}).Name", n)
    set_key(f"Team(2).Skater({i+4}).RosterNumber", num)
sleep(0.5)

run_t1, run_t2 = 0, 0

def run_jam(jam_idx, jam):
    global run_t1, run_t2
    t1s,t2s, t1l,t2l, t1t,t2t, t1_sp_to, t1_sp_t = jam[:8]
    
    t1_name = t1_skaters[t1s][0]
    t2_name = t2_skaters[t2s-4][0]
    
    print(f"Jam {jam_idx}/12: {t1_name} vs {t2_name}...", end=" ", file=sys.stderr)
    
    # Start jam — creates Period(1).Jam(N) in the game model
    cmd_set("StartJam", "true")
    sleep(0.5)
    
    # Detect the jam number from state
    sc(action="Register", paths=[f"{PREFIX}.Period(1).Jam(*).TeamJam(1).JamScore"])
    sleep(0.3)
    jam_state = {}
    ws.settimeout(0.5)
    try:
        while True:
            msg = ws.recv()
            d = json.loads(msg)
            if "state" in d:
                jam_state.update(d["state"])
    except: pass
    
    j_num = 1
    for k in sorted(jam_state.keys()):
        if ".Jam(" in k and ".TeamJam(1).JamScore" in k and "Period(1).Jam(" in k:
            parts = k.split(".Jam(")
            if len(parts) > 1:
                jn = int(parts[1].split(")")[0])
                if jn > j_num: j_num = jn
    
    t1_total = sum(t1t) + sum(t1_sp_t)
    t2_total = sum(t2t)
    run_t1 += t1_total
    run_t2 += t2_total
    
    tj1 = f"Period(1).Jam({j_num}).TeamJam(1)"
    tj2 = f"Period(1).Jam({j_num}).TeamJam(2)"
    
    # Scoring data
    set_key(f"{tj1}.JamScore", t1_total)
    set_key(f"{tj1}.Lead", "true" if t1l else "false")
    set_key(f"{tj2}.JamScore", t2_total)
    set_key(f"{tj2}.Lead", "true" if t2l else "false")
    
    # Fielding
    set_key(f"{tj1}.Fielding(Jammer).Skater", f"Skater({t1s})")
    set_key(f"{tj1}.Fielding(Jammer).SkaterNumber", t1_skaters[t1s][1])
    set_key(f"{tj2}.Fielding(Jammer).Skater", f"Skater({t2s})")
    set_key(f"{tj2}.Fielding(Jammer).SkaterNumber", t2_skaters[t2s-4][1])
    
    # Scoring trips
    for ti, score in enumerate(t1t + t1_sp_t):
        after_sp = ti >= len(t1t)
        set_key(f"{tj1}.ScoringTrip({ti+1}).Score", score)
        set_key(f"{tj1}.ScoringTrip({ti+1}).AfterSP", "true" if after_sp else "false")
    
    for ti, score in enumerate(t2t):
        set_key(f"{tj2}.ScoringTrip({ti+1}).Score", score)
        set_key(f"{tj2}.ScoringTrip({ti+1}).AfterSP", "false")
    
    # Star pass
    if t1_sp_to is not None:
        set_key(f"{tj1}.StarPass", "true")
        set_key(f"{tj1}.Fielding(Pivot).Skater", f"Skater({t1_sp_to})")
        set_key(f"{tj1}.Fielding(Pivot).SkaterNumber", t1_skaters[t1_sp_to][1])
    
    set_key("Team(1).Score", run_t1)
    set_key("Team(2).Score", run_t2)
    
    sleep(0.3)
    cmd_set("StopJam", "true")
    sleep(0.5)
    print(f"T1:{t1_total}, T2:{t2_total}", file=sys.stderr)

# Run all jams
for i, jam in enumerate(JAMS):
    run_jam(i+1, jam)

print(f"\nGame complete! Final: {run_t1} : {run_t2}", file=sys.stderr)
ws.close()
