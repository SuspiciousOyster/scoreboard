#!/usr/bin/env python3
"""Check what state paths the scoreboard has set."""
import json, sys, websocket, time

ws = websocket.create_connection("ws://localhost:8000/WS/?source=inspector")
ws.settimeout(3)

# Request the full state — fire a Register with dummy callback
# Actually, let's just check a few key paths by reading WS.state
# First, let's see what we can discover

# Read the state by requesting specific paths
keys_to_check = [
    "ScoreBoard.CurrentGame.Team(1).Name",
    "ScoreBoard.CurrentGame.Team(2).Name",
    "ScoreBoard.CurrentGame.Team(1).Score",
    "ScoreBoard.CurrentGame.Team(2).Score",
    "ScoreBoard.CurrentGame.Period(1).Jam(1).TeamJam(1).JamScore",
    "ScoreBoard.CurrentGame.Period(1).Jam(1).TeamJam(1).Lead",
    "ScoreBoard.CurrentGame.Period(1).Jam(1).TeamJam(1).Fielding(Jammer).Skater",
    "ScoreBoard.CurrentGame.Period(1).Jam(1).TeamJam(1).Fielding(Pivot).Skater",
    "ScoreBoard.CurrentGame.Period(1).Jam(1).TeamJam(1).ScoringTrip(0).Score",
    "ScoreBoard.CurrentGame.Period(1).Jam(1).TeamJam(1).ScoringTrip(0).AfterSP",
    "ScoreBoard.CurrentGame.Period(8).Jam(8).TeamJam(1).ScoringTrip(2).AfterSP",
    "ScoreBoard.CurrentGame.Period(1).Jam(8).TeamJam(1).ScoringTrip(2).AfterSP",
    "ScoreBoard.CurrentGame.Period(2).Jam(4).TeamJam(1).ScoringTrip(2).AfterSP",
]

# Instead, let's just fetch the full state from the WS
# by Registering all paths
import json

# Register all paths to get the initial state dump
register_msg = json.dumps({"action": "Register", "paths": [k for k in keys_to_check]})
ws.send(register_msg)
time.sleep(0.5)
ws.settimeout(2)

got = set()
while True:
    try:
        msg = ws.recv()
        data = json.loads(msg)
        for k, v in (data.get("state") or {}).items():
            if k not in got:
                got.add(k)
    except:
        break

print("State paths found:")
for k in sorted(got):
    print(f"  {k}")

ws.close()
