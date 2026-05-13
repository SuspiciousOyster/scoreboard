(function () {
  'use strict';

  /* ═══════════════════════════════════════════
   * Announcer Jammers View — Shared Render Logic
   *
   * Dropped into CRG ScoreBoard as a custom view:
   *   html/custom/view/announcer-jammers-render.js
   *
   * Also loaded by the standalone demo page with
   * a mock WS object matching the same API surface.
   * ═══════════════════════════════════════════ */

  var PREFIX = 'ScoreBoard.CurrentGame';

  /* ── Helpers ── */

  function asNum(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  function isTrue(v) {
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  function escHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function round1(v) {
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  function getPath(suffix) {
    return WS.state[PREFIX + '.' + suffix];
  }

  /* ── Tooltip Definitions ── */

  var TIPS = {
    '#': 'Roster number on the skater\'s uniform.',
    'Name': 'Skater name. SP badge = took the star in at least one jam.',
    'Lap Scores': 'Points scored on each scoring pass, grouped by jam. [4,3] = two passes in one jam worth 4 and 3. * = after star pass.',
    'J': 'Total jams played as jammer (includes star-pass pickups).',
    'L': 'Jams where this jammer was declared lead.',
    'L%': 'Lead percentage. (Lead ÷ Jams) × 100.',
    'Tot': 'Total points scored by this jammer.',
    'PPJ': 'Average points per jam. (Total ÷ Jams).',
    '%T': 'Share of total team score. (Jammer score ÷ Team score) × 100.',
  };

  /** Show a positioned tooltip popup near the clicked element. */
  function showTooltip(text, anchor) {
    var el = document.getElementById('tip-popup');
    if (!el) {
      el = document.createElement('div');
      el.id = 'tip-popup';
      el.className = 'tip-popup';
      document.body.appendChild(el);
      el.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    el.textContent = text;
    el.style.display = 'block';

    // Position below the anchor, centred
    var rect = anchor.getBoundingClientRect();
    var top = rect.bottom + 8;
    var left = rect.left + rect.width / 2;
    el.style.top = top + 'px';
    el.style.left = left + 'px';
  }

  function hideTooltip() {
    var el = document.getElementById('tip-popup');
    if (el) el.style.display = 'none';
  }

  // Dismiss tooltip on any click outside the popup
  document.addEventListener('click', function () { hideTooltip(); });

  // Show tooltip on tap/click of any .tip-trigger (delegated — works for dynamic content)
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('.tip-trigger');
    if (!trigger) return;
    e.stopPropagation();
    var col = trigger.getAttribute('data-col');
    var text = TIPS[col];
    if (text) showTooltip(text, trigger);
  });

  /* ═══════════════════════════════════════════
   *  Data Extraction
   * ═══════════════════════════════════════════ */

  /**
   * Collect all TeamJam data from WS.state into a structured array.
   */
  function collectTeamJams() {
    var jams = {};
    var re = new RegExp(
      '^' + PREFIX.replace(/\./g, '\\.') +
      '\\.Period\\((\\d+)\\)\\.Jam\\((\\d+)\\)\\.TeamJam\\((\\d+)\\)\\.(.+)$'
    );

    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(re);
      if (!m) return;
      var period = parseInt(m[1], 10);
      var jam = parseInt(m[2], 10);
      var team = m[3];
      var rest = m[4];
      var jamKey = period + '-' + jam;
      if (!jams[jamKey]) {
        // Skip Period(0).Jam(0) — pregame placeholder with no real data
        if (period === 0 && jam === 0) return;
        jams[jamKey] = {
          period: period,
          jam: jam,
          teams: {
            '1': {},
            '2': {}
          }
        };
      }
      var tj = jams[jamKey].teams[team];
      if (!tj) return;

      // Parse remaining path — could be nested (e.g. Fielding(Jammer).Skater or ScoringTrip(0).Score)
      // Fielding keys are FloorPosition names ("Jammer", "Pivot", "Blocker1", etc.)
      // ScoringTrip keys are numeric
      var parts = rest.match(/^(\w+)\(([^)]+)\)\.(\w+)$/);
      if (parts) {
        var childType = parts[1]; // Fielding or ScoringTrip
        var childIdx = parts[2];
        var childField = parts[3];
        if (!tj[childType]) tj[childType] = {};
        if (!tj[childType][childIdx]) tj[childType][childIdx] = {};
        tj[childType][childIdx][childField] = WS.state[key];
        return;
      }

      // Direct field (JamScore, Lead, Lost, StarPass, Calloff, TotalScore)
      var directFields = ['JamScore', 'Lead', 'Lost', 'StarPass', 'Calloff', 'TotalScore'];
      if (directFields.indexOf(rest) !== -1) {
        tj[rest] = WS.state[key];
      }
    });

    // Convert to sorted array
    var result = [];
    Object.keys(jams).forEach(function (k) { result.push(jams[k]); });
    result.sort(function (a, b) {
      if (a.period !== b.period) return a.period - b.period;
      return a.jam - b.jam;
    });
    return result;
  }

  /**
   * Build a skater lookup map from Team(N).Skater(*) data.
   * Returns { skaterRef: { name, number, teamNum } }
   */
  function buildSkaterMap() {
    var map = {};
    var re = new RegExp(
      '^' + PREFIX.replace(/\./g, '\\.') +
      '\\.Team\\((\\d+)\\)\\.Skater\\((\\d+)\\)\\.(Name|RosterNumber)$'
    );
    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(re);
      if (!m) return;
      var teamNum = m[1];
      var idx = m[2];
      var field = m[3];
      var ref = 'Skater(' + idx + ')';
      if (!map[ref]) map[ref] = { name: null, number: null, teamNum: teamNum };
      if (!map[idx]) map[idx] = { name: null, number: null, teamNum: teamNum };
      map[ref][field === 'Name' ? 'name' : 'number'] = WS.state[key];
      map[idx][field === 'Name' ? 'name' : 'number'] = WS.state[key];
    });
    return map;
  }

  /**
   * Resolve a skater reference (e.g. "Skater(3)") to { name, number }.
   */
  function resolveSkater(ref, skaterMap) {
    if (!ref) return { name: 'Unknown', number: '?' };
    ref = ref.trim();
    // Handle bare numeric IDs (real scoreboard format: Fielding(Jammer).Skater = "0")
    if (/^\d+$/.test(ref) && skaterMap[ref]) {
      var s = skaterMap[ref];
      return { name: s.name || ref, number: s.number || '?' };
    }
    // Handle Skater(N) format (demo/mock format and legacy data)
    if (ref.indexOf('Skater(') === 0) {
      var s = skaterMap[ref];
      if (s) return { name: s.name || ref, number: s.number || '?' };
    }
    return { name: ref, number: '?' };
  }

  /**
   * Compute all per-jammer stats and per-team game stats.
   */
  function computeAllStats() {
    var teamJams = collectTeamJams();
    var skaterMap = buildSkaterMap();

    // Per-jammer accumulator: key = "teamNum:skaterRef"
    var jammers = {};
    // Per-team counters
    var teamStats = {
      '1': { leadCount: 0, totalScore: 0, totalJams: 0 },
      '2': { leadCount: 0, totalScore: 0, totalJams: 0 }
    };
    var totalJamsCount = 0;

    function getJammerKey(teamNum, skaterRef) {
      return teamNum + ':' + (skaterRef || '').trim();
    }

    function ensureJammer(teamNum, skaterRef, skaterInfo) {
      var key = getJammerKey(teamNum, skaterRef);
      if (!jammers[key]) {
        jammers[key] = {
          teamNum: parseInt(teamNum, 10),
          skaterRef: (skaterRef || '').trim(),
          name: skaterInfo ? skaterInfo.name : 'Unknown',
          number: skaterInfo ? skaterInfo.number : '?',
          jamsTotal: 0,        // all jams as jammer (start + star-pass)
          jamsStarted: 0,      // jams started as first jammer
          jamsSP: 0,           // jams where they received star pass
          leadCount: 0,
          totalScore: 0,
          lapScoresPerJam: []    // array of arrays: each inner array is one jam's scoring passes
        };
      }
      return jammers[key];
    }

    // Iterate each jam
    teamJams.forEach(function (jam) {
      totalJamsCount++;
      [1, 2].forEach(function (teamNum) {
        var tj = jam.teams[teamNum];
        if (!tj) return;

        var tn = String(teamNum);
        var jamScore = asNum(tj.JamScore);
        var isLead = isTrue(tj.Lead);
        var starPass = isTrue(tj.StarPass);

        // Update team stats
        teamStats[tn].totalScore += jamScore;
        teamStats[tn].totalJams++;
        if (isLead) teamStats[tn].leadCount++;

        // Find jammer(s)
        // In real scoreboard, fielding is keyed by FloorPosition name:
        //   Fielding(Jammer).Skater = starting jammer
        //   Fielding(Pivot).Skater = pivot (becomes jammer after star pass)
        //   Fielding(Blocker1/2/3).Skater = blockers (never jammers)
        // In mock/demo WS, fielding may use numeric keys Fielding(0), Fielding(1)
        var fielding = tj.Fielding || {};
        var fieldingKeys = Object.keys(fielding).sort();

        var jammerRefs = [];

        // Approach: look for fielding entries where Position = "Jammer"
        // OR find the first/primary jammer by convention
        var foundJammer = false;
        fieldingKeys.forEach(function (key) {
          var f = fielding[key];
          if (!f.Skater || !f.Skater.trim()) return;
          var pos = (f.Position || '').trim();
          if (pos === 'Jammer' || pos.endsWith('_Jammer') || pos.includes('Jammer')) {
            jammerRefs.push(f.Skater.trim());
            if (!foundJammer) foundJammer = true;
          }
        });

        // Fallback: if no Position-based filtering worked, take all fielding
        // (handles numeric-indexed mock data and legacy format)
        if (!foundJammer) {
          fieldingKeys.forEach(function (key) {
            var f = fielding[key];
            if (f.Skater && f.Skater.trim()) {
              jammerRefs.push(f.Skater.trim());
            }
          });
        }

        // If no fielding data found, try the legacy pattern
        if (jammerRefs.length === 0) {
          // Check for Fielding(Jammer).Skater pattern in WS.state directly
          var legacyKey = PREFIX + '.Period(' + jam.period + ').Jam(' + jam.jam + ').TeamJam(' + teamNum + ').Fielding(Jammer).Skater';
          var legacyRef = WS.state[legacyKey];
          if (legacyRef && legacyRef.trim()) {
            jammerRefs.push(legacyRef.trim());
          }
        }

        if (jammerRefs.length === 0) return; // No jammer data yet

        // First ref is starting jammer
        var startRef = jammerRefs[0];
        var startInfo = resolveSkater(startRef, skaterMap);

        // Collect scoring trips
        var scoringTrips = tj.ScoringTrip || {};
        var tripKeys = Object.keys(scoringTrips).sort(function (a, b) {
          return parseInt(a, 10) - parseInt(b, 10);
        });

        // Build structured trip list — each trip tracks score + afterSP flag
        var allTripObjects = [];
        tripKeys.forEach(function (idx) {
          var trip = scoringTrips[idx];
          allTripObjects.push({
            score: asNum(trip.Score),
            afterSP: isTrue(trip.AfterSP)
          });
        });

        // If jamScore is nonzero but no scoring trips found, create a single trip
        if (jamScore > 0 && allTripObjects.length === 0) {
          allTripObjects.push({ score: jamScore, afterSP: false });
        }

        // Sum all points for the starting jammer
        var startPoints = 0;
        allTripObjects.forEach(function (t) { startPoints += t.score; });

        // Update starting jammer — ALL trips go here, post-SP ones marked with *
        var jam1 = ensureJammer(teamNum, startRef, startInfo);
        jam1.jamsTotal++;
        jam1.jamsStarted++;
        jam1.totalScore += startPoints;
        if (allTripObjects.length > 0) {
          jam1.lapScoresPerJam.push(allTripObjects);
        }
        if (isLead) jam1.leadCount++;

        // Handle star pass recipient — counted as having been jammer,
        // but ALL points from this jam attribute to the starting jammer.
        // The SP recipient gets jamsTotal++ and jamsSP++ for badge visibility
        // but no points or lap scores (those show under the starter's row).
        if (starPass && jammerRefs.length > 1) {
          var spRef = jammerRefs[1];
          var spInfo = resolveSkater(spRef, skaterMap);
          var jam2 = ensureJammer(teamNum, spRef, spInfo);
          jam2.jamsTotal++;
          jam2.jamsSP++;
          // Points attribute to the starting jammer, not the SP recipient
        }

        // If no fielding entries at all but jamScore > 0, attribute to unknown
        if (jamScore > 0 && jammerRefs.length === 0) {
          // Can't attribute — skip
        }
      });
    });

    // Compute derived stats
    var jammerList = [];
    Object.keys(jammers).forEach(function (k) { jammerList.push(jammers[k]); });

    jammerList.forEach(function (j) {
      j.ppj = j.jamsTotal > 0 ? (j.totalScore / j.jamsTotal) : 0;
      j.leadPct = j.jamsTotal > 0 ? (j.leadCount / j.jamsTotal * 100) : 0;
    });

    // Sort by team then by total score descending
    jammerList.sort(function (a, b) {
      if (a.teamNum !== b.teamNum) return a.teamNum - b.teamNum;
      return b.totalScore - a.totalScore;
    });

    return {
      jammers: jammerList,
      teamStats: teamStats,
      totalJams: totalJamsCount
    };
  }

  /* ═══════════════════════════════════════════
   *  Render Functions
   * ═══════════════════════════════════════════ */

  function renderGameStats(stats) {
    var el = document.getElementById('game-stats');
    if (!el) return;

    var ts1 = stats.teamStats['1'];
    var ts2 = stats.teamStats['2'];
    var totalJams = stats.totalJams || 1;

    var leadPct1 = totalJams > 0 ? (ts1.leadCount / totalJams * 100).toFixed(0) : '0';
    var leadPct2 = totalJams > 0 ? (ts2.leadCount / totalJams * 100).toFixed(0) : '0';

    var ppj1 = ts1.totalJams > 0 ? round1(ts1.totalScore / ts1.totalJams) : '0.0';
    var ppj2 = ts2.totalJams > 0 ? round1(ts2.totalScore / ts2.totalJams) : '0.0';

    var ratio = ts2.totalScore > 0
      ? round1(ts1.totalScore / ts2.totalScore)
      : (ts1.totalScore > 0 ? '∞' : '—');

    el.innerHTML =
      '<div class="gs-row">' +
        '<div class="gs-stat"><span class="gs-label">Lead %</span><span class="gs-value gs-t1">' + leadPct1 + '%</span><span class="gs-divider">|</span><span class="gs-value gs-t2">' + leadPct2 + '%</span></div>' +
        '<div class="gs-stat"><span class="gs-label">Lead</span><span class="gs-value gs-t1">' + ts1.leadCount + '</span><span class="gs-divider">|</span><span class="gs-value gs-t2">' + ts2.leadCount + '</span></div>' +
        '<div class="gs-stat"><span class="gs-label">Score</span><span class="gs-value gs-t1">' + ts1.totalScore + '</span><span class="gs-divider">:</span><span class="gs-value gs-t2">' + ts2.totalScore + '</span></div>' +
        '<div class="gs-stat"><span class="gs-label">PPJ</span><span class="gs-value gs-t1">' + ppj1 + '</span><span class="gs-divider">|</span><span class="gs-value gs-t2">' + ppj2 + '</span></div>' +
        '<div class="gs-stat"><span class="gs-label">Ratio</span><span class="gs-value gs-ratio">' + ratio + '</span></div>' +
      '</div>';
  }

  function renderJammerTable(teamNum, teamLabel, jammers, teamScore) {
    var el = document.getElementById('jammer-table-' + teamNum);
    if (!el) return;

    var filtered = jammers.filter(function (j) { return j.teamNum === teamNum; });
    if (filtered.length === 0) {
      el.innerHTML = '<div class="empty-message">No jammer data yet</div>';
      return;
    }

    var rows = '';
    filtered.forEach(function (j) {
      var spInd = '';
      if (j.jamsSP > 0) {
        spInd = ' <span class="sp-badge" title="Includes star-pass pickups">SP</span>';
      }

      // Build lap scores display — per-jam groups: [4,3] [1,5,2*] [2,2,1]
      // Post-star-pass trips get a * suffix
      var lapStr = '';
      if (j.lapScoresPerJam.length > 0) {
        var groups = j.lapScoresPerJam.map(function (jamTrips) {
          var parts = jamTrips.map(function (t) {
            return t.score + (t.afterSP ? '*' : '');
          });
          return '[' + parts.join(',') + ']';
        });
        lapStr = groups.join(' ');
      } else {
        lapStr = j.totalScore > 0 ? String(j.totalScore) : '—';
      }

      var teamPct = teamScore > 0
        ? ((j.totalScore / teamScore) * 100).toFixed(1) + '%'
        : '0.0%';

      rows += '<tr>' +
        '<td class="j-num">#' + escHtml(j.number) + '</td>' +
        '<td class="j-name">' + escHtml(j.name) + spInd + '</td>' +
        '<td class="j-laps">' + escHtml(lapStr) + '</td>' +
        '<td class="j-val">' + j.jamsTotal + '</td>' +
        '<td class="j-val">' + j.leadCount + '</td>' +
        '<td class="j-val">' + (j.leadPct).toFixed(0) + '%' + '</td>' +
        '<td class="j-val">' + j.totalScore + '</td>' +
        '<td class="j-val">' + round1(j.ppj) + '</td>' +
        '<td class="j-val">' + teamPct + '</td>' +
      '</tr>';
    });

    el.innerHTML =
      '<table class="jammer-table">' +
        '<thead><tr>' +
          '<th><span class="tip-trigger" data-col="#">#<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="Name">Name<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="Lap Scores">Lap Scores<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="J">J<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="L">L<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="L%">L%<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="Tot">Tot<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="PPJ">PPJ<span class="tip-icon">ⓘ</span></span></th>' +
          '<th><span class="tip-trigger" data-col="%T">%T<span class="tip-icon">ⓘ</span></span></th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  function renderTeamHeader(teamNum, computedScore) {
    var nameEl = document.getElementById('team-name-' + teamNum);
    if (nameEl) {
      var altKey = PREFIX + '.Team(' + teamNum + ').AlternateName(operator)';
      var nameKey = PREFIX + '.Team(' + teamNum + ').Name';
      var name = WS.state[altKey] || WS.state[nameKey] || 'Team ' + teamNum;
      nameEl.textContent = name;
    }
    // Update team score in section header — use computed value if available
    var scoreEl = document.getElementById('team-score-' + teamNum);
    if (scoreEl) {
      scoreEl.textContent = computedScore != null ? computedScore : asNum(getPath('Team(' + teamNum + ').Score'));
    }
    // Apply team color class to the header element
    var headerEl = document.getElementById('team-header-' + teamNum);
    if (headerEl) {
      headerEl.classList.add('t' + teamNum + '-header');
    }
  }

  /* ═══════════════════════════════════════════
   *  Master Render
   * ═══════════════════════════════════════════ */

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
    var stats = computeAllStats();

    // Update team names and scores using computed values
    [1, 2].forEach(function (num) { renderTeamHeader(num, stats.teamStats[String(num)].totalScore); });

    // Update game stats header
    renderGameStats(stats);

    // Use computed team scores (from summing JamScores) rather than Team(N).Score
    // which may be stale or auto-computed incorrectly by the scoreboard
    var team1Score = stats.teamStats['1'].totalScore;
    var team2Score = stats.teamStats['2'].totalScore;

    // Render per-team jammer tables
    renderJammerTable(1, null, stats.jammers, team1Score);
    renderJammerTable(2, null, stats.jammers, team2Score);
  }

  /* ═══════════════════════════════════════════
   *  WS.Register Setup
   * ═══════════════════════════════════════════ */

  // Team names + scores
  WS.Register([
    PREFIX + '.Team(*).AlternateName(operator)',
    PREFIX + '.Team(*).Name',
    PREFIX + '.Team(*).Score'
  ], queueRender);

  // All TeamJam data — jams, points, lead, star pass, fielding, scoring trips
  WS.Register([
    PREFIX + '.Period(*).Jam(*).TeamJam(*).JamScore',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Lead',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Lost',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).StarPass',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Calloff',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).TotalScore',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).Fielding(*).Skater',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).ScoringTrip(*).Score',
    PREFIX + '.Period(*).Jam(*).TeamJam(*).ScoringTrip(*).AfterSP'
  ], queueRender);

  // Skater lookups
  WS.Register([
    PREFIX + '.Team(*).Skater(*).Name',
    PREFIX + '.Team(*).Skater(*).RosterNumber'
  ], queueRender);

  /* ── Initial Render ── */

  WS.AfterLoad(function () {
    document.body.classList.remove('preload');
    fullRender();
  });

  // Expose for demo/cron integration
  if (typeof window !== 'undefined') {
    window._announcerJammersRender = fullRender;
  }

})();
