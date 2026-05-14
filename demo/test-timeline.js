/**
 * Test the timeline data population logic from the render code
 * This is a simplified version of computeAllStats -> collectTeamJams
 */
"use strict";

var PREFIX = 'ScoreBoard.CurrentGame';

// Build state with mock jam data matching what mock-ws.js applyJam produces
function buildState() {
  var s = {};
  var jamData = [
    // 12 jams matching SCRIPTED_JAMS in mock-ws.js
    { t1s: 7,  t2s: 1,  t1l: true,  t2l: false },
    { t1s: 1,  t2s: 7,  t1l: false, t2l: true  },
    { t1s: 4,  t2s: 2,  t1l: true,  t2l: false },
    { t1s: 5,  t2s: 0,  t1l: true,  t2l: false },
    { t1s: 0,  t2s: 6,  t1l: false, t2l: true  },
    { t1s: 5,  t2s: 1,  t1l: true,  t2l: false },
    { t1s: 1,  t2s: 3,  t1l: false, t2l: true  },
    // jam > 7 triggers period 2 in mock-ws.js
    { t1s: 5,  t2s: 1,  t1l: true,  t2l: false },
    { t1s: 6,  t2s: 0,  t1l: true,  t2l: false },
    { t1s: 2,  t2s: 5,  t1l: false, t2l: true  },
    { t1s: 6,  t2s: 3,  t1l: true,  t2l: false },
    { t1s: 5,  t2s: 7,  t1l: false, t2l: true  },
  ];
  
  jamData.forEach(function(jd, idx) {
    var jamIdx = idx + 1; // 1-indexed
    var period = 1;
    var jam = jamIdx;
    
    // Simulate the period logic from mock-ws.js
    if (jam > 7) {
      period = 2;
      jam = jam - 7;
    }
    
    [1, 2].forEach(function(teamNum) {
      var tn = String(teamNum);
      var jamScore = teamNum === 1 ? jd.t1s : jd.t2s;
      var lead = teamNum === 1 ? jd.t1l : jd.t2l;
      
      s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(' + tn + ').JamScore'] = String(jamScore);
      s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(' + tn + ').Lead'] = String(lead);
      s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(' + tn + ').Fielding(Jammer).Skater'] = 'Skater(0)';
      s[PREFIX + '.Period(' + period + ').Jam(' + jam + ').TeamJam(' + tn + ').Fielding(Jammer).Position'] = 'Jammer';
    });
  });
  
  return s;
}

// Test: does the regex match ALL keys?
var state = buildState();

var re = new RegExp(
  '^' + PREFIX.replace(/\./g, '\\.') +
  '\\.Period\\((\\d+)\\)\\.Jam\\((\\d+)\\)\\.TeamJam\\((\\d+)\\)\\.(.+)$'
);

var matches = [];
var mismatches = [];

Object.keys(state).forEach(function(key) {
  var m = key.match(re);
  if (m) {
    matches.push({ key: key, period: m[1], jam: m[2], team: m[3], rest: m[4] });
  } else {
    mismatches.push(key);
  }
});

console.log('Total keys:', Object.keys(state).length);
console.log('Matched:', matches.length);
console.log('Mismatched:', mismatches.length);
if (mismatches.length > 0) {
  console.log('Sample mismatches:', mismatches.slice(0, 5));
}

// Now simulate collectTeamJams
var jams = {};
matches.forEach(function(m) {
  var jamKey = m.period + '-' + m.jam;
  if (!jams[jamKey]) {
    if (parseInt(m.period) === 0 && parseInt(m.jam) === 0) return;
    jams[jamKey] = { period: parseInt(m.period), jam: parseInt(m.jam), teams: { '1': {}, '2': {} } };
  }
  var tj = jams[jamKey].teams[m.team];
  if (!tj) return;
  
  // Check direct fields
  var directFields = ['JamScore', 'Lead', 'Lost', 'StarPass', 'Calloff', 'TotalScore', 'NoInitial'];
  if (directFields.indexOf(m.rest) !== -1) {
    tj[m.rest] = state[m.key];
  }
});

// Build jamScoreHistory
var sortedKeys = Object.keys(jams).sort(function(a, b) {
  return jams[a].period - jams[b].period || jams[a].jam - jams[b].jam;
});

console.log('\nSorted jams:');
sortedKeys.forEach(function(k) {
  var j = jams[k];
  var t1s = parseInt(j.teams['1'].JamScore || '0');
  var t2s = parseInt(j.teams['2'].JamScore || '0');
  console.log('  P' + j.period + 'J' + j.jam + ' → T1:' + t1s + ' T2:' + t2s);
});

// Now simulate computeAllStats jam iteration
var jamScoreHistory = [];
sortedKeys.forEach(function(k) {
  var jam = jams[k];
  var t1Score = 0, t2Score = 0;
  
  [1, 2].forEach(function(teamNum) {
    var tj = jam.teams[teamNum];
    if (!tj) return;
    var jamScore = parseInt(tj.JamScore || '0', 10);
    if (teamNum === 1) t1Score = jamScore;
    else t2Score = jamScore;
  });
  
  jamScoreHistory.push({ jamNum: jam.jam, t1: t1Score, t2: t2Score });
});

console.log('\njamScoreHistory:');
console.log(JSON.stringify(jamScoreHistory));

// Simulate renderScoreTimeline
function simulateRender(history) {
  if (!history || history.length === 0) {
    console.log('Empty history — would NOT render');
    return;
  }
  console.log('\nTimeline would render ' + history.length + ' bars');
  var maxVal = 1;
  history.forEach(function(h) {
    if (h.t1 > maxVal) maxVal = h.t1;
    if (h.t2 > maxVal) maxVal = h.t2;
  });
  console.log('Max value:', maxVal);
}

simulateRender(jamScoreHistory);
