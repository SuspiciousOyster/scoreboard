#!/usr/bin/env python3
"""Check connection metadata to verify write access."""
import json, time, sys, websocket

ws = websocket.create_connection("ws://localhost:8000/WS/?source=operator3")
ws.settimeout(3)
time.sleep(0.5)

try:
    msg = ws.recv()
    d = json.loads(msg)
    for k, v in d.get("state", {}).items():
        print(f"  {k} = {v}", file=sys.stderr)
except:
    print("  No initial state", file=sys.stderr)

ws.close()
