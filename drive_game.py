#!/usr/bin/env python3
"""
Drive the CRG ScoreBoard through a scripted game via WebSocket API.
Connects to ws://localhost:8000/WS/, sends commands to set up teams,
run jams with scoring, star passes, lead changes, etc.
"""
import json
import time
import sys
import websocket

PREFIX = "ScoreBoard.CurrentGame"
ws = None

def send(cmd):
    """Send a JSON command over the WebSocket."""
    # print(f"  → {json.dumps(cmd)}", file=sys.stderr)
    ws.send(json.dumps(cmd))
    time.sleep(0.05)

def set_key(key, value):
    """Set a state value."""
    send({"action": "Set", "key": f"{PREFIX}.{key}", "value": str(value), "flag": ""})

def cmd(action, data=None):
    """Send a Command action."""
    send({"action": action, "data": data or {}})

def add_period(num):
    """Add a period."""
    set_key(f"Period({num}).Id", f"Period{num}")

def add_jam(period, jam):
    """Add a jam to a period."""
    set_key(f"Period({period}).Jam({jam}).Id", f"Period{period}Jam{jam}")

def set_teamjam(period, jam, team, **fields):
    """Set fields on a TeamJam."""
    for k, v in fields.items():
        set_key(f"Period({period}).Jam({jam}).TeamJam({team}).{k}", v)

def set_skater(team, idx, name, number):
    """Set up a skater."""
    set_key(f"Team({team}).Skater({idx}).Name", name)
    set_key(f"Team({team}).Skater({idx}).RosterNumber", number)

def set_fielding(period, jam, team, position, skater_idx, skater_number):
    """Set fielding for a position. In real scoreboard, fielding is keyed by FloorPosition name."""
    skater_ref = f"Skater({skater_idx})"
    set_key(f"Period({period}).Jam({jam}).TeamJam({team}).Fielding({position}).Skater", skater_ref)
    set_key(f"Period({period}).Jam({jam}).TeamJam({team}).Fielding({position}).SkaterNumber", skater_number)
    set_key(f"Period({period}).Jam({jam}).TeamJam({team}).Fielding({position}).Position", "Jammer")

def add_scoring_trip(period, jam, team, trip_idx, score, after_sp=False):
    """Add a scoring trip."""
    set_key(f"Period({period}).Jam({jam}).TeamJam({team}).ScoringTrip({trip_idx}).Score", score)
    set_key(f"Period({period}).Jam({jam}).TeamJam({team}).ScoringTrip({trip_idx}).AfterSP", "true" if after_sp else "false")


def run_game():
    global ws
    print("Connecting to scoreboard WebSocket...", file=sys.stderr)
    ws = websocket.create_connection("ws://localhost:8000/WS/?source=script")
    
    # Wait for initial state load
    ws.settimeout(5)
    try:
        msg = ws.recv()
        print(f"  Received initial state ({len(msg)} bytes)", file=sys.stderr)
    except websocket.Timeout:
        print("  No initial state received — proceeding anyway", file=sys.stderr)
    
    time.sleep(0.5)
    
    # ═══════════════════════════════════════
    # Teams
    # ═══════════════════════════════════════
    print("Setting up teams...", file=sys.stderr)
    set_key("Team(1).Name", "Thunderbirds")
    set_key("Team(1).AlternateName(operator)", "THUNDER")
    set_key("Team(2).Name", "Valkyries")
    set_key("Team(2).AlternateName(operator)", "VALKYRIE")
    time.sleep(0.3)
    
    # Skaters - Team 1
    skaters_t1 = [
        ("Bones", "420"),
        ("Smash", "777"), 
        ("Blitz", "99"),
        ("Crash", "11"),
    ]
    # Skaters - Team 2
    skaters_t2 = [
        ("Viper", "13"),
        ("Fury", "8"),
        ("Blade", "42"),
        ("Storm", "7"),
    ]
    
    for i, (name, num) in enumerate(skaters_t1):
        set_skater(1, i, name, num)
    for i, (name, num) in enumerate(skaters_t2):
        set_skater(2, i + len(skaters_t1), name, num)
    
    time.sleep(0.5)
    
    # ═══════════════════════════════════════
    # Jams
    # ═══════════════════════════════════════
    # Each jam: {period, jam, t1_skater, t2_skater, t1_lead, t2_lead,
    #            t1_trips, t2_trips, 
    #            t1_sp_skater (optional), t1_sp_trips (optional)}
    
    JAMS = [
        # Jam 1: T1 scores 4+3, lead; T2 scores 1
        {"p":1,"j":1,"t1s":0,"t2s":4,"t1l":True,"t2l":False,"t1t":[4,3],"t2t":[1]},
        # Jam 2: T1 scores 1; T2 scores 3+2+2, lead
        {"p":1,"j":2,"t1s":0,"t2s":5,"t1l":False,"t2l":True,"t1t":[1],"t2t":[3,2,2]},
        # Jam 3: T1 (Smash) scores 3+1, lead; T2 scores 2
        {"p":1,"j":3,"t1s":1,"t2s":4,"t1l":True,"t2l":False,"t1t":[3,1],"t2t":[2]},
        # Jam 4: T1 (Bones) scores 5, lead; T2 scores 0
        {"p":1,"j":4,"t1s":0,"t2s":4,"t1l":True,"t2l":False,"t1t":[5],"t2t":[]},
        # Jam 5: T1 scores 0; T2 scores 4+1+1, lead
        {"p":1,"j":5,"t1s":1,"t2s":4,"t1l":False,"t2l":True,"t1t":[],"t2t":[4,1,1]},
        # Jam 6: T1 (Bones) scores 2+2+1, lead; T2 scores 1
        {"p":1,"j":6,"t1s":0,"t2s":4,"t1l":True,"t2l":False,"t1t":[2,2,1],"t2t":[1]},
        # Jam 7: T1 (Bones) scores 1; T2 (Storm) scores 3, lead
        {"p":1,"j":7,"t1s":0,"t2s":5,"t1l":False,"t2l":True,"t1t":[1],"t2t":[3],
         # STAR PASS demo: Bones passes to Blitz mid-jam
         "t1_sp":2,"t1_sp_t":[]},
        # Jam 8: T1 (Smash) scores 2+2 then passes to Blitz who does 1+2+1, lead
        {"p":1,"j":8,"t1s":1,"t2s":4,"t1l":True,"t2l":False,
         "t1t":[2,2],"t1_sp":2,"t1_sp_t":[1,2,1],"t2t":[2,1]},
        # Jam 9: T1 (Bones) scores 4+2, lead; T2 scores 0
        {"p":2,"j":1,"t1s":0,"t2s":4,"t1l":True,"t2l":False,"t1t":[4,2],"t2t":[]},
        # Jam 10: T1 (Blitz) solo, scores 2; T2 (Storm) scores 5, lead
        {"p":2,"j":2,"t1s":2,"t2s":5,"t1l":False,"t2l":True,"t1t":[2],"t2t":[5]},
        # Jam 11: T1 (Bones) scores 3+3, lead; T2 scores 2+1
        {"p":2,"j":3,"t1s":0,"t2s":4,"t1l":True,"t2l":False,"t1t":[3,3],"t2t":[2,1]},
        # Jam 12: T1 (Smash) scores 2+2, passes to Blitz with 1+2+1; T2 scores 4+2+1, lead
        {"p":2,"j":4,"t1s":1,"t2s":3,"t1l":False,"t2l":True,
         "t1t":[2,2],"t1_sp":2,"t1_sp_t":[1,2,1],"t2t":[4,2,1]},
    ]
    
    for j_idx, jam in enumerate(JAMS):
        p = jam["p"]
        j = jam["j"]
        t1_s = jam["t1s"]  # starting jammer skater index
        t2_s = jam["t2s"]
        t1_skater_num = skaters_t1[t1_s][1]
        t2_skater_num = skaters_t2[t2_s - len(skaters_t1)][1]
        
        print(f"  Jam {j_idx+1}/12 (Period {p}, Jam {j}): {skaters_t1[t1_s][0]} vs {skaters_t2[t2_s - len(skaters_t1)][0]}...", end=" ", file=sys.stderr)
        
        # Add jam
        add_jam(p, j)
        
        # Set TeamJam basic fields
        t1_total = sum(jam["t1t"]) + (sum(jam["t1_sp_t"]) if "t1_sp_t" in jam else 0)
        t2_total = sum(jam["t2t"])
        
        # Set fielding — in real scoreboard, Fielding is keyed by FloorPosition name
        # Starting jammer at Fielding(Jammer)
        set_fielding(p, j, 1, "Jammer", t1_s, t1_skater_num)
        set_fielding(p, j, 2, "Jammer", t2_s, t2_skater_num)
        
        # Star pass recipient fielding
        if "t1_sp" in jam:
            sp_s = jam["t1_sp"]
            sp_num = skaters_t1[sp_s][1]
            set_fielding(p, j, 1, "Pivot", sp_s, sp_num)
            set_key(f"Period({p}).Jam({j}).TeamJam(1).StarPass", "true")
        
        # Add scoring trips
        t_trips = 0
        for t_idx, score in enumerate(jam["t1t"]):
            add_scoring_trip(p, j, 1, t_idx, score, after_sp=False)
            t_trips = t_idx + 1
        
        # Star pass trips
        if "t1_sp_t" in jam and jam["t1_sp_t"]:
            for sp_idx, score in enumerate(jam["t1_sp_t"]):
                add_scoring_trip(p, j, 1, t_trips + sp_idx, score, after_sp=True)
        
        for t_idx, score in enumerate(jam["t2t"]):
            add_scoring_trip(p, j, 2, t_idx, score, after_sp=False)
        
        # Set JamScore, Lead, etc.
        set_teamjam(p, j, 1, JamScore=t1_total, Lead="true" if jam["t1l"] else "false",
                    Lost="true" if (not jam["t1l"] and t1_total > 0) else "false")
        set_teamjam(p, j, 2, JamScore=t2_total, Lead="true" if jam["t2l"] else "false",
                    Lost="true" if (not jam["t2l"] and t2_total > 0) else "false")
        
        # Update team scores
        prev_t1 = sum(sum(jj["t1t"]) + (sum(jj.get("t1_sp_t", [])) if "t1_sp_t" in jj else 0) for jj in JAMS[:j_idx])
        prev_t2 = sum(sum(jj["t2t"]) for jj in JAMS[:j_idx])
        set_key(f"Team(1).Score", prev_t1 + t1_total)
        set_key(f"Team(2).Score", prev_t2 + t2_total)
        set_key(f"Team(1).JamScore", t1_total)
        set_key(f"Team(2).JamScore", t2_total)
        
        # Update TeamJam TotalScore (cumulative)
        set_teamjam(p, j, 1, TotalScore=prev_t1 + t1_total)
        set_teamjam(p, j, 2, TotalScore=prev_t2 + t2_total)
        
        print(f"done (T1: {t1_total}, T2: {t2_total})", file=sys.stderr)
        time.sleep(1.5)  # Let the view update
    
    final_t1 = sum(sum(jj["t1t"]) + (sum(jj.get("t1_sp_t", [])) if "t1_sp_t" in jj else 0) for jj in JAMS)
    final_t2 = sum(sum(jj["t2t"]) for jj in JAMS)
    
    print(f"\nGame complete! Final score: {final_t1} : {final_t2}", file=sys.stderr)
    
    ws.close()

if __name__ == "__main__":
    run_game()
