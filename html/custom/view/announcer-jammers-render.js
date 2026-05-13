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

  /* ── Penalty code to emoji mapping ── */
  var PENALTY_EMOJI = {
    'IllegalProcedure': '🚫',
    'IllegalZone': '✋',
    'BackBlock': '🔙',
    'LowBlock': '⬇️',
    'HighBlock': '⬆️',
    'IllegalContact': '❌',
    'Misconduct': '❗',
    'Unnecessary': '⚠️',
    'Cutting': '✂️',
    'DirectionOfPlay': '🔁',
    'Interference': '🤝',
    'OutOfPlay': '👋',
    'SkatingOutOfPlay': '🚶',
    'FailureToReform': '🔄',
    'Insubordination': '📢',
    'Injury': '🏥',
  };

  /** Convert a penalty code to an emoji, fallback to short code text. */
  function penEmoji(code) {
    if (!code) return '❓';
    if (PENALTY_EMOJI[code]) return PENALTY_EMOJI[code];
    var uc = code.charAt(0).toUpperCase() + code.slice(1);
    if (PENALTY_EMOJI[uc]) return PENALTY_EMOJI[uc];
    return code.slice(0, 3);
  }

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

      // Direct field (JamScore, Lead, Lost, StarPass, Calloff, TotalScore, NoInitial)
      var directFields = ['JamScore', 'Lead', 'Lost', 'StarPass', 'Calloff', 'TotalScore', 'NoInitial'];
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
      '1': { leadCount: 0, totalScore: 0, totalJams: 0, calloffCount: 0, starPassCount: 0, lostCount: 0, noInitialCount: 0, allowedWhileLead: 0, scoredVsLead: 0 },
      '2': { leadCount: 0, totalScore: 0, totalJams: 0, calloffCount: 0, starPassCount: 0, lostCount: 0, noInitialCount: 0, allowedWhileLead: 0, scoredVsLead: 0 }
    };
    var totalJamsCount = 0;
    var jamScoreHistory = []; // [{jamNum, t1score, t2score}] for score timeline

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
      var t1Score = 0, t2Score = 0;
      [1, 2].forEach(function (teamNum) {
        var tj = jam.teams[teamNum];
        if (!tj) return;

        var tn = String(teamNum);
        var jamScore = asNum(tj.JamScore);
        var isLead = isTrue(tj.Lead);
        var starPass = isTrue(tj.StarPass);
        var isCalloff = isTrue(tj.Calloff);
        var isLost = isTrue(tj.Lost);
        var isNoInitial = isTrue(tj.NoInitial);

        // Track per-jam scores for timeline
        if (teamNum === 1) t1Score = jamScore;
        else t2Score = jamScore;

        // Update team stats
        teamStats[tn].totalScore += jamScore;
        teamStats[tn].totalJams++;
        if (isLead) teamStats[tn].leadCount++;
        if (isCalloff) teamStats[tn].calloffCount++;
        if (starPass) teamStats[tn].starPassCount++;
        if (isLost) teamStats[tn].lostCount++;
        if (isNoInitial) teamStats[tn].noInitialCount++;

        // "Points allowed while lead" — team had lead and didn't lose it,
        // but opponent still scored. Indicates poor lead-jammer awareness.
        // We need the opponent's lead and lost status, so this is computed
        // after both team's data is collected (below).

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
      }); // end [1,2].forEach

      // Push jam scores for timeline
      jamScoreHistory.push({ jamNum: jam.jam, t1: t1Score, t2: t2Score });

      // Cross-team analysis: "points while opponent had lead (and hadn't lost it)"
      // T1 had lead and didn't lose it → T2 scoring is "allowed while lead"
      var tj1 = jam.teams['1'];
      var tj2 = jam.teams['2'];
      var lead1 = tj1 && isTrue(tj1.Lead);
      var lead2 = tj2 && isTrue(tj2.Lead);
      var lost1 = tj1 && isTrue(tj1.Lost);
      var lost2 = tj2 && isTrue(tj2.Lost);
      if (lead1 && !lost1 && t2Score > 0) {
        teamStats['1'].allowedWhileLead += t2Score;
        teamStats['2'].scoredVsLead += t2Score;
      }
      if (lead2 && !lost2 && t1Score > 0) {
        teamStats['2'].allowedWhileLead += t1Score;
        teamStats['1'].scoredVsLead += t1Score;
      }
    }); // end teamJams.forEach

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
      totalJams: totalJamsCount,
      jamScoreHistory: jamScoreHistory
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

    function stat(label, val1, val2, isScore) {
      var b = isScore
        ? '<span class="gs-value gs-t1">' + val1 + '</span><span class="gs-divider">:</span><span class="gs-value gs-t2">' + val2 + '</span>'
        : '<span class="gs-value gs-t1">' + val1 + '</span><span class="gs-divider">|</span><span class="gs-value gs-t2">' + val2 + '</span>';
      return '<div class="gs-stat"><span class="gs-label">' + label + '</span>' + b + '</div>';
    }

    el.innerHTML =
      '<div class="gs-row">' +
        stat('Lead %', leadPct1 + '%', leadPct2 + '%') +
        stat('Score', ts1.totalScore, ts2.totalScore, true) +
        stat('Call-off', ts1.calloffCount, ts2.calloffCount) +
        stat('Star Pass', ts1.starPassCount, ts2.starPassCount) +
      '</div>' +
      '<div class="gs-row">' +
        stat('PPJ', ppj1, ppj2) +
        stat('Lost Lead', ts1.lostCount, ts2.lostCount) +
        stat('No Init', ts1.noInitialCount, ts2.noInitialCount) +
        stat('Rat', ratio) +
        stat('<span class="gs-tip" title="Points scored while opponent had lead and had not lost it. Shows poor lead-jammer awareness.">Opp Sc</span>', ts2.scoredVsLead, ts1.scoredVsLead) +
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

  /* ── Score Timeline ── */

  function renderScoreTimeline(history) {
    var el = document.getElementById('score-timeline');
    if (!el || !history || history.length === 0) return;

    var maxVal = 1;
    history.forEach(function (h) {
      if (h.t1 > maxVal) maxVal = h.t1;
      if (h.t2 > maxVal) maxVal = h.t2;
    });

    var html = '<div class="tl-container">';
    history.forEach(function (h) {
      var pct1 = (h.t1 / maxVal * 100).toFixed(1);
      var pct2 = (h.t2 / maxVal * 100).toFixed(1);
      var h1 = h.t1 > 0 ? pct1 : 2;
      var h2 = h.t2 > 0 ? pct2 : 2;
      html += '<div class="tl-col">' +
        '<div class="tl-bar tl-t1" style="height:' + h1 + '%" title="Jam ' + h.jamNum + ': T1 scored ' + h.t1 + '">' +
          (h.t1 > 0 ? '<span class="tl-val">' + h.t1 + '</span>' : '') +
        '</div>' +
        '<div class="tl-bar tl-t2" style="height:' + h2 + '%" title="Jam ' + h.jamNum + ': T2 scored ' + h.t2 + '">' +
          (h.t2 > 0 ? '<span class="tl-val">' + h.t2 + '</span>' : '') +
        '</div>' +
        '<div class="tl-label">#' + h.jamNum + '</div>' +
      '</div>';
    });
    html += '</div>';

    el.innerHTML = '<div class="tl-header">Score per Jam</div>' + html;
  }

  /* ── Penalty Snapshot ── */

  function buildPenaltyData() {
    var data = { '1': { total: 0, skaters: [] }, '2': { total: 0, skaters: [] } };
    var seen = {}; // "team:idx" → { count, codes }

    // Scan all Penalty(N).Code entries to find skaters with penalties
    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(new RegExp(
        '^' + PREFIX.replace(/\./g, '\\.') +
        '\\.Team\\((\\d+)\\)\\.Skater\\((\\d+)\\)\\.Penalty\\((\\d+)\\)\\.Code$'
      ));
      if (!m) return;
      var team = m[1];
      var idx = m[2];
      var code = WS.state[key];
      if (!code) return;
      var keyId = team + ':' + idx;
      if (!seen[keyId]) {
        seen[keyId] = { count: 0, codes: [] };
      }
      seen[keyId].count++;
      seen[keyId].codes.push(code);
    });

    // Also check PenaltyCount values (may be set independently)
    Object.keys(WS.state).forEach(function (key) {
      var m = key.match(new RegExp(
        '^' + PREFIX.replace(/\./g, '\\.') +
        '\\.Team\\((\\d+)\\)\\.Skater\\((\\d+)\\)\\.PenaltyCount$'
      ));
      if (!m) return;
      var team = m[1];
      var idx = m[2];
      var cnt = asNum(WS.state[key]);
      var keyId = team + ':' + idx;
      if (cnt > 0 && !seen[keyId]) {
        seen[keyId] = { count: 0, codes: [] };
      }
      // Use the larger of the two counts
      if (cnt > seen[keyId].count) {
        seen[keyId].count = cnt;
      }
    });

    // Build output for each team
    [1, 2].forEach(function (t) {
      var tn = String(t);
      data[tn].total = 0;
      Object.keys(seen).forEach(function (keyId) {
        if (!keyId.startsWith(tn + ':')) return;
        var idx = keyId.split(':')[1];
        var info = seen[keyId];
        var nk = PREFIX + '.Team(' + tn + ').Skater(' + idx + ').Name';
        var rk = PREFIX + '.Team(' + tn + ').Skater(' + idx + ').RosterNumber';
        data[tn].skaters.push({
          idx: idx,
          name: WS.state[nk] || 'Skater ' + idx,
          number: WS.state[rk] || '?',
          count: info.count,
          codes: info.codes
        });
        data[tn].total += info.count;
      });

      data[tn].skaters.sort(function (a, b) { return b.count - a.count; });
      data[tn].skaters = data[tn].skaters.slice(0, 5);
    });

    return data;
  }

  function renderPenalties() {
    var data = buildPenaltyData();

    [1, 2].forEach(function (teamNum) {
      var el = document.getElementById('penalties-' + teamNum);
      if (!el) return;

      var td = data[teamNum];
      if (td.skaters.length === 0) {
        el.innerHTML = '<div class="pen-empty">No penalties</div>';
        return;
      }

      var rows = '';
      td.skaters.forEach(function (s) {
        var codeEmojis = s.codes.map(function (c) {
          return '<span class="pen-emoji" title="' + escHtml(c) + '">' + penEmoji(c) + '</span>';
        }).join(' ');
        rows += '<div class="pen-row">' +
          '<span class="pen-num">#' + escHtml(s.number) + '</span>' +
          '<span class="pen-name">' + escHtml(s.name) + '</span>' +
          '<span class="pen-count">' + s.count + '</span>' +
          (codeEmojis ? '<span class="pen-codes">' + codeEmojis + '</span>' : '') +
        '</div>';
      });

      el.innerHTML =
        '<div class="pen-header">Penalties: ' + td.total + '</div>' +
        '<div class="pen-list">' + rows + '</div>';
    });
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

    // Phase 2: Score timeline + penalty snapshots
    renderScoreTimeline(stats.jamScoreHistory);
    renderPenalties();
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
    PREFIX + '.Period(*).Jam(*).TeamJam(*).NoInitial',
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

  // Penalty data
  WS.Register([
    PREFIX + '.Team(*).TotalPenalties',
    PREFIX + '.Team(*).Skater(*).PenaltyCount',
    PREFIX + '.Team(*).Skater(*).Penalty(*).Code'
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
