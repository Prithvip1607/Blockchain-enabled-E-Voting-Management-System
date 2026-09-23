/* ChainVote — admin dashboard.
   Blockchain writes are real transactions. The contract's onlyOwner modifier is the final
   authority; the checks here only give clear feedback before MetaMask opens. */
(function () {
  'use strict';
  var CFG = EVOTE_CONFIG, C = CFG.CHAIN, $ = UI.$, $$ = UI.$$, esc = UI.esc;
  var S = { cands: [], dates: { start: 0, end: 0 }, election: { id: null, title: '', total: 0, activeCandidates: 0, count: 0 }, loaded: false, voters: null, voterQuery: '', filled: false };
  var results = new Results($('#results-root'), { showInactive: true });
  var banner = new Election.Banner($('#election'), 'admin');
  var shell;

  function phase() { return Election.phase(S.dates, Chain.now()); }
  function started() { return !!S.dates.start && Chain.now() >= S.dates.start; }   // candidates, title and dates are frozen once voting opens
  function currentView() { return (location.hash || '#overview').replace('#', ''); }

  // 'ok' only when the connected wallet is the contract owner on Sepolia.
  function authState() {
    var s = Chain.status();
    if (s.state === 'missing') return 'no-wallet';
    if (s.state === 'wrong-network') return 'wrong-network';
    if (!s.account) return 'disconnected';
    if (!s.contractOk) return 'no-contract';
    return s.isOwner ? 'ok' : 'not-owner';
  }
  var AUTH_MSG = {
    'no-wallet': 'MetaMask is not installed.',
    'wrong-network': 'Please switch your MetaMask network to Ethereum Sepolia.',
    disconnected: 'Please connect your wallet.',
    'no-contract': 'Contract connection failed.',
    'not-owner': 'You are not authorized to perform blockchain administration.'
  };
  function requireOwner() {
    var a = authState(); if (a === 'ok') return true;
    UI.toast('error', 'Can’t send this transaction', AUTH_MSG[a]); return false;
  }

  // Run a contract write with the transaction tracker, then reload from the chain.
  function send(title, subtitle, fn, okTitle, okMsg) {
    return UI.trackTx({ title: title, subtitle: subtitle, run: fn }).then(function (r) {
      if (r.ok) UI.toast('success', okTitle, okMsg); else UI.toast('error', title + ' failed', r.error.friendly || r.error.message);
      return load(true).then(function () { return r; });
    });
  }
  var localInput = function (sec) { var d = new Date(sec * 1000); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
  var fromInput = function (v) { return Math.floor(new Date(v).getTime() / 1000); };
  var notice = function (type, html) { return '<div class="alert alert-' + type + '">' + UI.icon(type === 'err' ? 'alert' : 'info', 18) + '<div>' + html + '</div></div>'; };

  /* ---------- authorization banner + control state ---------- */
  function renderAuth() {
    var a = authState(), s = Chain.status(), box = $('#owner-alert');
    if (a === 'not-owner') {
      box.innerHTML = '<div class="alert alert-err">' + UI.icon('alert', 20) + '<div><strong>You are not authorized to perform blockchain administration.</strong>The connected wallet is not the contract owner. Connect the owner wallet <span class="mono">' + esc(UI.short(s.owner)) + '</span> in MetaMask. The smart contract rejects administrative transactions from any other wallet.</div></div>';
      box.hidden = false;
    } else box.hidden = true;

    var can = a === 'ok', locked = started(), p = phase();
    var set = function (id, off) { var b = $(id); if (b && !b.getAttribute('aria-busy')) b.disabled = off; };
    set('#btn-add', !can || locked); set('#btn-title', !can || locked); set('#btn-dates', !can || locked); set('#btn-reset', !can || p === 'active');
    ['#c-name', '#c-party', '#e-title', '#d-start', '#d-end'].forEach(function (id) { var el = $(id); if (el) el.disabled = !can || locked; });
    $$('[data-preset]').forEach(function (b) { b.disabled = !can || locked; });
    var lock = locked ? notice('info', 'Voting has opened, so candidates, title and dates are locked on the blockchain. Reset the election after it closes to start a new one.') : '';
    ['#cand-lock', '#date-lock'].forEach(function (id) { $(id).innerHTML = lock; $(id).hidden = !lock; });
  }

  /* ---------- overview ---------- */
  function renderOverview() {
    var s = Chain.status(), p = phase(), active = S.cands.filter(function (c) { return c.active; });
    banner.render(S.dates, function () { renderAll(); }, { id: S.election.id, title: S.election.title });
    Election.stepper($('#stepper'), { phase: p, activeCandidates: S.election.activeCandidates });
    var label = { unset: 'Not scheduled', upcoming: 'Scheduled', active: 'Live', ended: 'Ended' }[p];
    $('#stats').innerHTML =
      '<div class="card stat"><span class="k">' + UI.icon('idcard', 18) + 'Active candidates</span><span class="v num">' + active.length + '</span><span class="s">' + (S.cands.length - active.length) + ' removed</span></div>' +
      '<div class="card stat"><span class="k">' + UI.icon('vote', 18) + 'Votes cast</span><span class="v num">' + UI.num(S.election.total) + '</span><span class="s">recorded on-chain</span></div>' +
      '<div class="card stat"><span class="k">' + UI.icon('clock', 18) + 'Election</span><span class="v" style="font-size:1.5rem;line-height:1.35">' + label + '</span><span class="s">' + (S.dates.end ? 'Closes ' + esc(UI.dt(S.dates.end)) : 'No dates set') + '</span></div>' +
      '<div class="card stat"><span class="k">' + UI.icon('wallet', 18) + 'Admin wallet</span><span class="v" style="font-size:1.5rem;line-height:1.35">' + (authState() === 'ok' ? 'Authorized' : (s.account ? 'Not owner' : 'Not connected')) + '</span><span class="s mono">' + (s.account ? esc(UI.short(s.account)) : '&nbsp;') + '</span></div>';

    var items = [
      [authState() === 'ok', 'Owner wallet connected', 'Connect the contract owner’s wallet on Ethereum Sepolia.', null],
      [active.length >= 2, 'At least two candidates', active.length + ' on the ballot.', '#candidates'],
      [!!S.dates.start && !!S.dates.end, 'Voting window set', S.dates.start ? 'Opens ' + UI.dt(S.dates.start) : 'Choose a start and end time.', '#election']
    ];
    $('#checklist').innerHTML = items.map(function (i) {
      return '<li style="display:flex;gap:12px;align-items:flex-start"><span class="badge ' + (i[0] ? 'badge-ok' : 'badge-mute') + ' plain" style="width:26px;padding:0;justify-content:center;flex:none">' + UI.icon(i[0] ? 'check' : 'x', 14) + '</span>' +
        '<span><b>' + (i[3] && !i[0] ? '<a href="' + i[3] + '">' + i[1] + '</a>' : i[1]) + '</b><br><span class="muted" style="font-size:.88rem">' + esc(i[2]) + '</span></span></li>';
    }).join('');

    $('#chain-status').innerHTML = UI.statusList(Verify.checks('admin', {}));
    var A = function (a) { return a ? '<a class="mono" href="' + esc(Chain.addressUrl(a)) + '" target="_blank" rel="noopener">' + esc(UI.short(a)) + '</a>' : '—'; };
    $('#chain-info').innerHTML = '<dl class="kv"><dt>Network</dt><dd>' + esc(C.name) + ' <span class="muted">(' + C.id + ')</span></dd><dt>Contract</dt><dd>' + A(s.contract) + '</dd><dt>Contract owner</dt><dd>' + A(s.owner) + '</dd><dt>Connected wallet</dt><dd class="mono">' + (s.account ? esc(UI.short(s.account)) : 'Not connected') + '</dd></dl>';
  }

  /* ---------- candidates ---------- */
  function renderCandidates() {
    var box = $('#cand-table'), n = S.cands.filter(function (c) { return c.active; }).length;
    $('#cand-count').textContent = S.loaded ? n + ' active · ' + (S.cands.length - n) + ' removed' : '';
    if (!S.loaded) { box.innerHTML = '<div style="padding:0 22px 22px;display:grid;gap:10px">' + [1, 2, 3].map(function () { return '<div class="skeleton" style="height:44px"></div>'; }).join('') + '</div>'; return; }
    if (!S.cands.length) { box.innerHTML = '<div style="padding:0 22px 22px"><div class="empty">' + UI.icon('users', 30) + '<strong>No candidates yet</strong><span>Add the first candidate using the form above.</span></div></div>'; return; }
    var canDel = authState() === 'ok' && !started();
    box.innerHTML = '<div class="table-wrap" style="border:0;border-top:1px solid var(--line);border-radius:0"><table class="tbl"><caption class="sr-only">Candidates</caption><thead><tr><th scope="col">ID</th><th scope="col">Candidate</th><th scope="col">Party</th><th scope="col" class="r">Votes</th><th scope="col">Status</th><th scope="col" class="r"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      S.cands.map(function (c) {
        return '<tr><td class="num muted">' + c.id + '</td><td><div class="cell-person"><span class="avatar" aria-hidden="true">' + esc(UI.initials(c.name)) + '</span><b>' + esc(c.name) + '</b></div></td><td class="muted">' + esc(c.party) + '</td><td class="r num">' + UI.num(c.votes) + '</td>' +
          '<td><span class="badge ' + (c.active ? 'badge-ok' : 'badge-mute') + '">' + (c.active ? 'Active' : 'Removed') + '</span></td>' +
          '<td class="r">' + (c.active ? '<button type="button" class="btn btn-danger-quiet btn-sm" data-del="' + c.id + '"' + (canDel ? '' : ' disabled') + ' aria-label="Remove ' + esc(c.name) + '">' + UI.icon('trash', 16) + 'Remove</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  var candForm = UI.form($('#cand-form'), {
    name: [UI.rules.required('Name'), UI.rules.min(2, 'Name'), UI.rules.max(60, 'Name'), function (v) {
      var dup = S.cands.some(function (c) { return c.active && c.name.trim().toLowerCase() === v.trim().toLowerCase(); });
      return dup ? 'A candidate with this name is already on the ballot.' : null;
    }],
    party: [UI.rules.required('Party'), UI.rules.max(60, 'Party')]
  }, function (v) {
    if (!requireOwner()) return;
    var name = v.name.trim(), party = v.party.trim(), btn = $('#btn-add');
    UI.busy(btn, true, 'Waiting for MetaMask…');
    send('Adding candidate', name, function (h) { return Chain.addCandidate(name, party, h); }, 'Candidate added', name + ' is now on the ballot.')
      .then(function (r) { UI.busy(btn, false); renderAuth(); if (r.ok) candForm.reset(); });
  });
  $('#cand-table').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var id = Number(b.dataset.del), c = S.cands.filter(function (x) { return x.id === id; })[0];
    UI.confirm({ title: 'Remove ' + c.name + '?', danger: true, confirmLabel: 'Remove candidate', body: '<p>They will no longer appear on the ballot. This is a blockchain transaction and can’t be undone.</p>' })
      .then(function (ok) { if (ok && requireOwner()) send('Removing candidate', c.name, function (h) { return Chain.deleteCandidate(id, h); }, 'Candidate removed', c.name + ' was removed from the ballot.'); });
  });

  /* ---------- election management ---------- */
  var tzName = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'your local time zone');
  $('#tz-hint').textContent = 'Times are in ' + tzName + '. The blockchain stores them as UTC timestamps.';
  function duration(sec) {
    var dd = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), o = [];
    if (dd) o.push(dd + ' day' + (dd > 1 ? 's' : '')); if (h) o.push(h + ' hr'); if (m && !dd) o.push(m + ' min');
    return o.join(' ') || '—';
  }
  function renderElection() {
    var p = phase(), d = S.dates;
    $('#sched-badge').innerHTML = '<span class="badge ' + { unset: 'badge-mute', upcoming: '', active: 'badge-ok', ended: 'badge-mute' }[p] + '">' + { unset: 'Not set', upcoming: 'Scheduled', active: 'Live', ended: 'Ended' }[p] + '</span>';
    $('#sched').innerHTML = '<dl class="kv"><dt>Election ID</dt><dd class="num">' + esc(S.election.id == null ? '—' : S.election.id) + '</dd><dt>Title</dt><dd>' + esc(S.election.title || '—') + '</dd>' +
      (d.start ? '<dt>Opens</dt><dd>' + esc(UI.dt(d.start)) + '</dd><dt>Closes</dt><dd>' + esc(UI.dt(d.end)) + '</dd><dt>Duration</dt><dd>' + esc(duration(d.end - d.start)) + '</dd>' : '<dt>Voting window</dt><dd>Not set</dd>') + '</dl>';
    var tf = $('#title-form');
    if (S.loaded && !S.filled) {
      tf.elements.title.value = S.election.title || '';
      if (d.start) { var f = $('#date-form'); f.elements.start.value = localInput(d.start); f.elements.end.value = localInput(d.end); }
      S.filled = true;
    }
  }
  $$('[data-preset]').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = $('#date-form'), start = Math.floor(Chain.now() / 60) * 60;
      f.elements.start.value = localInput(start); f.elements.end.value = localInput(start + Number(b.dataset.preset));
      ['start', 'end'].forEach(function (n) { UI.setFieldError(f, n, null); });
    });
  });
  UI.form($('#title-form'), { title: [UI.rules.required('Title'), UI.rules.max(100, 'Title')] }, function (v) {
    if (!requireOwner()) return;
    var t = v.title.trim(), btn = $('#btn-title'); UI.busy(btn, true, 'Waiting for MetaMask…');
    send('Saving election title', t, function (h) { return Chain.setTitle(t, h); }, 'Title saved', 'The election title was updated on-chain.').then(function () { UI.busy(btn, false); renderAuth(); });
  });
  UI.form($('#date-form'), {
    start: [UI.rules.required('Opening time')],
    end: [UI.rules.required('Closing time'), function (v, f) {
      if (!f.elements.start.value) return null;
      var s = fromInput(f.elements.start.value), e = fromInput(v);
      if (e <= s) return 'Closing time must be after the opening time.';
      if (e <= Chain.now()) return 'Closing time is in the past. Choose a future time.';
      if (S.election.activeCandidates < 2) return 'Add at least two candidates before scheduling the election.';
      return null;
    }]
  }, function (v) {
    if (!requireOwner()) return;
    var s = fromInput(v.start), e = fromInput(v.end), btn = $('#btn-dates');
    UI.busy(btn, true, 'Waiting for MetaMask…');
    send('Saving voting window', UI.dt(s) + ' → ' + UI.dt(e), function (h) { return Chain.setDates(s, e, h); }, 'Voting window saved', 'Voting opens ' + UI.dt(s) + '.').then(function () { UI.busy(btn, false); renderAuth(); });
  });
  $('#btn-reset').addEventListener('click', function () {
    UI.confirm({ title: 'Reset the election?', danger: true, phrase: 'RESET', confirmLabel: 'Reset election',
      body: '<p>This starts a new election on the blockchain:</p><ul style="margin:8px 0 0;padding-left:20px"><li>The election ID increases by one</li><li>Candidates and the voting window are cleared</li><li>Every wallet can vote again</li></ul><p style="margin-top:8px">Earlier elections remain on the blockchain.</p>' })
      .then(function (ok) {
        if (!ok || !requireOwner()) return;
        send('Resetting election', 'New election', function (h) { return Chain.resetElection(h); }, 'Election reset', 'Add candidates and set a new voting window.').then(function (r) {
          if (r.ok) { S.filled = false; $('#date-form').reset(); renderElection(); }
        });
      });
  });

  /* ---------- results ---------- */
  function renderResults() {
    if (!S.loaded) return;
    results.update(S.cands);
    $('#updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }
  $('#btn-refresh').addEventListener('click', function () { var b = this; UI.busy(b, true, 'Refreshing…'); load(false).then(function () { UI.busy(b, false); }); });
  $('#btn-csv').addEventListener('click', function () {
    var blob = new Blob([Results.toCSV(S.cands)], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'election-' + (S.election.id || 'results') + '.csv'; a.click(); URL.revokeObjectURL(a.href);
    UI.toast('success', 'Results exported', 'Read from the smart contract.');
  });

  /* ---------- registered accounts (FastAPI / MySQL) ---------- */
  function loadVoters() {
    var box = $('#voter-table');
    box.innerHTML = '<div style="display:grid;gap:10px">' + [1, 2, 3, 4].map(function () { return '<div class="skeleton" style="height:46px"></div>'; }).join('') + '</div>';
    return Auth.listVoters().then(function (v) { S.voters = v; renderVoters(); }, function (e) {
      box.innerHTML = '<div class="alert alert-err">' + UI.icon('alert', 20) + '<div><strong>Couldn’t load accounts</strong>' + esc(e.friendly || e.message) + '</div><button type="button" class="btn btn-secondary btn-sm" style="margin-left:auto" id="voters-retry">Try again</button></div>';
      $('#voters-retry').addEventListener('click', loadVoters);
    });
  }
  function renderVoters() {
    var box = $('#voter-table'), q = S.voterQuery.trim().toLowerCase(), me = shell && shell.session.voterId;
    var list = (S.voters || []).filter(function (v) { return !q || String(v.id).toLowerCase().indexOf(q) >= 0; });
    if (!list.length) { box.innerHTML = '<div class="empty">' + UI.icon('users', 30) + '<strong>' + (q ? 'No accounts match “' + esc(S.voterQuery) + '”' : 'No registered accounts') + '</strong><span>' + (q ? 'Try a different voter ID.' : 'Accounts appear here after people sign up.') + '</span></div>'; return; }
    box.innerHTML = '<div class="table-wrap"><table class="tbl"><caption class="sr-only">Registered accounts</caption><thead><tr><th scope="col">Voter ID</th><th scope="col">Role</th><th scope="col" class="r"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      list.map(function (v) {
        var self = v.id === me;
        return '<tr><td><div class="cell-person"><span class="avatar" aria-hidden="true">' + esc(UI.initials(v.id)) + '</span><b>' + esc(v.id) + '</b>' + (self ? ' <span class="badge badge-mute plain">You</span>' : '') + '</div></td>' +
          '<td><span class="badge ' + (v.role === 'admin' ? '' : 'badge-mute') + ' plain">' + (v.role === 'admin' ? 'Administrator' : 'Voter') + '</span></td>' +
          '<td class="r">' + (self ? '' : '<button type="button" class="btn btn-danger-quiet btn-sm" data-vdel="' + esc(v.id) + '" aria-label="Remove account ' + esc(v.id) + '">' + UI.icon('trash', 16) + 'Remove</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  $('#voter-table').addEventListener('click', function (e) {
    var b = e.target.closest('[data-vdel]'); if (!b) return; var id = b.dataset.vdel;
    UI.confirm({ title: 'Remove account ' + id + '?', danger: true, confirmLabel: 'Remove account', body: '<p>This account will no longer be able to sign in to ChainVote. Any vote already recorded on the blockchain stays there.</p>' }).then(function (ok) {
      if (!ok) return; UI.busy(b, true, 'Removing…');
      Auth.deleteVoter(id).then(function () { UI.toast('success', 'Account removed', id); S.voters = S.voters.filter(function (v) { return v.id !== id; }); renderVoters(); },
        function (er) { UI.busy(b, false); UI.toast('error', 'Couldn’t remove account', er.friendly || er.message); renderVoters(); });
    });
  });
  $('#v-search').addEventListener('input', function (e) { S.voterQuery = e.target.value; if (S.voters) renderVoters(); });
  $('#btn-voters-refresh').addEventListener('click', loadVoters);

  function renderVerify() {
    if (currentView() !== 'verify') return;
    Verify.render($('#verify-root'), 'admin', { phase: phase(), electionId: S.election.id });
  }

  /* ---------- data ---------- */
  function renderAll() { renderAuth(); renderOverview(); renderCandidates(); renderElection(); renderResults(); renderVerify(); }
  function load(quiet) {
    if (!Chain.canRead()) { S.loaded = true; S.cands = []; renderAll(); return Promise.resolve(); }
    return Chain.snapshot().then(function (r) {
      S.cands = r.candidates; S.dates = r.dates; S.election = r.election; S.loaded = true; renderAll();
    }).catch(function (e) { S.loaded = true; renderAll(); if (!quiet) UI.toast('error', 'Unable to retrieve blockchain data', e.friendly || e.message); });
  }
  var lastKey = '';
  Chain.subscribe(function (s) {
    var k = [s.state, s.account, s.chainId, s.contractOk, s.owner].join(':');
    if (k !== lastKey) { lastKey = k; if (shell) load(true); else renderAll(); }
  });

  shell = Shell.init({
    role: 'admin', default: 'overview',
    views: { overview: 'Overview', candidates: 'Candidates', election: 'Election management', results: 'Results', voters: 'Registered accounts', verify: 'Blockchain verification' },
    onEnter: function (id) { if (id === 'voters' && !S.voters) loadVoters(); if (id === 'verify') renderVerify(); }
  });
  if (!shell) return;
  Shell.chainAlert($('#chain-alert'), 'Adding candidates and setting dates are transactions signed by the contract owner’s wallet.');
  renderCandidates();
  setTimeout(function () { load(); }, 60);
  setInterval(function () { if (!document.hidden && S.loaded) load(true); }, CFG.POLL_MS);
})();
