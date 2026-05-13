#!/usr/bin/env python3
"""
Full test: create game, register ALL paths, then set values
on the SAME connection and verify they propagate.
"""
import json, time, sys, websocket

ws = websocket.create_connection("ws://localhost:8000/WS/?source=op_full")
ws.settimeout(3)
time.sleep(0.3)

def send_wait(cmd, wait=1.5):
    ws.send(json.dumps(cmd))
    time.sleep(wait)
    ws.settimeout(1)
    while True:
        try:
            msg = ws.recv()
            d = json.loads(msg)
            if "state" in d:
                print(f"  STATE UPDATE: {d['state']}", file=sys.stderr)
            if "error" in d:
                print(f"  ERROR: {d['error']}", file=sys.stderr)
            if "authorization" in d:
                print(f"  AUTH: {d['authorization']}", file=sys.stderr)
        except:
            break

# Drain initial
ws.settimeout(0.5)
try:
    while True:
        msg = ws.recv()
        print(f"INITIAL: {msg[:200]}", file=sys.stderr)
except:
    pass

# Register for the paths we care about BEFORE setting them
print("Registering for paths...", file=sys.stderr)
send_wait({"action": "Register", "paths": [
    "ScoreBoard.CurrentGame.Team(1).Name",
    "ScoreBoard.CurrentGame.Team(2).Name",
    "ScoreBoard.CurrentGame.Team(1).Score",
    "ScoreBoard.Team(1).Name",
]}, wait=1)

# Now try setting
print("Setting Team(1).Name...", file=sys.stderr)
send_wait({"action": "Set", "key": "ScoreBoard.CurrentGame.Team(1).Name", "value": "Thunderbirds", "flag": ""}, wait=2)

print("Registering again to verify...", file=sys.stderr)
send_wait({"action": "Register", "paths": ["ScoreBoard.CurrentGame.Team(1).Name"]}, wait=1)

ws.close()
print("DONE", file=sys.stderr)
