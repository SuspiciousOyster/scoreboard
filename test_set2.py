#!/usr/bin/env python3
"""
Set team names and skaters on the scoreboard with proper delays.
"""
import json, time, sys, websocket

ws = websocket.create_connection("ws://localhost:8000/WS/?source=operator2")
ws.settimeout(3)
try: ws.recv()
except: pass
time.sleep(0.5)

def sc(action, **kw):
    d = {"action": action}
    d.update(kw)
    ws.send(json.dumps(d))
    time.sleep(0.3)

# Create game
print("Creating game...", file=sys.stderr)
sc("StartNewGame", data={"Team1": "WFTDA", "Team2": "WFTDA", "Ruleset": "wftda2018", "Advance": False})
time.sleep(2)  # Wait for full initialization

# Set team names
print("Setting team names...", file=sys.stderr)
sc("Set", key="ScoreBoard.CurrentGame.Team(1).Name", value="Thunderbirds", flag="")
time.sleep(0.3)
sc("Set", key="ScoreBoard.CurrentGame.Team(2).Name", value="Valkyries", flag="")
time.sleep(0.5)

# Verify by registering
sc("Register", paths=["ScoreBoard.CurrentGame.Team(*).Name", "ScoreBoard.CurrentGame.Team(*).Score"])
time.sleep(1)

state = {}
while True:
    try:
        msg = ws.recv()
        d = json.loads(msg)
        if "state" in d:
            state.update(d["state"])
            for k, v in d["state"].items():
                print(f"  {k.split('.')[-2]}.{k.split('.')[-1]} = {v}", file=sys.stderr)
    except:
        break

ws.close()
