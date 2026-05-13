#!/usr/bin/env python3
"""Connect via WebSocket and dump fielding + teamjam state paths."""
import json, sys, websocket, time

ws = websocket.create_connection("ws://localhost:8000/WS/?source=checker")

# Register for all TeamJam, Fielding, ScoringTrip paths
register = {"action": "Register", "paths": [
    "ScoreBoard.CurrentGame.Period(*).Jam(*).TeamJam(*).*",
    "ScoreBoard.CurrentGame.Team(*).Score",
    "ScoreBoard.CurrentGame.Team(*).Name",
]}
ws.send(json.dumps(register))

ws.settimeout(1)
time.sleep(0.5)

state = {}
while True:
    try:
        msg = ws.recv()
        d = json.loads(msg)
        if "state" in d:
            state.update(d["state"])
    except:
        break

# Print relevant paths
relevant = {k: v for k, v in state.items() if "Fielding" in k or "ScoringTrip" in k or "JamScore" in k or "Lead" in k or "TeamJam" in k or "StarPass" in k or "Score" in k}
for k in sorted(relevant.keys()):
    print(f"  {k} = {state[k]}")

ws.close()
