/* ==========================================================================
   ChainVote — election lifecycle helpers (phase, status banner, stepper)
   Everything here is derived from data read from the smart contract.
   ========================================================================== */
(function (w) {
  'use strict';
  var esc = UI.esc;

  // Mirrors Voting.getStatus(): 0 NotScheduled, 1 NotStarted, 2 Active, 3 Closed.
  function phase(d, t) {
    if (!d.start || !d.end) return 'unset';
    if (t < d.start) return 'upcoming';
    if (t <= d.end) return 'active';
    return 'ended';
  }

  var COPY = {
    voter: {
      unset: ['Not scheduled', 'No election is scheduled', 'The administrator hasn’t set the voting dates yet. Check back soon.'],
      upcoming: ['Voting not started', 'Voting hasn’t started', 'The ballot opens at the time below. You’ll be able to vote from this page.'],
      active: ['Voting active', 'Voting is open', 'Choose one candidate and confirm the transaction in MetaMask.'],
      ended: ['Voting closed', 'Voting has closed', 'No more votes can be cast. Final results are available.']
    },
    admin: {
      unset: ['Not scheduled', 'No election is scheduled', 'Add candidates, then set a start and end time under Election. Voters can’t vote until you do.'],
      upcoming: ['Scheduled', 'Election is scheduled', 'Voting opens automatically at the start time. Candidates and dates can be changed until then.'],
      active: ['Voting active', 'Election is live', 'Votes are being recorded on Ethereum Sepolia right now.'],
      ended: ['Voting closed', 'Election has ended', 'Review the final results, or reset the election to begin a new one.']
    }
  };

  function Banner(el, role) {
    var stop = null, key = '';
    this.render = function (dates, onPhaseChange, meta) {
      meta = meta || {};
      var p = phase(dates, Chain.now()), c = COPY[role][p];
      var target = p === 'upcoming' ? dates.start : p === 'active' ? dates.end : 0;
      var k = [p, dates.start, dates.end, meta.id, meta.title].join(':');
      if (k === key && el.firstChild) return p;
      key = k; if (stop) stop();
      var win = dates.start ? '<div class="window"><span>' + UI.icon('calendar', 16) + 'Opens ' + esc(UI.dt(dates.start)) + '</span><span>' + UI.icon('clock', 16) + 'Closes ' + esc(UI.dt(dates.end)) + '</span></div>' : '';
      var who = meta.id ? '<p class="el-meta">Election #' + esc(meta.id) + (meta.title ? ' · ' + esc(meta.title) : '') + '</p>' : '';
      el.innerHTML = '<section class="election" data-phase="' + p + '" aria-labelledby="el-h"><div>' + who + '<span class="badge">' + c[0] + '</span><h2 id="el-h">' + c[1] + '</h2><p>' + c[2] + '</p>' + win + '</div>' +
        (target ? '<div><p style="text-align:right;font-size:.85rem;margin-bottom:8px">' + (p === 'active' ? 'Closes in' : 'Opens in') + '</p><div class="clock" role="timer" aria-label="Time remaining">' +
          '<div class="plate"><b data-u="d">0</b><span>days</span></div><div class="plate"><b data-u="h">00</b><span>hours</span></div><div class="plate"><b data-u="m">00</b><span>minutes</span></div><div class="plate"><b data-u="s">00</b><span>seconds</span></div></div></div>' : '') + '</section>';
      if (target) stop = UI.countdown(el, target, Chain.now, function () { key = ''; if (onPhaseChange) onPhaseChange(); });
      return p;
    };
  }

  // Lifecycle: Created -> Candidates added -> Scheduled -> Voting -> Closed -> Results
  function stepper(el, ctx) {
    var p = ctx.phase, ready = ctx.activeCandidates >= 2;
    var votingLabel = p === 'active' ? 'Voting active' : p === 'ended' ? 'Voting active' : 'Voting not started';
    var steps = [['Election created', true], ['Candidates added', ready], ['Election scheduled', p !== 'unset'], [votingLabel, p === 'active' || p === 'ended'], ['Voting closed', p === 'ended'], ['Results available', p === 'ended']];
    var cur = steps.findIndex(function (s) { return !s[1]; });
    if (p === 'active') cur = 3;                    // voting is the step in progress
    if (cur < 0) cur = steps.length - 1;
    el.innerHTML = '<ol class="stepper" aria-label="Election lifecycle">' + steps.map(function (s, i) {
      var cls = (i < cur || (i === cur && s[1] && p !== 'active')) ? 'done' : (i === cur ? 'current' : '');
      if (p === 'ended') cls = 'done';
      return '<li class="' + cls + '"' + (cls === 'current' ? ' aria-current="step"' : '') + '><span class="st-dot">' + (cls === 'done' ? UI.icon('check', 14) : (i + 1)) + '</span><span class="st-l">' + esc(s[0]) + '</span></li>';
    }).join('') + '</ol>';
  }

  w.Election = { phase: phase, Banner: Banner, stepper: stepper };
})(window);
