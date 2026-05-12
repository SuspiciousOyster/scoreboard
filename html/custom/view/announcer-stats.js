(function () {
  'use strict';

  /* ═══════════════════════════════════════════
   * Announcer Statistics Dashboard — JS Logic
   *
   * Sections A–F for CRG ScoreBoard custom view.
   * WS.Register reactive updates + triggerBatchFunc
   * ═══════════════════════════════════════════ */

  /* ── Constants ── */
  var PREFIX = 'ScoreBoard.CurrentGame';

  /* ── Helpers ── */

  function asNum(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  function isTrue(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function msToMinSec(ms) {
    if (ms == null || ms === '') return '0:00';
    if (typeof _timeConversions !== 'undefined' && _timeConversions.msToMinSec) {
      return _timeConversions.msToMinSec(ms);
    }
    var totalSec = Math.max(0, Math.floor(asNum(ms) / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function teamColor(num, type) {
    var key = PREFIX + '.Team(' + num + ').Color(' + type + ')';
    return WS.state[key] || (type === 'overlay.bg' ? '#0f3460' : '#e0e0e0');
  }

  function teamName(num) {
    var altKey = PREFIX + '.Team(' + num + ').AlternateName(operator)';
    var nameKey = PREFIX + '.Team(' + num + ').Name';
    return WS.state[altKey] || WS.state[nameKey] || 'Team ' + num;
  }

  function getTeamVal(num, field) {
    return WS.state[PREFIX + '.Team(' + num + ').' + field];
  }

  /* ── Clock / Phase Derivation (from overlay pattern) ── */

  function getGamePhase() {
    var inJam = isTrue(WS.state[PREFIX + '.InJam']);
    var tc = isTrue(WS.state[PREFIX + '.Clock(Timeout).Running']);
    var lc = isTrue(WS.state[PREFIX + '.Clock(Lineup).Running']);
    var ic = isTrue(WS.state[PREFIX + '.Clock(Intermission).Running']);

    if (inJam) return { phase: 'jam', label: 'In Jam', cssClass: 'in-jam' };
    if (tc) return { phase: 'timeout', label: 'Timeout', cssClass: 'timeout' };
    if (lc) return { phase: 'lineup', label: 'Lineup', cssClass: 'lineup' };
    if (ic) {
      var num = asNum(WS.state[PREFIX + '.Clock(Intermission).Number']);
      return {
        phase: 'intermission',
        label: num === 0 ? 'Pre Game' : 'Intermission',
        cssClass: 'intermission'
      };
    }
    return { phase: 'pregame', label: 'Pre Game', cssClass: 'pregame' };
  }

  /* ── [A] Header Render ── */

  function renderHeader() {
    var h = document.getElementById('game-header');
    if (!h) return;

    var bg1 = teamColor(1, 'overlay.bg');
    var fg1 = teamColor(1, 'overlay.fg');
    var bg2 = teamColor(2, 'overlay.bg');
    var fg2 = teamColor(2, 'overlay.fg');

    var phase = getGamePhase();
    var periodTime = msToMinSec(WS.state[PREFIX + '.Clock(Period).Time']);
    var jamTime = msToMinSec(WS.state[PREFIX + '.Clock(Jam).Time']);

    function timeoutsHtml(num) {
      var total = asNum(getTeamVal(num, 'Timeouts'));
      var revs = asNum(getTeamVal(num, 'OfficialReviews'));
      var dots = '';
      for (var i = 1; i <= 3; i++) {
        dots += '<span class="dot' + (i > total ? ' used' : '') + '" style="border-color:' + (num === 1 ? fg1 : fg2) + '"></span>';
      }
      var revDots = '';
      for (var i = 1; i <= 2; i++) {
        revDots += '<span style="margin-left:4px;font-size:0.8em;opacity:' + (i > revs ? '0.3' : '1') + '">OR</span>';
      }
      return 'TO: ' + dots + ' ' + revDots;
    }

    h.innerHTML =
      '<div class="team-block" style="color:' + fg1 + '">' +
        '<div class="team-name" style="color:' + fg1 + '">' + escHtml(teamName(1)) + '</div>' +
        '<div class="team-score">' + asNum(getTeamVal(1, 'Score')) + '</div>' +
        '<div class="jam-score">+' + asNum(getTeamVal(1, 'JamScore')) + ' this jam</div>' +
        '<div class="team-timeouts">' + timeoutsHtml(1) + '</div>' +
      '</div>' +
      '<div class="center-clock">' +
        '<div class="phase-indicator ' + phase.cssClass + '">' + phase.label + '</div>' +
        '<div class="period-clock">' + periodTime + '</div>' +
        '<div class="jam-clock">' + jamTime + '</div>' +
        '<div class="clock-labels"><span>Period</span><span>Jam</span></div>' +
      '</div>' +
      '<div class="team-block" style="color:' + fg2 + '">' +
        '<div class="team-name" style="color:' + fg2 + '">' + escHtml(teamName(2)) + '</div>' +
        '<div class="team-score">' + asNum(getTeamVal(2, 'Score')) + '</div>' +
        '<div class="jam-score">+' + asNum(getTeamVal(2, 'JamScore')) + ' this jam</div>' +
        '<div class="team-timeouts">' + timeoutsHtml(2) + '</div>' +
      '</div>';
  }

  function escHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  /* ── [B] Per-Team Aggregated Stats ── */

  function computeTeamStats(teamNum) {
    var stats = { jams: 0, lead: 0, lost: 0, starPass: 0, calloff: 0, totalScore: 0 };
    var prefix = PREFIX + '.Period(';
    var re = new RegExp('^' + prefix + '(\\d+)\\)\\.Jam\\((\\d+)\\)\\.TeamJam\\(' + teamNum + '\\)\\.(\\w+)$');

    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(re);
      if (!m) return;
      var field = m[3];
      var val = WS.state[key];
      if (field === 'JamScore') {
        stats.totalScore += asNum(val);
        stats.jams++;
      } else if (field === 'Lead' && isTrue(val)) {
        stats.lead++;
      } else if (field === 'Lost' && isTrue(val)) {
        stats.lost++;
      } else if (field === 'StarPass' && isTrue(val)) {
        stats.starPass++;
      } else if (field === 'Calloff' && isTrue(val)) {
        stats.calloff++;
      }
    });

    stats.totalPenalties = asNum(getTeamVal(teamNum, 'TotalPenalties'));
    return stats;
  }

  function renderTeamStats() {
    var el = document.getElementById('team-stats');
    if (!el) return;

    var bg1 = teamColor(1, 'overlay.bg');
    var fg1 = teamColor(1, 'overlay.fg');
    var bg2 = teamColor(2, 'overlay.bg');
    var fg2 = teamColor(2, 'overlay.fg');

    var s1 = computeTeamStats(1);
    var s2 = computeTeamStats(2);

    el.innerHTML =
      '<div class="team-stats-container">' +
        buildTeamStatsCol(1, teamName(1), s1, bg1, fg1) +
        buildTeamStatsCol(2, teamName(2), s2, bg2, fg2) +
      '</div>';
  }

  function buildTeamStatsCol(num, name, stats, bg, fg) {
    return '<div class="team-stats-col">' +
      '<h3 style="background:' + bg + ';color:' + fg + '">' + escHtml(name) + '</h3>' +
      '<table class="agg-stats">' +
        row('Jams Played', stats.jams) +
        row('Total Points', stats.totalScore) +
        row('PPJ (Points Per Jam)', stats.jams > 0 ? (stats.totalScore / stats.jams).toFixed(1) : '0.0') +
        row('Lead Jammers', stats.lead) +
        row('Lost (Lead) Jams', stats.lost) +
        row('Star Passes', stats.starPass) +
        row('Calloffs', stats.calloff) +
        row('Total Penalties', stats.totalPenalties) +
      '</table></div>';
  }

  function row(label, value) {
    return '<tr><td>' + label + '</td><td>' + value + '</td></tr>';
  }

  /* ── [C] Penalty Leaders ── */

  function getPenaltyLeaders(teamNum, limit) {
    limit = limit || 5;
    var skaters = [];
    var base = PREFIX + '.Team(' + teamNum + ').Skater(';
    var seen = {};

    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(new RegExp('^' + base.replace('(', '\\(') + '(\\d+)\\)\\.(\\w+)$'));
      if (!m) return;
      var idx = m[1];
      var field = m[2];
      if (!seen[idx]) seen[idx] = {};
      seen[idx][field] = WS.state[key];
    });

    Object.keys(seen).forEach(function (idx) {
      var s = seen[idx];
      var pc = asNum(s.PenaltyCount);
      if (pc > 0) {
        // Collect penalty codes
        var codes = [];
        Object.keys(WS.state).forEach(function (key) {
          var cm = key.match(new RegExp('^' + base.replace('(', '\\(') + idx + '\\)\\.Penalty\\((\\d+)\\)\\.Code$'));
          if (cm) codes.push(WS.state[key]);
        });
        skaters.push({
          name: s.Name || 'Skater ' + idx,
          number: s.RosterNumber || '',
          penaltyCount: pc,
          codes: codes
        });
      }
    });

    skaters.sort(function (a, b) { return b.penaltyCount - a.penaltyCount; });
    return skaters.slice(0, limit);
  }

  function renderPenaltyLeaders() {
    var el = document.getElementById('penalty-leaders');
    if (!el) return;

    var bg1 = teamColor(1, 'overlay.bg');
    var fg1 = teamColor(1, 'overlay.fg');
    var bg2 = teamColor(2, 'overlay.bg');
    var fg2 = teamColor(2, 'overlay.fg');

    var le1 = getPenaltyLeaders(1);
    var le2 = getPenaltyLeaders(2);

    el.innerHTML =
      '<div class="penalty-leaders-container">' +
        buildPenaltyLeadersCol(1, teamName(1), le1, bg1, fg1) +
        buildPenaltyLeadersCol(2, teamName(2), le2, bg2, fg2) +
      '</div>';
  }

  function buildPenaltyLeadersCol(num, name, leaders, bg, fg) {
    if (leaders.length === 0) {
      return '<div class="penalty-leaders-col">' +
        '<h3 style="background:' + bg + ';color:' + fg + '">' + escHtml(name) + '</h3>' +
        '<div class="empty-message">No penalties yet</div></div>';
    }
    var rows = '';
    leaders.forEach(function (s, i) {
      var warnClass = '';
      var foulout = 7;
      if (s.penaltyCount >= foulout) warnClass = ' style="background:#e94560;color:#fff"';
      else if (s.penaltyCount >= foulout - 1) warnClass = ' style="background:#d4a017;color:#fff"';
      else warnClass = ' style="background:' + bg + ';color:' + fg + '"';
      rows += '<tr>' +
        '<td class="num">' + (i + 1) + '</td>' +
        '<td class="name-col">' + escHtml(s.name) + ' <span style="opacity:0.5;font-size:0.85em">#' + escHtml(s.number) + '</span></td>' +
        '<td class="penalty-count"' + warnClass + '>' + s.penaltyCount + '</td>' +
        '<td class="penalty-codes">' + s.codes.join(' ') + '</td>' +
      '</tr>';
    });
    return '<div class="penalty-leaders-col">' +
      '<h3 style="background:' + bg + ';color:' + fg + '">' + escHtml(name) + '</h3>' +
      '<table class="stats-table penalty-leaders">' +
        '<thead><tr><th>#</th><th>Skater</th><th class="center">P</th><th>Codes</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table></div>';
  }

  /* ── [D] Jammer Performance ── */

  function getJammerPerformance() {
    var jammers = {};
    var re = new RegExp('^' + PREFIX.replace(/\./g, '\\.') + '\\.Period\\((\\d+)\\)\\.Jam\\((\\d+)\\)\\.TeamJam\\((\\d+)\\)\\.Fielding\\(Jammer\\)\\.Skater$');

    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(re);
      if (!m) return;
      var jamNum = parseInt(m[2], 10);
      var teamNum = parseInt(m[3], 10);
      var skaterRef = WS.state[key];
      if (!skaterRef) return;

      // Get the points for this jam
      var scoreKey = PREFIX + '.Period(' + m[1] + ').Jam(' + jamNum + ').TeamJam(' + teamNum + ').JamScore';
      var points = asNum(WS.state[scoreKey]);

      // Look up skater name from the reference
      skaterRef = skaterRef.trim();
      var skaterName = skaterRef;
      var rosterNum = '';
      var teamPrefix = PREFIX + '.Team(' + teamNum + ').Skater(*)';

      // Try to resolve name from skater reference
      if (skaterRef.indexOf('Skater(') === 0) {
        var idx = skaterRef.match(/Skater\((\d+)\)/);
        if (idx) {
          var sn = WS.state[PREFIX + '.Team(' + teamNum + ').Skater(' + idx[1] + ').Name'];
          if (sn) skaterName = sn;
          var rn = WS.state[PREFIX + '.Team(' + teamNum + ').Skater(' + idx[1] + ').RosterNumber'];
          if (rn) rosterNum = rn;
        }
      }

      var key = teamNum + ':' + (rosterNum || skaterRef);
      if (!jammers[key]) {
        jammers[key] = {
          name: skaterName,
          number: rosterNum,
          team: teamNum,
          totalPoints: 0,
          jams: 0
        };
      }
      jammers[key].totalPoints += points;
      jammers[key].jams++;
    });

    var result = [];
    Object.keys(jammers).forEach(function (k) { result.push(jammers[k]); });
    result.sort(function (a, b) { return b.totalPoints - a.totalPoints; });
    return result;
  }

  function renderJammerPerformance() {
    var el = document.getElementById('jammer-performance');
    if (!el) return;

    var jammers = getJammerPerformance();
    if (jammers.length === 0) {
      el.innerHTML = '<div class="empty-message">No jam data yet</div>';
      return;
    }

    var rows = '';
    jammers.forEach(function (j, i) {
      var team = j.team;
      var bg = teamColor(team, 'overlay.bg');
      var fg = teamColor(team, 'overlay.fg');
      var teamLabel = teamName(team);
      rows += '<tr>' +
        '<td class="rank">' + (i + 1) + '</td>' +
        '<td class="skater-name">' + escHtml(j.name) + ' <span style="opacity:0.4;font-size:0.85em">#' + escHtml(j.number) + '</span></td>' +
        '<td class="skater-team" style="color:' + fg + ';background:' + bg + ';border-radius:4px;padding:0 6px;text-align:center;width:60px">' + teamLabel + '</td>' +
        '<td class="num">' + j.totalPoints + '</td>' +
        '<td class="num" style="opacity:0.6">' + j.jams + '</td>' +
        '<td class="num" style="opacity:0.7">' + (j.jams > 0 ? (j.totalPoints / j.jams).toFixed(1) : '0.0') + '</td>' +
      '</tr>';
    });

    el.innerHTML =
      '<table class="stats-table jammer-performance">' +
        '<thead><tr><th>#</th><th>Skater</th><th>Team</th><th class="num">Pts</th><th class="num">Jams</th><th class="num">PPJ</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  /* ── [E] Jam Log (Last 15 Jams) ── */

  function getJamLog() {
    var jams = {};

    // Collect all team-jam data points
    var reJamScore = new RegExp('^' + PREFIX.replace(/\./g, '\\.') + '\\.Period\\((\\d+)\\)\\.Jam\\((\\d+)\\)\\.TeamJam\\((\\d+)\\)\\.(JamScore|Lead|Lost|StarPass|TotalScore)$');

    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(reJamScore);
      if (!m) return;
      var period = parseInt(m[1], 10);
      var jam = parseInt(m[2], 10);
      var team = m[3];
      var field = m[4];
      var jamKey = period + '-' + jam;

      if (!jams[jamKey]) jams[jamKey] = { period: period, jam: jam, t1: {}, t2: {} };
      var target = team === '1' ? jams[jamKey].t1 : jams[jamKey].t2;
      target[field] = WS.state[key];
    });

    // Convert to array and sort by period then jam (descending)
    var result = [];
    Object.keys(jams).forEach(function (k) { result.push(jams[k]); });
    result.sort(function (a, b) {
      if (a.period !== b.period) return b.period - a.period;
      return b.jam - a.jam;
    });

    return result.slice(0, 15);
  }

  function renderJamLog() {
    var el = document.getElementById('jam-log');
    if (!el) return;

    var log = getJamLog();
    if (log.length === 0) {
      el.innerHTML = '<div class="empty-message">No jam data yet</div>';
      return;
    }

    var rows = '';
    var lastPeriod = -1;
    log.forEach(function (j) {
      if (j.period !== lastPeriod) {
        rows += '<tr class="jam-row period-break"><td colspan="6" style="font-size:0.8em;color:#888;text-transform:uppercase;letter-spacing:1px;">Period ' + j.period + '</td></tr>';
        lastPeriod = j.period;
      }

      var t1Lead = isTrue(j.t1.Lead) ? '★' : (isTrue(j.t1.Lost) ? '✗' : '');
      var t2Lead = isTrue(j.t2.Lead) ? '★' : (isTrue(j.t2.Lost) ? '✗' : '');
      var t1Score = asNum(j.t1.JamScore);
      var t2Score = asNum(j.t2.JamScore);
      var t1Total = asNum(j.t1.TotalScore);
      var t2Total = asNum(j.t2.TotalScore);

      rows += '<tr>' +
        '<td style="opacity:0.5;font-weight:600">#' + j.jam + '</td>' +
        '<td class="lead-star">' + t1Lead + '</td>' +
        '<td class="num">' + t1Score + '</td>' +
        '<td class="num" style="opacity:0.5;font-size:0.85em">(' + t1Total + ')</td>' +
        '<td class="num">' + t2Score + '</td>' +
        '<td class="num" style="opacity:0.5;font-size:0.85em">(' + t2Total + ')</td>' +
        '<td class="lead-star">' + t2Lead + '</td>' +
      '</tr>';
    });

    el.innerHTML =
      '<div class="jam-log-scroll">' +
        '<table class="stats-table jam-log">' +
          '<thead><tr>' +
            '<th>Jam</th><th></th><th class="num">T1 Sc</th><th class="num">T1 Tot</th><th class="num">T2 Sc</th><th class="num">T2 Tot</th><th></th>' +
          '</tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table></div>';
  }

  /* ── [F] Penalty Code Breakdown ── */

  function getPenaltyCodeBreakdown(teamNum) {
    var codes = {};
    var re = new RegExp('^' + PREFIX.replace(/\./g, '\\.') + '\\.Team\\(' + teamNum + '\\)\\.Skater\\((\\d+)\\)\\.Penalty\\((\\d+)\\)\\.Code$');

    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(re);
      if (!m) return;
      var code = WS.state[key];
      if (code && code !== '') {
        if (!codes[code]) codes[code] = 0;
        codes[code]++;
      }
    });

    var result = [];
    Object.keys(codes).forEach(function (c) {
      result.push({ code: c, count: codes[c] });
    });
    result.sort(function (a, b) { return b.count - a.count; });
    return result;
  }

  function renderPenaltyCodeBreakdown() {
    var el = document.getElementById('penalty-breakdown');
    if (!el) return;

    var bg1 = teamColor(1, 'overlay.bg');
    var fg1 = teamColor(1, 'overlay.fg');
    var bg2 = teamColor(2, 'overlay.bg');
    var fg2 = teamColor(2, 'overlay.fg');

    var pb1 = getPenaltyCodeBreakdown(1);
    var pb2 = getPenaltyCodeBreakdown(2);

    el.innerHTML =
      '<div class="penalty-breakdown-container">' +
        buildPenaltyBreakdownCol(teamName(1), pb1, bg1, fg1, bg1) +
        buildPenaltyBreakdownCol(teamName(2), pb2, bg2, fg2, bg2) +
      '</div>';
  }

  function buildPenaltyBreakdownCol(name, breakdown, bg, fg, barColor) {
    if (breakdown.length === 0) {
      return '<div class="pb-col">' +
        '<h3 style="background:' + bg + ';color:' + fg + '">' + escHtml(name) + '</h3>' +
        '<div class="empty-message">No penalties recorded</div></div>';
    }

    var maxCount = breakdown[0].count;
    var bars = '';
    breakdown.forEach(function (pb) {
      var pct = (pb.count / maxCount * 100).toFixed(0);
      bars += '<div class="penalty-bar-wrapper">' +
        '<span class="pb-code">' + escHtml(pb.code) + '</span>' +
        '<div class="pb-bar-bg"><div class="pb-bar" style="width:' + pct + '%;background:' + barColor + '"></div></div>' +
        '<span class="pb-count">' + pb.count + '</span>' +
      '</div>';
    });

    return '<div class="pb-col">' +
      '<h3 style="background:' + bg + ';color:' + fg + '">' + escHtml(name) + '</h3>' +
      '<div style="padding:4px 0">' + bars + '</div></div>';
  }

  /* ── Master Render (called from triggerBatchFunc) ── */

  var _renderQueued = false;

  function queueRender() {
    if (_renderQueued) return;
    _renderQueued = true;
    if (typeof triggerBatchFunc !== 'undefined') {
      triggerBatchFunc(function () {
        _renderQueued = false;
        fullRender();
      });
    } else {
      setTimeout(function () {
        _renderQueued = false;
        fullRender();
      }, 50);
    }
  }

  function fullRender() {
    renderHeader();
    renderTeamStats();
    renderPenaltyLeaders();
    renderJammerPerformance();
    renderJamLog();
    renderPenaltyCodeBreakdown();
  }

  /* ── WS.Register Setup ── */

  // [A] Header: team names, scores, jam scores, timeouts, reviews, clock, phase
  WS.Register([
    PREFIX + '.Team(*).AlternateName(operator)',
    PREFIX + '.Team(*).Name',
    PREFIX + '.Team(*).Score',
    PREFIX + '.Team(*).JamScore',
    PREFIX + '.Team(*).Timeouts',
    PREFIX + '.Team(*).OfficialReviews',
    PREFIX + '.Team(*).Color(*)',
    PREFIX + '.InJam',
    PREFIX + '.Clock(*).Running',
    PREFIX + '.Clock(*).Name',
    PREFIX + '.Clock(*).Time',
    PREFIX + '.Clock(Intermission).Number',
    PREFIX + '.TimeoutOwner',
    PREFIX + '.OfficialReview',
    PREFIX + '.OfficialScore',
    PREFIX + '.ClockDuringFinalScore',
    PREFIX + '.Rule(Period.Number)'
  ], queueRender);

  // [B] Per-team stats: all TeamJam data
  WS.Register([
    PREFIX + '.Period(*).Jam(*).TeamJam(*).JamScore',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Lead',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Lost',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).StarPass',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Calloff',
    PREFIX + '.Team(*).TotalPenalties'
  ], queueRender);

  // [C] Penalty leaders: skater penalty data
  WS.Register([
    PREFIX + '.Team(*).Skater(*).Name',
    PREFIX + '.Team(*).Skater(*).RosterNumber',
    PREFIX + '.Team(*).Skater(*).PenaltyCount',
    PREFIX + '.Team(*).Skater(*).Penalty(*).Code'
  ], queueRender);

  // [D] Jammer performance
  WS.Register([
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Fielding(*).Skater',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).JamScore'
  ], queueRender);

  // [E] Jam log
  WS.Register([
    PREFIX + '.Period(*).Jam(*).TeamJam(*).JamScore',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Lead',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Lost',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).TotalScore'
  ], queueRender);

  // [F] Penalty code breakdown
  WS.Register([
    PREFIX + '.Team(*).Skater(*).Penalty(*).Code'
  ], queueRender);

  /* ── Initial Render ── */

  WS.AfterLoad(function () {
    document.body.classList.remove('preload');
    fullRender();
  });

})();
