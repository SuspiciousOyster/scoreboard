#!/usr/bin/env python3
"""
Drive the CRG ScoreBoard -- properly, with StartNewGame first.
"""
import json, time, sys, websocket

PREFIX = "ScoreBoard.CurrentGame"
ws = None

def send(cmd):
    ws.send(json.dumps(cmd))
    time.sleep(0.05)

def set_key(key, value, flag=""):
    send({"action": "Set", "key": f"{PREFIX}.{key}", "value": str(value), "flag": flag})

def cmd(action, data=None):
    send({"action": action, "data": data or {}})

# Connect
ws = websocket.create_connection("ws://localhost:8000/WS/?source=script")
ws.settimeout(3)
try:
    msg = ws.recv()
    print(f"Connected. Initial: {len(msg)} bytes", file=sys.stderr)
except:
    pass

time.sleep(0.3)

# Step 1: Create a new game
print("Creating game...", file=sys.stderr)
cmd("StartNewGame", {
    "Team1": "WFTDA",
    "Team2": "WFTDA", 
    "Ruleset": "wftda2018",
    "Advance": False,
})
time.sleep(0.5)

# Step 2: Read back state to confirm
ws.send(json.dumps({"action": "Register", "paths": [
    "ScoreBoard.CurrentGame.Team(*).Name",
    "ScoreBoard.CurrentGame.Team(*).Score",
]}))
time.sleep(0.5)
try:
    msg = ws.recv()
    data = json.loads(msg)
    for k, v in (data.get("state") or {}).items():
        print(f"  {k.split('.')[-1]} = {v}", file=sys.stderr)
except:
    print("  (no state response)", file=sys.stderr)

print("\nDone. Ready for manual operation.", file=sys.stderr)
print("Open http://localhost:8000/custom/view/announcer-jammers.html", file=sys.stderr)

ws.close()
