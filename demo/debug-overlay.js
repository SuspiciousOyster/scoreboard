/**
 * Debug overlay for Announcer Jammers demo
 * Shows internal state so we can see what's happening
 */
(function () {
  'use strict';

  // Wait for page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Create debug panel
    var panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText =
      'position:fixed;bottom:0;left:0;right:0;background:#1c2333;border-top:2px solid #58a6ff;' +
      'color:#e6edf3;font-family:monospace;font-size:11px;padding:8px 12px;z-index:99999;' +
      'max-height:200px;overflow:auto;display:none;';

    panel.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
      '<button id="debug-toggle" style="background:#21262d;color:#c9d1d9;border:1px solid #30363d;border-radius:4px;padding:2px 8px;font-size:11px;cursor:pointer;">🐛 Debug</button>' +
      '<span id="debug-status" style="color:#8b949e;">Not running</span>' +
      '</div>' +
      '<div id="debug-content" style="display:none;"></div>';

    document.body.appendChild(panel);

    var btn = document.getElementById('debug-toggle');
    var statusEl = document.getElementById('debug-status');
    var contentEl = document.getElementById('debug-content');

    btn.addEventListener('click', function () {
      var shown = contentEl.style.display !== 'none';
      contentEl.style.display = shown ? 'none' : 'block';
      btn.textContent = shown ? '🐛 Debug' : '🐛 Hide';
      if (!shown) refreshDebug();
    });

    // Poll for state changes and update debug
    function refreshDebug() {
      if (contentEl.style.display === 'none') return;

      try {
        var jams = {};
        var re = new RegExp(
          '^ScoreBoard\\.CurrentGame\\.Period\\((\\d+)\\)\\.Jam\\((\\d+)\\)\\.TeamJam\\((\\d+)\\)\\.(JamScore|Lead)$'
        );
        Object.keys(WS.state).forEach(function (key) {
          var m = key.match(re);
          if (!m) return;
          var jk = m[1] + '-' + m[2];
          if (!jams[jk]) jams[jk] = {};
          jams[jk][m[3] + '.' + m[4]] = WS.state[key];
        });

        var keys = Object.keys(jams).sort();
        var html = '<div style="color:#58a6ff;margin-bottom:4px;">WS.state keys: ' + Object.keys(WS.state).length + ' | Unique jams: ' + keys.length + '</div>';

        if (keys.length === 0) {
          html += '<div style="color:#8b949e;">No jam data in state yet</div>';
        } else {
          html += '<table style="border-collapse:collapse;width:100%;">';
          html += '<tr style="color:#8b949e;">' +
            '<th style="padding:2px 6px;text-align:left;border-bottom:1px solid #30363d;">Jam</th>' +
            '<th style="padding:2px 6px;text-align:right;border-bottom:1px solid #30363d;">T1 Score</th>' +
            '<th style="padding:2px 6px;text-align:center;border-bottom:1px solid #30363d;">T1 Lead</th>' +
            '<th style="padding:2px 6px;text-align:right;border-bottom:1px solid #30363d;">T2 Score</th>' +
            '<th style="padding:2px 6px;text-align:center;border-bottom:1px solid #30363d;">T2 Lead</th>' +
            '</tr>';
          keys.forEach(function (k) {
            var j = jams[k];
            var p = k.split('-');
            html += '<tr>' +
              '<td style="padding:2px 6px;border-bottom:1px solid #21262d;">P' + p[0] + 'J' + p[1] + '</td>' +
              '<td style="padding:2px 6px;text-align:right;border-bottom:1px solid #21262d;color:#58a6ff;">' + (j['1.JamScore'] || '0') + '</td>' +
              '<td style="padding:2px 6px;text-align:center;border-bottom:1px solid #21262d;">' + (j['1.Lead'] === 'true' ? '✅' : '—') + '</td>' +
              '<td style="padding:2px 6px;text-align:right;border-bottom:1px solid #21262d;color:#f85149;">' + (j['2.JamScore'] || '0') + '</td>' +
              '<td style="padding:2px 6px;text-align:center;border-bottom:1px solid #21262d;">' + (j['2.Lead'] === 'true' ? '✅' : '—') + '</td>' +
              '</tr>';
          });
          html += '</table>';
        }

        // Check if score-timeline container exists
        var tlEl = document.getElementById('score-timeline');
        if (tlEl) {
          html += '<div style="margin-top:4px;">#score-timeline: ' + (tlEl.children.length > 0 ? tlEl.innerHTML.substring(0, 80) + '…' : 'EMPTY') + '</div>';
        } else {
          html += '<div style="color:#f85149;margin-top:4px;">#score-timeline: NOT FOUND</div>';
        }

        contentEl.innerHTML = html;
        statusEl.textContent = '🟢 ' + keys.length + ' jams';
      } catch (e) {
        contentEl.innerHTML = '<div style="color:#f85149;">Error: ' + e.message + '</div>';
        statusEl.textContent = '🔴 Error';
      }

      setTimeout(refreshDebug, 2000);
    }

    // Start polling when panel is shown
    setTimeout(refreshDebug, 1000);
  }
})();
