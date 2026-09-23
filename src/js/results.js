/* ==========================================================================
   ChainVote — results view (summary tiles, Chart.js charts, accessible table)
   ========================================================================== */
(function (w) {
  'use strict';
  var PALETTE = ['#1d5fd0', '#0b2a5b', '#4c8df6', '#2e7d9a', '#7fb0ff', '#6b7fa8', '#154ba6', '#a9c4f5'];
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Results(root, opts) {
    opts = opts || {};
    root.classList.add('results-root');
    root.innerHTML =
      '<div class="grid grid-3" data-r="tiles"></div>' +
      '<div class="charts"><div class="card"><div class="card-head"><div><h2>Votes by candidate</h2><p class="card-sub">Read directly from the smart contract.</p></div></div>' +
      '<div class="chart-box"><canvas data-r="bar" role="img" aria-label="Bar chart of votes per candidate. The table below has the same data."></canvas></div></div>' +
      '<div class="card"><div class="card-head"><div><h2>Vote share</h2><p class="card-sub" data-r="total"></p></div></div>' +
      '<div class="chart-box"><canvas data-r="pie" role="img" aria-label="Doughnut chart of vote share per candidate."></canvas></div></div></div>' +
      '<div class="table-wrap"><table class="tbl"><caption class="sr-only">Vote counts per candidate</caption><thead><tr><th scope="col">Candidate</th><th scope="col">Party</th><th scope="col" style="width:32%">Share</th><th scope="col" class="r">Votes</th></tr></thead><tbody data-r="rows"></tbody></table></div>';
    var q = function (k) { return root.querySelector('[data-r="' + k + '"]'); };
    var bar, pie, lastSig = '', barBox = q('bar').parentNode, pieBox = q('pie').parentNode;


    function fallback(list, total, pct) {
      var box = barBox, box2 = pieBox, max = list.length ? Math.max.apply(null, list.map(function (c) { return c.votes; })) || 1 : 1;
      box.innerHTML = '<div class="fb-bars" role="img" aria-label="Bar chart of votes per candidate. The table below has the same data.">' + list.map(function (c, i) {
        return '<div class="r"><span title="' + UI.esc(c.name) + '">' + UI.esc(c.name) + '</span><div class="track"><i style="width:' + (c.votes / max * 100).toFixed(1) + '%;background:' + PALETTE[i % PALETTE.length] + '"></i></div><span class="num">' + c.votes + '</span></div>';
      }).join('') + '</div>';
      var acc = 0, stops = list.map(function (c, i) { var a = acc, b = acc + pct(c.votes); acc = b; return PALETTE[i % PALETTE.length] + ' ' + a + '% ' + b + '%'; });
      box2.innerHTML = '<div class="fb-donut" role="img" aria-label="Doughnut chart of vote share per candidate."><div class="ring" style="background:conic-gradient(' + (total ? stops.join(',') : '#e8edf7 0 100%') + ')"></div><div class="fb-legend">' +
        list.map(function (c, i) { return '<span><i style="background:' + PALETTE[i % PALETTE.length] + '"></i>' + UI.esc(c.name) + '</span>'; }).join('') + '</div></div>';
    }

    this.update = function (cands) {
      var list = cands.filter(function (c) { return opts.showInactive ? (c.active || c.votes > 0) : c.active; })
        .sort(function (a, b) { return b.votes - a.votes || a.name.localeCompare(b.name); });
      var total = list.reduce(function (s, c) { return s + c.votes; }, 0);
      var top = list.length ? list[0].votes : 0;
      var leaders = total ? list.filter(function (c) { return c.votes === top; }) : [];
      var leadText = !total ? 'No votes yet' : leaders.length > 1 ? 'Tie: ' + leaders.map(function (l) { return l.name; }).join(', ') : leaders[0].name;
      var pct = function (v) { return total ? (v / total * 100) : 0; };

      q('tiles').innerHTML =
        '<div class="card stat"><span class="k">' + UI.icon('vote', 18) + 'Total votes</span><span class="v num">' + UI.num(total) + '</span><span class="s">recorded on-chain</span></div>' +
        '<div class="card stat"><span class="k">' + UI.icon('users', 18) + (leaders.length > 1 ? 'Currently tied' : 'Currently leading') + '</span><span class="v" style="font-size:1.45rem;line-height:1.3">' + UI.esc(leadText) + '</span>' +
        '<span class="s">' + (total && leaders.length === 1 ? UI.esc(leaders[0].party) + ' · ' + pct(top).toFixed(1) + '% of votes' : '&nbsp;') + '</span></div>' +
        '<div class="card stat"><span class="k">' + UI.icon('idcard', 18) + 'Candidates</span><span class="v num">' + list.filter(function (c) { return c.active; }).length + '</span><span class="s">on the ballot</span></div>';
      q('total').textContent = total ? UI.num(total) + ' votes counted' : 'Waiting for the first vote';

      if (!list.length) {
        q('rows').innerHTML = '<tr><td colspan="4"><div class="empty" style="border:0">' + UI.icon('users', 28) + '<strong>No candidates yet</strong><span>Results appear once candidates are added.</span></div></td></tr>';
      } else {
        q('rows').innerHTML = list.map(function (c, i) {
          var isLead = total && c.votes === top;
          return '<tr><td><div class="cell-person"><span class="avatar" aria-hidden="true">' + UI.esc(UI.initials(c.name)) + '</span><span><b>' + UI.esc(c.name) + '</b>' +
            (isLead ? ' <span class="badge badge-ok plain" style="height:22px;margin-left:6px">' + (leaders.length > 1 ? 'Tied' : 'Leading') + '</span>' : '') +
            (!c.active ? ' <span class="badge badge-mute plain" style="height:22px;margin-left:6px">Removed</span>' : '') + '</span></div></td>' +
            '<td class="muted">' + UI.esc(c.party) + '</td>' +
            '<td><div style="display:flex;align-items:center;gap:10px"><div class="bar' + (isLead ? ' lead' : '') + '" style="flex:1" role="presentation"><i style="width:' + pct(c.votes).toFixed(1) + '%"></i></div><span class="num muted" style="width:46px;text-align:right">' + pct(c.votes).toFixed(1) + '%</span></div></td>' +
            '<td class="r num"><b>' + UI.num(c.votes) + '</b></td></tr>';
        }).join('');
      }

      if (typeof Chart === 'undefined') { fallback(list, total, pct); return; }   // offline: built-in charts
      var labels = list.map(function (c) { return c.name; }), data = list.map(function (c) { return c.votes; });
      var colors = list.map(function (_, i) { return PALETTE[i % PALETTE.length]; });
      Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
      Chart.defaults.color = '#53617a';
      var anim = reduce ? false : { duration: 700 };
      var sig = JSON.stringify(labels);
      if (bar && pie && sig === lastSig) {            // same candidates: update in place, no re-animation
        [bar, pie].forEach(function (c) { c.data.datasets[0].data = data; c.update('none'); });
        return;
      }
      lastSig = sig;
      if (bar) bar.destroy(); if (pie) pie.destroy();
      bar = new Chart(q('bar'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderRadius: 8, maxBarThickness: 44 }] },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: anim,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + c.parsed.x + ' votes (' + pct(c.parsed.x).toFixed(1) + '%)'; } } } },
          scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#e8edf7' }, border: { display: false } }, y: { grid: { display: false }, border: { display: false } } }
        }
      });
      pie = new Chart(q('pie'), {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderColor: '#fff', borderWidth: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '64%', animation: anim, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, padding: 14 } } } }
      });
    };
  }

  Results.toCSV = function (cands) {
    var total = cands.reduce(function (s, c) { return s + c.votes; }, 0);
    var rows = [['Candidate', 'Party', 'Status', 'Votes', 'Share %']].concat(cands.map(function (c) {
      return [c.name, c.party, c.active ? 'Active' : 'Removed', c.votes, total ? (c.votes / total * 100).toFixed(2) : '0.00'];
    }));
    return rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
  };
  w.Results = Results;
})(window);
