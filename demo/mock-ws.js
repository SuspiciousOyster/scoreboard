/**
 * mock-ws.js — Fake WebSocket engine for the Announcer Jammers Demo
 *
 * Implements the same API surface as CRG ScoreBoard's core.js:
 *   - WS.state (flat key-value object)
 *   - WS.Register(paths, callback)
 *   - WS.AfterLoad(callback)
 *   - WS.Set(path, value)
 *
 * Also provides:
 *   - startGameScenario() — begins the scripted game
 *   - resetScenario() — resets all state for replay
 */

(function () {
  'use strict';

  /* ── Mock WS Object ── */

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
      // Fire relevant callbacks
      var self = this;
      this._callbacks.forEach(function (entry) {
        entry.paths.forEach(function (p) {
          // Simple wildcard match — (*) matches any single segment
          var pattern = p
            .replace(/\./g, '\\.')
            .replace(/\(\*\)/g, '([^)]+)')
            .replace(/\(\\\*\)/g, '(.+)');
          var re = new RegExp('^' + pattern + '$');
          if (re.test(path)) {
            try { entry.cb(); } catch (e) { /* swallow render errors */ }
            return;
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

  // Helper for isTrue (some render code uses global isTrue)
  window.isTrue = function (v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  };

  // Time conversions (some render code references _timeConversions)
  window._timeConversions = {
    msToMinSec: function (ms) {
      var totalSec = Math.max(0, Math.floor((parseInt(ms, 10) || 0) / 1000));
      var m = Math.floor(totalSec / 60);
      var s = totalSec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
  };

  /* ═══════════════════════════════════════════
   *  Scripted Game Scenario
   * ═══════════════════════════════════════════ */

  var PREFIX = 'ScoreBoard.CurrentGame';
  var _timer = null;
  var _currentStep = -1;
  var _running = false;

  // Skater definitions
  var TEAM1_SKATERS = [
    { name: 'Bones', number: '420' },
    { name: 'Smash', number: '777' },
    { name: 'Blitz', number: '99' }
  ];
  var TEAM2_SKATERS = [
    { name: 'Viper', number: '13' },
    { name: 'Fury', number: '8' },
    { name: 'Blade', number: '42' }
  ];

  // Scripted jams: each jam has team1 and team2 data
  // scoringTrips are per-scoring-pass points
  // starPass: if true, starting jammer passes to a different skater
  var SCRIPTED_JAMS = [
    {
      team1: { jammer: 0, leading: true, scoringTrips: [4, 3] },
      team2: { jammer: 3, leading: false, scoringTrips: [1] }
    },
    {
      team1: { jammer: 0, leading: false, scoringTrips: [1] },
      team2: { jammer: 3, leading: true, scoringTrips: [3, 2, 2] }
    },
    {
      team1: { jammer: 1, leading: true, scoringTrips: [3, 1] },
      team2: { jammer: 4, leading: false, scoringTrips: [2] }
    },
    {
      team1: { jammer: 0, leading: true, scoringTrips: [5] },
      team2: { jammer: 3, leading: false, scoringTrips: [] }
    },
    {
      team1: { jammer: 1, leading: false, scoringTrips: [] },
      team2: { jammer: 4, leading: true, scoringTrips: [4, 1, 1] }
    },
    {
      team1: { jammer: 0, leading: true, scoringTrips: [2, 2, 1] },
      team2: { jammer: 3, leading: false, scoringTrips: [1] }
    },
    {
      team1: { jammer: 0, leading: false, scoringTrips: [1] },
      team2: { jammer: 5, leading: true, scoringTrips: [3] }
    },
    {
      // Star pass: "Blitz" (#99) receives star pass from "Smash" (#777)
      team1: { jammer: 1, leading: true, scoringTrips: [3], starPassTo: 2, afterSPTrips: [2] },
      team2: { jammer: 4, leading: false, scoringTrips: [1] }
    },
    {
      team1: { jammer: 0, leading: true, scoringTrips: [4, 2] },
      team2: { jammer: 3, leading: false, scoringTrips: [] }
    },
    {
      team1: { jammer: 2, leading: false, scoringTrips: [2] },
      team2: { jammer: 5, leading: true, scoringTrips: [5] }
    },
    {
      team1: { jammer: 0, leading: true, scoringTrips: [3, 3] },
      team2: { jammer: 4, leading: false, scoringTrips: [2, 1] }
    },
    {
      // Star pass demo: Smash starts, does 2 passes, passes to Blitz who does 3
      team1: { jammer: 1, leading: false, scoringTrips: [2, 2], starPassTo: 2, afterSPTrips: [1, 2, 1] },
      team2: { jammer: 3, leading: true, scoringTrips: [4, 2, 1] }
    }
  ];

  /**
   * Reset WS.state to initial (empty game with teams set).
   */
  function resetState() {
    var s = WS.state;

    // Clear everything
    Object.keys(s).forEach(function (k) { delete s[k]; });

    // Team 1
    s[PREFIX + '.Team(1).Name'] = 'Thunderbirds';
    s[PREFIX + '.Team(1).AlternateName(operator)'] = 'THUNDER';
    s[PREFIX + '.Team(1).Score'] = '0';
    s[PREFIX + '.Team(1).JamScore'] = '0';
    s[PREFIX + '.Team(1).Timeouts'] = '3';
    s[PREFIX + '.Team(1).OfficialReviews'] = '2';
    s[PREFIX + '.Team(1).TotalPenalties'] = '0';
    s[PREFIX + '.Team(1).Color(overlay.bg)'] = '#1f6feb';
    s[PREFIX + '.Team(1).Color(overlay.fg)'] = '#ffffff';

    // Team 2
    s[PREFIX + '.Team(2).Name'] = 'Valkyries';
    s[PREFIX + '.Team(2).AlternateName(operator)'] = 'VALKYRIE';
    s[PREFIX + '.Team(2).Score'] = '0';
    s[PREFIX + '.Team(2).JamScore'] = '0';
    s[PREFIX + '.Team(2).Timeouts'] = '3';
    s[PREFIX + '.Team(2).OfficialReviews'] = '2';
    s[PREFIX + '.Team(2).TotalPenalties'] = '0';
    s[PREFIX + '.Team(2).Color(overlay.bg)'] = '#da3633';
    s[PREFIX + '.Team(2).Color(overlay.fg)'] = '#ffffff';

    // Skaters
    TEAM1_SKATERS.forEach(function (sk, i) {
      s[PREFIX + '.Team(1).Skater(' + i + ').Name'] = sk.name;
      s[PREFIX + '.Team(1).Skater(' + i + ').RosterNumber'] = sk.number;
    });
    TEAM2_SKATERS.forEach(function (sk, i) {
      var idx = i + TEAM1_SKATERS.length; // 3, 4, 5
      s[PREFIX + '.Team(2).Skater(' + idx + ').Name'] = sk.name;
      s[PREFIX + '.Team(2).Skater(' + idx + ').RosterNumber'] = sk.number;
    });

    // Initial clock state — pre-game
    s[PREFIX + '.InJam'] = 'false';
    s[PREFIX + '.Clock(Period).Time'] = '1800000';
    s[PREFIX + '.Clock(Jam).Time'] = '120000';
    s[PREFIX + '.Clock(Timeout).Running'] = 'false';
    s[PREFIX + '.Clock(Lineup).Running'] = 'true';
    s[PREFIX + '.Clock(Intermission).Running'] = 'false';
    s[PREFIX + '.Clock(Intermission).Number'] = '0';
    s[PREFIX + '.OfficialScore'] = 'false';
    s[PREFIX + '.ClockDuringFinalScore'] = 'false';
    s[PREFIX + '.TimeoutOwner'] = '';
    s[PREFIX + '.OfficialReview'] = 'false';
    s[PREFIX + '.Rule(Period.Number)'] = '1';
  }

  /**
   * Apply a jam's data to WS.state.
   */
  function applyJam(jamIdx, jamData) {
    var s = WS.state;
    var period = 1;
    var jam = jamIdx + 1; // 1-indexed

    // Period time ticks down
    var periodTime = 1800000 - (jamIdx * 90000);
    s[PREFIX + '.Clock(Period).Time'] = String(Math.max(periodTime, 0));
    s[PREFIX + '.Rule(Period.Number)'] = jam > 7 ? '2' : '1';

    if (jam > 7) {
      period = 2;
      jam = jam - 7;
      periodTime = 1800000 - ((jamIdx - 7) * 90000);
      s[PREFIX + '.Clock(Period).Time'] = String(Math.max(periodTime, 0));
    }

    // ── Phase: Lineup ──
    s[PREFIX + '.InJam'] = 'false';
    s[PREFIX + '.Clock(Jam).Time'] = '120000';
    s[PREFIX + '.Clock(Lineup).Running'] = 'true';
    s[PREFIX + '.Clock(Intermission).Running'] = 'false';
    s[PREFIX + '.Clock(Timeout).Running'] = 'false';

    // Set team jam scores to 0 for this jam
    s[PREFIX + '.Team(1).JamScore'] = '0';
    s[PREFIX + '.Team(2).JamScore'] = '0';

    // Calculate team total scores so far
    var t1Total = 0;
    var t2Total = 0;
    for (var i = 0; i < jamIdx; i++) {
      var prevJam = SCRIPTED_JAMS[i];
      if (prevJam.team1 && prevJam.team1.scoringTrips) {
        prevJam.team1.scoringTrips.forEach(function (p) { t1Total += p; });
        if (prevJam.team1.afterSPTrips) {
          prevJam.team1.afterSPTrips.forEach(function (p) { t1Total += p; });
        }
      }
      if (prevJam.team2 && prevJam.team2.scoringTrips) {
        prevJam.team2.scoringTrips.forEach(function (p) { t2Total += p; });
      }
    }

    // ── Set fielding and team jam data for this jam ──

    // Team 1 fielding
    var t1JammerIdx = jamData.team1.jammer;
    var t1JammerRef = 'Skater(' + t1JammerIdx + ')';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Fielding(Jammer).Skater'] = t1JammerRef;
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Fielding(Jammer).SkaterNumber'] = TEAM1_SKATERS[t1JammerIdx].number;
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Fielding(Jammer).Position'] = 'Jammer';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Fielding(Jammer).NotFielded'] = 'false';

    // Team 2 fielding
    var t2JammerIdx = jamData.team2.jammer;
    // Map global skater index (3,4,5) to local TEAM2_SKATERS index (0,1,2)
    var t2LocalIdx = t2JammerIdx - TEAM1_SKATERS.length;
    var t2JammerRef = 'Skater(' + t2JammerIdx + ')';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).Fielding(Jammer).Skater'] = t2JammerRef;
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).Fielding(Jammer).SkaterNumber'] = TEAM2_SKATERS[t2LocalIdx].number;
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).Fielding(Jammer).Position'] = 'Jammer';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).Fielding(Jammer).NotFielded'] = 'false';

    // Team 1 TeamJam fields
    var t1JamScore = 0;
    if (jamData.team1.scoringTrips) {
      jamData.team1.scoringTrips.forEach(function (p) { t1JamScore += p; });
    }
    if (jamData.team1.afterSPTrips) {
      jamData.team1.afterSPTrips.forEach(function (p) { t1JamScore += p; });
    }
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).JamScore'] = String(t1JamScore);
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Lead'] = jamData.team1.leading ? 'true' : 'false';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Lost'] = (!jamData.team1.leading && t1JamScore > 0) ? 'true' : 'false';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).StarPass'] = jamData.team1.starPassTo !== undefined ? 'true' : 'false';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).TotalScore'] = String(t1Total);

    // Scoring trips — Team 1
    if (jamData.team1.scoringTrips) {
      jamData.team1.scoringTrips.forEach(function (pts, idx) {
        s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).ScoringTrip(' + idx + ').Score'] = String(pts);
        s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).ScoringTrip(' + idx + ').AfterSP'] = 'false';
      });
    }
    if (jamData.team1.afterSPTrips) {
      var baseIdx = (jamData.team1.scoringTrips || []).length;
      jamData.team1.afterSPTrips.forEach(function (pts, idx) {
        s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).ScoringTrip(' + (baseIdx + idx) + ').Score'] = String(pts);
        s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).ScoringTrip(' + (baseIdx + idx) + ').AfterSP'] = 'true';
      });
    }

    // Star pass recipient fielding — Team 1
    if (jamData.team1.starPassTo !== undefined) {
      s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Fielding(Pivot).Skater'] = 'Skater(' + jamData.team1.starPassTo + ')';
      s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Fielding(Pivot).SkaterNumber'] = TEAM1_SKATERS[jamData.team1.starPassTo].number;
      s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Fielding(Pivot).Position'] = 'Jammer';
    }

    // Team 2 TeamJam fields
    var t2JamScore = 0;
    if (jamData.team2.scoringTrips) {
      jamData.team2.scoringTrips.forEach(function (p) { t2JamScore += p; });
    }
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).JamScore'] = String(t2JamScore);
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).Lead'] = jamData.team2.leading ? 'true' : 'false';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).Lost'] = (!jamData.team2.leading && t2JamScore > 0) ? 'true' : 'false';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).StarPass'] = 'false';
    s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).TotalScore'] = String(t2Total);

    // Scoring trips — Team 2
    if (jamData.team2.scoringTrips) {
      jamData.team2.scoringTrips.forEach(function (pts, idx) {
        s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).ScoringTrip(' + idx + ').Score'] = String(pts);
        s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).ScoringTrip(' + idx + ').AfterSP'] = 'false';
      });
    }

    // ── Update team total scores ──
    t1Total += t1JamScore;
    t2Total += t2JamScore;
    s[PREFIX + '.Team(1).Score'] = String(t1Total);
    s[PREFIX + '.Team(2).Score'] = String(t2Total);
    s[PREFIX + '.Team(1).JamScore'] = String(t1JamScore);
    s[PREFIX + '.Team(2).JamScore'] = String(t2JamScore);

    // ── Phase: In Jam ──
    s[PREFIX + '.InJam'] = 'true';
    s[PREFIX + '.Clock(Jam).Time'] = '75000';
    s[PREFIX + '.Clock(Lineup).Running'] = 'false';

    // Fire WS.Set for the currently changed paths to trigger callbacks
    // We fire a batch of key paths
    var pathsToFire = [
      PREFIX + '.InJam',
      PREFIX + '.Team(1).Score',
      PREFIX + '.Team(2).Score',
      PREFIX + '.Team(1).JamScore',
      PREFIX + '.Team(2).JamScore',
      PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).JamScore',
      PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).JamScore',
      PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(1).Lead',
      PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(2).Lead'
    ];
    pathsToFire.forEach(function (p) {
      // Use WS.Set to trigger callbacks
      var val = s[p];
      if (val !== undefined) {
        // Directly invoke the Set logic
        WS._callbacks.forEach(function (entry) {
          entry.paths.forEach(function (pattern) {
            var reStr = pattern
              .replace(/\./g, '\\.')
              .replace(/\(\*\)/g, '([^)]+)');
            var re = new RegExp('^' + reStr + '$');
            if (re.test(p)) {
              try { entry.cb(); } catch (e) { /* swallow */ }
            }
          });
        });
      }
    });

    // Force full render after each jam via the exposed global
    if (typeof window._announcerJammersRender === 'function') {
      try { window._announcerJammersRender(); } catch (e) { /* swallow */ }
    }
  }

  /**
   * Start the scripted game scenario.
   */
  function startGameScenario() {
    if (_running) return;
    _running = true;
    _currentStep = -1;

    resetState();

    // Fire AfterLoad
    WS._fireAfterLoad();

    // Progress through jams with delays
    var stepDelay = 4500; // ms between each jam
    var introDelay = 2500; // ms before first jam

    _currentStep = -1;

    function nextStep() {
      _currentStep++;
      if (_currentStep >= SCRIPTED_JAMS.length) {
        // Game over — all jams played
        _running = false;
        return;
      }

      applyJam(_currentStep, SCRIPTED_JAMS[_currentStep]);

      _timer = setTimeout(nextStep, stepDelay);
    }

    _timer = setTimeout(nextStep, introDelay);
  }

  /**
   * Reset and stop.
   */
  function resetScenario() {
    if (_timer) {
      clearTimeout(_timer);
      _timer = null;
    }
    _running = false;
    _currentStep = -1;
    resetState();
    if (typeof fullRender === 'function') {
      try { fullRender(); } catch (e) { /* swallow */ }
    }
  }

  // Expose scenario controls
  window.startGameScenario = startGameScenario;
  window.resetScenario = resetScenario;

})();
