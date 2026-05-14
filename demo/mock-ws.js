/**
 * mock-ws.js — Demo test harness for Announcer Jammers View
 *
 * Provides a lightweight WS mock that exposes the same API surface as
 * CRG ScoreBoard's core.js (WS.state, WS.Register, WS.Set, WS.AfterLoad),
 * and a scripted game scenario that steps through jams on a timer.
 *
 * This file is demo-specific. It does NOT duplicate any render logic —
 * it only produces WS state keys in the scoreboard's wire format.
 * The announcer-jammers-render.js handles all display logic via WS.Register.
 *
 * Scenario data format mimics what the real CRG ScoreBoard sends over WebSocket.
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════
   *  WS Mock
   * ═══════════════════════════════════════════ */

  window.WS = {
    state: {},
    _callbacks: [],
    _afterLoad: [],
    _loaded: false,

    Register: function (paths, cb) {
      if (typeof paths === 'string') paths = [paths];
      if (cb) {
        this._callbacks.push({ paths: paths, cb: cb });
      }
    },

    Set: function (path, val) {
      this.state[path] = val;
      // Fire callbacks whose pattern matches this path
      var self = this;
      this._callbacks.forEach(function (entry) {
        entry.paths.forEach(function (pattern) {
          var reStr = pattern
            .replace(/\./g, '\\.')
            .replace(/\(\*\)/g, '([^)]+)');
          if (new RegExp('^' + reStr + '$').test(path)) {
            try { entry.cb(); } catch (e) { /* swallow render errors */ }
          }
        });
      });
    },

    AfterLoad: function (cb) {
      if (this._loaded) {
        setTimeout(cb, 0);
      } else {
        this._afterLoad.push(cb);
      }
    },

    _fireAfterLoad: function () {
      this._loaded = true;
      var self = this;
      this._afterLoad.forEach(function (cb) {
        setTimeout(cb, 0);
      });
    }
  };

  // isTrue helper (some render code references global isTrue)
  window.isTrue = function (v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  };

  /* ═══════════════════════════════════════════
   *  Scenario Data
   * ═══════════════════════════════════════════
   *
   * Pure data. No render logic, no WS.Register knowledge.
   * Each jam defines the state the scoreboard would produce.
   * A helper (applyJam) translates this into WS.Set() calls.
   */

  var PREFIX = 'ScoreBoard.CurrentGame';

  var SCENARIO = {
    teams: [
      {
        name: 'Thunderbirds',
        altName: 'THUNDER',
        colorBg: '#1f6feb',
        colorFg: '#ffffff',
        skaters: [
          { name: 'Bones', number: '420', penalties: ['IllegalProcedure'] },
          { name: 'Smash', number: '777', penalties: ['BackBlock', 'Cutting'] },
          { name: 'Blitz', number: '99', penalties: ['HighBlock'] }
        ],
        timeouts: 3,
        reviews: 2
      },
      {
        name: 'Valkyries',
        altName: 'VALKYRIE',
        colorBg: '#da3633',
        colorFg: '#ffffff',
        skaters: [
          { name: 'Viper', number: '13', penalties: ['LowBlock', 'Interference'] },
          { name: 'Fury', number: '8', penalties: ['DirectionOfPlay'] },
          { name: 'Blade', number: '42', penalties: ['IllegalContact'] }
        ],
        timeouts: 3,
        reviews: 2
      }
    ],

    // Each jam: t1=team 0, t2=team 1
    // jammer = index into team's skaters array
    // scoringTrips = per-pass points before star pass
    // afterSPTrips = points after star pass (if starPassTo is set)
    jams: [
      { t1: { jammer: 0, lead: true,  scoringTrips: [4, 3] },               t2: { jammer: 0, lead: false, scoringTrips: [1] } },
      { t1: { jammer: 0, lead: false, scoringTrips: [1] },                  t2: { jammer: 0, lead: true,  scoringTrips: [3, 2, 2] } },
      { t1: { jammer: 1, lead: true,  scoringTrips: [3, 1] },               t2: { jammer: 1, lead: false, scoringTrips: [2] } },
      { t1: { jammer: 0, lead: true,  scoringTrips: [5] },                  t2: { jammer: 0, lead: false, scoringTrips: [] } },
      { t1: { jammer: 1, lead: false, scoringTrips: [] },                   t2: { jammer: 1, lead: true,  scoringTrips: [4, 1, 1] } },
      { t1: { jammer: 0, lead: true,  scoringTrips: [2, 2, 1] },            t2: { jammer: 0, lead: false, scoringTrips: [1] } },
      { t1: { jammer: 0, lead: false, scoringTrips: [1] },                  t2: { jammer: 2, lead: true,  scoringTrips: [3] } },
      // Star pass jam: Smash starts, passes to Blitz
      { t1: { jammer: 1, lead: true,  scoringTrips: [3], starPassTo: 2, afterSPTrips: [2] }, t2: { jammer: 1, lead: false, scoringTrips: [1] } },
      { t1: { jammer: 0, lead: true,  scoringTrips: [4, 2] },               t2: { jammer: 0, lead: false, scoringTrips: [] } },
      { t1: { jammer: 2, lead: false, scoringTrips: [2] },                  t2: { jammer: 2, lead: true,  scoringTrips: [5] } },
      { t1: { jammer: 0, lead: true,  scoringTrips: [3, 3] },               t2: { jammer: 1, lead: false, scoringTrips: [2, 1] } },
      // Star pass: Smash does 2 passes, passes to Blitz who does 3
      { t1: { jammer: 1, lead: false, scoringTrips: [2, 2], starPassTo: 2, afterSPTrips: [1, 2, 1] }, t2: { jammer: 0, lead: true, scoringTrips: [4, 2, 1] } }
    ]
  };

  /* ═══════════════════════════════════════════
   *  State Helpers
   * ═══════════════════════════════════════════ */

  /**
   * Populate initial WS.state with teams, skaters, penalties, clock.
   * Uses WS.Set so WS.Register callbacks fire and the view updates.
   */
  function initState() {
    var s = WS.state;

    // Clear everything
    Object.keys(s).forEach(function (k) { delete s[k]; });

    // — Team setup —
    SCENARIO.teams.forEach(function (team, tIdx) {
      var t = tIdx + 1;
      WS.Set(PREFIX + '.Team(' + t + ').Name', team.name);
      WS.Set(PREFIX + '.Team(' + t + ').AlternateName(operator)', team.altName);
      WS.Set(PREFIX + '.Team(' + t + ').Score', '0');
      WS.Set(PREFIX + '.Team(' + t + ').JamScore', '0');
      WS.Set(PREFIX + '.Team(' + t + ').Timeouts', String(team.timeouts));
      WS.Set(PREFIX + '.Team(' + t + ').OfficialReviews', String(team.reviews));
      WS.Set(PREFIX + '.Team(' + t + ').Color(overlay.bg)', team.colorBg);
      WS.Set(PREFIX + '.Team(' + t + ').Color(overlay.fg)', team.colorFg);

      // — Skaters + Penalties —
      var totalPens = 0;
      team.skaters.forEach(function (sk, sIdx) {
        // Global skater index (sequential across teams)
        var globalIdx = tIdx === 0 ? sIdx : sIdx + SCENARIO.teams[0].skaters.length;
        WS.Set(PREFIX + '.Team(' + t + ').Skater(' + globalIdx + ').Name', sk.name);
        WS.Set(PREFIX + '.Team(' + t + ').Skater(' + globalIdx + ').RosterNumber', sk.number);

        if (sk.penalties && sk.penalties.length > 0) {
          WS.Set(PREFIX + '.Team(' + t + ').Skater(' + globalIdx + ').PenaltyCount', String(sk.penalties.length));
          sk.penalties.forEach(function (code, pIdx) {
            WS.Set(PREFIX + '.Team(' + t + ').Skater(' + globalIdx + ').Penalty(' + pIdx + ').Code', code);
          });
          totalPens += sk.penalties.length;
        }
      });
      WS.Set(PREFIX + '.Team(' + t + ').TotalPenalties', String(totalPens));
    });

    // — Clock state —
    WS.Set(PREFIX + '.InJam', 'false');
    WS.Set(PREFIX + '.Clock(Period).Time', '1800000');
    WS.Set(PREFIX + '.Clock(Jam).Time', '120000');
    WS.Set(PREFIX + '.Clock(Timeout).Running', 'false');
    WS.Set(PREFIX + '.Clock(Lineup).Running', 'true');
    WS.Set(PREFIX + '.Clock(Intermission).Running', 'false');
    WS.Set(PREFIX + '.Clock(Intermission).Number', '0');
    WS.Set(PREFIX + '.OfficialScore', 'false');
    WS.Set(PREFIX + '.ClockDuringFinalScore', 'false');
    WS.Set(PREFIX + '.TimeoutOwner', '');
    WS.Set(PREFIX + '.OfficialReview', 'false');
    WS.Set(PREFIX + '.Rule(Period.Number)', '1');
  }

  /**
   * Apply a single jam's data to WS.state via WS.Set.
   * Converts the clean scenario format into scoreboard wire-format keys.
   */
  function applyJam(jamIdx, jamData) {
    var period = 1;
    var jamNum = jamIdx + 1; // 1-indexed

    // Period transition at jam 8
    if (jamNum > 7) {
      period = 2;
      jamNum = jamNum - 7;
    }

    // Update clock
    var periodTime = 1800000 - (jamIdx * 90000);
    WS.Set(PREFIX + '.Clock(Period).Time', String(Math.max(periodTime, 0)));
    WS.Set(PREFIX + '.InJam', 'true');
    WS.Set(PREFIX + '.Clock(Jam).Time', '75000');
    WS.Set(PREFIX + '.Clock(Lineup).Running', 'false');

    // Clear stale BoxTrip entries from previous jams so power jam ⚡
    // detection only reacts to the current jam's penalty state
    Object.keys(WS.state).forEach(function (key) {
      if (/^ScoreBoard\.CurrentGame\.Team\(\d+\)\.BoxTrip\(/.test(key)) {
        delete WS.state[key];
      }
    });

    // Sweep both teams
    [1, 2].forEach(function (teamNum) {
      var key = 't' + teamNum;  // 't1' or 't2' in scenario data
      var td = jamData[key];
      var base = PREFIX + '.Period(' + period + ').Jam(' + jamNum + ').TeamJam(' + teamNum + ')';

      // Jammer fielding
      var teamIdx = teamNum - 1;
      var teamSkaters = SCENARIO.teams[teamIdx].skaters;
      var jammerSkaters = SCENARIO.teams[0].skaters; // global index calc
      var globalSkaters = SCENARIO.teams[0].skaters.concat(SCENARIO.teams[1].skaters);

      // Map team-local jammer index to global skater index
      var skaterGlobalIdx = teamIdx === 0
        ? td.jammer
        : td.jammer + SCENARIO.teams[0].skaters.length;

      WS.Set(base + '.Fielding(Jammer).Skater', 'Skater(' + skaterGlobalIdx + ')');
      WS.Set(base + '.Fielding(Jammer).SkaterNumber', globalSkaters[skaterGlobalIdx].number);
      WS.Set(base + '.Fielding(Jammer).Position', 'Jammer');
      WS.Set(base + '.Fielding(Jammer).NotFielded', 'false');

      // Jam score
      var jamScore = sum(td.scoringTrips) + sum(td.afterSPTrips);
      WS.Set(base + '.JamScore', String(jamScore));
      WS.Set(base + '.Lead', td.lead ? 'true' : 'false');
      WS.Set(base + '.Lost', (!td.lead && jamScore > 0) ? 'true' : 'false');
      WS.Set(base + '.StarPass', td.starPassTo !== undefined ? 'true' : 'false');

      // Scoring trips (before star pass)
      if (td.scoringTrips) {
        td.scoringTrips.forEach(function (pts, i) {
          WS.Set(base + '.ScoringTrip(' + i + ').Score', String(pts));
          WS.Set(base + '.ScoringTrip(' + i + ').AfterSP', 'false');
        });
      }

      // Scoring trips after star pass
      if (td.afterSPTrips) {
        var tripOffset = (td.scoringTrips || []).length;
        td.afterSPTrips.forEach(function (pts, i) {
          WS.Set(base + '.ScoringTrip(' + (tripOffset + i) + ').Score', String(pts));
          WS.Set(base + '.ScoringTrip(' + (tripOffset + i) + ').AfterSP', 'true');
        });
      }

      // Star pass recipient fielding
      if (td.starPassTo !== undefined) {
        var spGlobalIdx = teamIdx === 0
          ? td.starPassTo
          : td.starPassTo + SCENARIO.teams[0].skaters.length;
        WS.Set(base + '.Fielding(Pivot).Skater', 'Skater(' + spGlobalIdx + ')');
        WS.Set(base + '.Fielding(Pivot).SkaterNumber', globalSkaters[spGlobalIdx].number);
        WS.Set(base + '.Fielding(Pivot).Position', 'Jammer');
      }

      // Box trips (for power jam ⚡ detection)
      // When a team scores 0, their jammer likely served box time
      if (jamScore === 0 && !td.lead) {
        for (var bt = 0; bt < 1; bt++) {
          WS.Set(PREFIX + '.Team(' + teamNum + ').BoxTrip(' + bt + ').PenaltyTime', '120000');
          WS.Set(PREFIX + '.Team(' + teamNum + ').BoxTrip(' + bt + ').Serving', 'true');
        }
      }
    });

    // Force the render to run with the new state.
    // The WS.Set → WS.Register callback chain debounces renders,
    // but the render's queueRender depends on matching WS.Register
    // patterns, which the demo scenario runner may produce keys
    // the render doesn't track. We call the exposed render function
    // directly to ensure the view updates after each jam.
    if (typeof window._announcerJammersRender === 'function') {
      try { window._announcerJammersRender(); } catch (e) { /* swallow */ }
    }
  }

  function sum(arr) {
    if (!arr) return 0;
    return arr.reduce(function (a, b) { return a + b; }, 0);
  }

  /* ═══════════════════════════════════════════
   *  Scenario Runner
   * ═══════════════════════════════════════════ */

  var _timer = null;
  var _running = false;
  var _currentStep = -1;

  function startGameScenario() {
    if (_running) return;
    _running = true;
    _currentStep = -1;

    initState();
    WS._fireAfterLoad();

    var stepDelay = 4500; // ms between jams
    var introDelay = 2500; // initial delay before first jam

    _currentStep = -1;

    function nextStep() {
      _currentStep++;
      if (_currentStep >= SCENARIO.jams.length) {
        _running = false;
        return;
      }
      applyJam(_currentStep, SCENARIO.jams[_currentStep]);
      _timer = setTimeout(nextStep, stepDelay);
    }

    _timer = setTimeout(nextStep, introDelay);
  }

  function resetScenario() {
    if (_timer) {
      clearTimeout(_timer);
      _timer = null;
    }
    _running = false;
    _currentStep = -1;
    initState();
  }

  // Expose scenario controls
  window.startGameScenario = startGameScenario;
  window.resetScenario = resetScenario;

})();
