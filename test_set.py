#!/usr/bin/env python3
"""
Test setting values on the scoreboard after StartNewGame.
"""
import json, time, sys, websocket, traceback

ws = websocket.create_connection("ws://localhost:8000/WS/?source=operator")
ws.settimeout(3)
try: ws.recv()
except: pass

time.sleep(0.3)

# Create game
send_cmd = lambda **k: ws.send(json.dumps(k))
send_cmd(action="StartNewGame", data={
    "Team1": "WFTDA", "Team2": "WFTDA",
    "Ruleset": "wftda2018", "Advance": False,
})
time.sleep(0.5)

# Try setting team names
send_cmd(action="Set", key="ScoreBoard.CurrentGame.Team(1).Name", value="Thunderbirds", flag="")
send_cmd(action="Set", key="ScoreBoard.CurrentGame.Team(2).Name", value="Valkyries", flag="")
time.sleep(0.3)

# Register for updates to verify
send_cmd(action="Register", paths=["ScoreBoard.CurrentGame.Team(*).Name"])
time.sleep(0.5)

state = {}
while True:
    try:
        msg = ws.recv()
        d = json.loads(msg)
        if "state" in d:
            state.update(d["state"])
            print(f"Got update: {d['state']}", file=sys.stderr)
    except:
        break

ws.close()
