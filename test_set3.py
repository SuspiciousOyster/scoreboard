#!/usr/bin/env python3
"""
Test with explicit paths and print any error responses.
"""
import json, time, sys, websocket

ws = websocket.create_connection("ws://localhost:8000/WS/?source=operator_test")
ws.settimeout(3)
time.sleep(0.3)

# Drain initial
try:
    while True:
        msg = ws.recv()
        print(f"INITIAL: {msg[:200]}", file=sys.stderr)
except:
    pass

# Try setting
test_paths = [
    ("ScoreBoard.CurrentGame.Team(1).Name", "Thunderbirds"),
    ("ScoreBoard.Team(1).Name", "Thunderbirds"),
]

for path, val in test_paths:
    msg = json.dumps({"action": "Set", "key": path, "value": val, "flag": ""})
    print(f"SEND: {msg}", file=sys.stderr)
    ws.send(msg)
    time.sleep(0.3)
    # Check for response
    ws.settimeout(0.5)
    try:
        msg = ws.recv()
        print(f"RESP: {msg[:300]}", file=sys.stderr)
    except:
        print(f"  (no response)", file=sys.stderr)

ws.close()
