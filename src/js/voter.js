/* ChainVote — voter dashboard, ballot, results and verification (all data from the Voting contract) */
(function () {
  'use strict';
  var CFG = EVOTE_CONFIG, C = CFG.CHAIN, $ = UI.$, esc = UI.esc;
  var S = { cands: [], dates: { start: 0, end: 0 }, election: { id: null, title: '', total: 0, activeCandidates: 0, count: 0 }, voted: false, selected: null, loaded: false, myVote: null, ballotSig: '' };
  var results = new Results($('#results-root'), { showInactive: false });
  var banner = new Election.Banner($('#election'), 'voter');
  var shell;

  function phase() { return Election.phase(S.dates, Chain.now()); }
  function currentView() { return (location.hash || '#dashboard').replace('#', ''); }

  /* ---------- receipts: real data only ---------- */
  function receiptKey() { var a = Chain.status().account; return a ? 'evote:receipt:' + a.toLowerCase() : null; }
  function localReceipt() {
    var k = receiptKey(); if (!k) return null;
    try { var r = JSON.parse(localStorage.getItem(k)); return r && r.electionId === S.election.id ? r : null; } catch (e) { return null; }
  }
  // Prefer the local receipt; otherwise rebuild it from the on-chain VoteCast event.
  function myReceipt() {
    var r = localReceipt(); if (r) return r;
    if (!S.myVote) return null;
    var c = S.cands.filter(function (x) { return x.id === S.myVote.candidateId; })[0] || {};
    return { candidate: c.name || ('Candidate #' + S.myVote.candidateId), party: c.party || '', candidateId: S.myVote.candidateId, account: Chain.status().account, hash: S.myVote.hash, block: S.myVote.block, electionId: S.myVote.electionId, contract: Chain.status().contract };
  }

  /* ---------- dashboard ---------- */
  function renderElection() {
    banner.render(S.dates, function () { renderAll(); }, { id: S.election.id, title: S.election.title });
    Election.stepper($('#stepper'), { phase: phase(), activeCandidates: S.election.activeCandidates });
  }

  function renderCards() {
    var s = Chain.status(), p = phase();
    var wl = { connected: ['badge-ok', 'Connected'], disconnected: ['badge-err', 'Not connected'], missing: ['badge-err', 'MetaMask not found'], 'wrong-network': ['badge-warn', 'Wrong network'], error: ['badge-warn', 'Unavailable'], unconfigured: ['badge-warn', 'Not configured'], loading: ['badge-mute', 'Checking'] }[s.state] || ['badge-mute', '—'];
    $('#card-wallet').innerHTML = '<div class="card-head" style="margin-bottom:12px"><h3>' + UI.icon('wallet', 18) + ' MetaMask</h3><span class="badge ' + wl[0] + '">' + wl[1] + '</span></div>' +
      (s.state === 'connected' ?
        '<dl class="kv"><dt>Address</dt><dd class="mono">' + esc(UI.short(s.account)) + '</dd><dt>Network</dt><dd>' + esc(s.networkName) + '</dd><dt>Contract</dt><dd class="mono"><a href="' + esc(Chain.addressUrl(s.contract)) + '" target="_blank" rel="noopener">' + esc(UI.short(s.contract)) + '</a></dd></dl>' :
        '<p class="muted" style="font-size:.92rem;margin-bottom:14px">' + (s.state === 'wrong-network' ? esc(s.detail) : 'Connect MetaMask on ' + esc(C.name) + ' to vote.') + '</p>' +
        (s.state === 'disconnected' ? '<button class="btn btn-sm" data-act="connect">Connect wallet</button>' : '') +
        (s.state === 'wrong-network' ? '<button class="btn btn-sm" data-act="network">Switch network</button>' : ''));

    var b;
    if (s.state !== 'connected') b = ['badge-mute', 'Unknown', '<p class="muted" style="font-size:.92rem">Connect your wallet to see whether this address has voted.</p>'];
    else if (S.voted) b = ['badge-ok', 'Vote confirmed', '<p class="muted" style="font-size:.92rem;margin-bottom:14px">Your vote is recorded on ' + esc(C.name) + '. It can’t be changed.</p><button class="btn btn-secondary btn-sm" data-act="receipt">' + UI.icon('receipt', 16) + 'View receipt</button>'];
    else if (p === 'active') b = ['badge', 'Not voted yet', '<p class="muted" style="font-size:.92rem;margin-bottom:14px">Voting is open. Your wallet has one vote.</p><a class="btn btn-sm" href="#vote">Go to ballot</a>'];
    else b = ['badge-mute', 'Not voted', '<p class="muted" style="font-size:.92rem">' + { upcoming: 'Voting hasn’t opened yet.', ended: 'Voting has closed.', unset: 'No election is scheduled.' }[p] + '</p>'];
    $('#card-ballot').innerHTML = '<div class="card-head" style="margin-bottom:12px"><h3>' + UI.icon('vote', 18) + ' Your ballot</h3><span class="badge ' + b[0] + '">' + b[1] + '</span></div>' + b[2];

    $('#card-turnout').innerHTML = '<div class="card-head" style="margin-bottom:12px"><h3>' + UI.icon('users', 18) + ' Turnout</h3></div><div class="stat"><span class="v num">' + UI.num(S.election.total) + '</span><span class="s">votes cast across ' + S.election.activeCandidates + ' candidate' + (S.election.activeCandidates === 1 ? '' : 's') + '</span></div>' +
      '<a href="#results" style="display:inline-block;margin-top:12px;font-weight:600;font-size:.9rem">See results</a>';

    $('#dash-status').innerHTML = UI.statusList(Verify.checks('voter', { voted: S.voted, phase: p }));
  }
  $('#view-dashboard').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'connect') { UI.busy(a, true, 'Connecting…'); Chain.connect().catch(function (er) { UI.toast('error', 'Wallet not connected', er.friendly); }).then(function () { UI.busy(a, false); }); }
    if (a.dataset.act === 'network') Chain.switchNetwork().catch(function (er) { UI.toast('error', 'Could not switch network', er.friendly); });
    if (a.dataset.act === 'receipt') showReceipt(myReceipt());
  });

  /* ---------- ballot ---------- */
  function renderBallot() {
    var s = Chain.status(), p = phase(), active = S.cands.filter(function (c) { return c.active; });
    var canVote = p === 'active' && s.state === 'connected' && !S.voted;
    var sig = JSON.stringify([S.loaded, active, canVote, S.voted, p, s.state, S.dates, Chain.canRead()]);
    if (sig === S.ballotSig) return;                 // don't rebuild (and drop keyboard focus) when nothing changed
    S.ballotSig = sig;

    var n = '';
    if (S.voted) n = '<div class="alert alert-ok">' + UI.icon('check', 20) + '<div><strong>You have already voted in this election.</strong>This wallet address has a confirmed vote on the blockchain.</div></div>';
    else if (p !== 'active') n = '<div class="alert alert-info">' + UI.icon('clock', 20) + '<div><strong>' + { unset: 'No election scheduled', upcoming: 'The election has not started', ended: 'The election has ended' }[p] + '</strong>' + (p === 'upcoming' ? 'The ballot opens ' + esc(UI.dt(S.dates.start)) + '.' : p === 'ended' ? 'Final results are on the Results page.' : 'The administrator hasn’t set the voting dates yet.') + '</div></div>';
    else if (s.state === 'wrong-network') n = '<div class="alert alert-warn">' + UI.icon('alert', 20) + '<div><strong>Please switch your MetaMask network to Ethereum Sepolia.</strong>You can review candidates now, but voting needs the right network.</div><button type="button" class="btn btn-sm" style="margin-left:auto" data-act="network">Switch network</button></div>';
    else if (s.state !== 'connected') n = '<div class="alert alert-warn">' + UI.icon('wallet', 20) + '<div><strong>Please connect your wallet to vote.</strong>You can review candidates now, but voting needs a connected MetaMask account.</div><button type="button" class="btn btn-sm" style="margin-left:auto" data-act="connect">Connect wallet</button></div>';
    $('#ballot-notice').innerHTML = n;

    var box = $('#ballot');
    if (!Chain.canRead() && S.loaded) { box.innerHTML = '<div class="empty" style="grid-column:1/-1">' + UI.icon('alert', 30) + '<strong>Candidates unavailable</strong><span>Candidates are read from the smart contract on ' + esc(C.name) + ', which can’t be reached right now.</span></div>'; $('#action-bar').hidden = true; return; }
    if (!S.loaded) { box.innerHTML = [1, 2, 3, 4].map(function () { return '<div class="skeleton" style="height:90px;border-radius:14px"></div>'; }).join(''); return; }
    if (!active.length) { box.innerHTML = '<div class="empty" style="grid-column:1/-1">' + UI.icon('users', 30) + '<strong>No candidates on the ballot yet</strong><span>The administrator hasn’t added any candidates.</span></div>'; $('#action-bar').hidden = true; return; }
    box.innerHTML = active.map(function (c) {
      return '<label class="cand"><input type="radio" name="candidate" value="' + c.id + '"' + (canVote ? '' : ' disabled') + (S.selected === c.id ? ' checked' : '') + '>' +
        '<span class="cand-body"><span class="avatar" aria-hidden="true">' + esc(UI.initials(c.name)) + '</span><span><span class="nm">' + esc(c.name) + '</span><br><span class="pt">' + esc(c.party) + '</span><br><span class="id-tag">Candidate ID ' + c.id + '</span></span><span class="tick">' + UI.icon('check', 16) + '</span></span></label>';
    }).join('');
    $('#action-bar').hidden = !canVote; updateSel();
  }
  function updateSel() {
    var c = S.cands.filter(function (x) { return x.id === S.selected; })[0];
    $('#sel-text').innerHTML = c ? 'Selected: <b>' + esc(c.name) + '</b> · ' + esc(c.party) : 'No candidate selected';
    $('#btn-review').disabled = !c;
  }
  $('#ballot').addEventListener('change', function (e) { if (e.target.name === 'candidate') { S.selected = Number(e.target.value); updateSel(); } });
  $('#ballot-notice').addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'connect') Chain.connect().catch(function (er) { UI.toast('error', 'Wallet not connected', er.friendly); });
    if (a.dataset.act === 'network') Chain.switchNetwork().catch(function (er) { UI.toast('error', 'Could not switch network', er.friendly); });
  });

  // Steps from the spec: MetaMask -> network -> election status -> voter status -> contract call.
  function preflight() {
    var s = Chain.status(), p = phase();
    if (s.state === 'missing') return 'MetaMask is not installed.';
    if (s.state === 'wrong-network') return 'Please switch your MetaMask network to Ethereum Sepolia.';
    if (!s.account) return 'Please connect your wallet.';
    if (s.state !== 'connected') return s.detail || 'Contract connection failed.';
    if (p === 'unset') return 'The election has not been scheduled yet.';
    if (p === 'upcoming') return 'The election has not started.';
    if (p === 'ended') return 'The election has ended.';
    return null;
  }

  $('#ballot-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var c = S.cands.filter(function (x) { return x.id === S.selected; })[0]; if (!c) return;
    var problem = preflight();
    if (problem) { UI.toast('error', 'Can’t vote yet', problem); return; }
    var btn = $('#btn-review'); UI.busy(btn, true, 'Checking…');
    Chain.hasVoted().then(function (already) {
      UI.busy(btn, false); updateSel();
      if (already) { S.voted = true; S.ballotSig = ''; renderAll(); UI.toast('error', 'Already voted', 'You have already voted in this election.'); return; }
      var s = Chain.status();
      return UI.confirm({
        title: 'Review your vote', confirmLabel: 'Confirm and vote',
        body: '<div class="summary"><div class="cell-person"><span class="avatar" aria-hidden="true">' + esc(UI.initials(c.name)) + '</span><div><b style="font-size:1.05rem">' + esc(c.name) + '</b><div class="muted">' + esc(c.party) + ' · Candidate ID ' + c.id + '</div></div></div>' +
          '<dl class="kv"><dt>Election</dt><dd>#' + esc(S.election.id) + '</dd><dt>Voting as</dt><dd class="mono">' + esc(UI.short(s.account)) + '</dd><dt>Network</dt><dd>' + esc(C.name) + '</dd><dt>Contract</dt><dd class="mono">' + esc(UI.short(s.contract)) + '</dd></dl></div>' +
          '<div class="alert alert-warn" style="margin-top:12px">' + UI.icon('alert', 18) + '<div>Your vote is an Ethereum transaction. Once confirmed you can’t change or withdraw it. MetaMask will ask you to approve it and charge a small network fee in Sepolia test ETH.</div></div>'
      }).then(function (ok) { if (ok) cast(c); });
    }, function (er) { UI.busy(btn, false); updateSel(); UI.toast('error', 'Couldn’t check your voting status', er.friendly || er.message); });
  });

  function cast(c) {
    var btn = $('#btn-review'); btn.disabled = true;
    UI.trackTx({ title: 'Casting your vote', subtitle: 'For ' + c.name + ' · ' + C.name, run: function (hooks) { return Chain.vote(c.id, hooks); } }).then(function (r) {
      if (r.ok) {
        var s = Chain.status(), ev = (r.receipt.events || []).filter(function (x) { return x.name === 'VoteCast'; })[0];
        var rec = { candidate: c.name, party: c.party, candidateId: c.id, account: s.account, hash: r.receipt.hash, block: r.receipt.block, contract: s.contract, electionId: ev ? Number(ev.args.electionId) : S.election.id, time: Chain.now() };
        try { localStorage.setItem(receiptKey(), JSON.stringify(rec)); } catch (e) {}
        S.voted = true; S.selected = null; S.ballotSig = '';
        UI.closeTx(); UI.toast('success', 'Vote confirmed', 'Recorded in block ' + rec.block + ' on ' + C.name + '.');
        showReceipt(rec);
      } else {
        UI.toast('error', 'Vote not recorded', r.error.friendly || r.error.message);
      }
      return load(true);
    });
  }

  function showReceipt(r) {
    if (!r) return;
    var contractAddr = r.contract || Chain.status().contract;
    var dlg = UI.dialog('<div class="receipt"><div class="stamp"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>' +
      '<h2 style="margin-top:16px">Vote confirmed</h2><p class="muted" style="margin-top:6px">Your vote is recorded on ' + esc(C.name) + '. Keep the transaction hash: anyone can verify it on Etherscan.</p></div>' +
      '<div class="ticket"><div class="row"><span>Candidate</span><span><b>' + esc(r.candidate) + '</b>' + (r.party ? ' · ' + esc(r.party) : '') + '</span></div>' +
      '<div class="row"><span>Election ID</span><span class="num">' + esc(r.electionId) + '</span></div>' +
      '<div class="row"><span>Wallet</span><span class="mono">' + esc(UI.short(r.account)) + '</span></div>' +
      '<div class="row"><span>Network</span><span>' + esc(C.name) + '</span></div>' +
      '<div class="row"><span>Contract</span><span class="mono"><a href="' + esc(Chain.addressUrl(contractAddr)) + '" target="_blank" rel="noopener">' + esc(UI.short(contractAddr)) + '</a></span></div>' +
      '<div class="row"><span>Block number</span><span class="num">' + esc(r.block) + '</span></div>' +
      '<div class="row"><span>Status</span><span><span class="badge badge-ok">Confirmed</span></span></div>' +
      '<div class="row"><span>Transaction hash</span><span class="copy-line"><a class="mono" href="' + esc(Chain.txUrl(r.hash)) + '" target="_blank" rel="noopener">' + esc(UI.shortHash(r.hash)) + '</a><button type="button" class="btn btn-ghost btn-icon btn-sm" data-copy aria-label="Copy transaction hash">' + UI.icon('copy', 16) + '</button></span></div></div>' +
      '<div class="dlg-actions"><button type="button" class="btn btn-secondary" data-close>Close</button>' +
      '<a class="btn btn-secondary" href="' + esc(Chain.txUrl(r.hash)) + '" target="_blank" rel="noopener">' + UI.icon('external', 16) + 'Sepolia Etherscan</a>' +
      '<button type="button" class="btn" data-results>See results</button></div>', 'Vote receipt');
    dlg.querySelector('[data-copy]').addEventListener('click', function () { UI.copy(r.hash, 'Transaction hash copied.'); });
    dlg.querySelector('[data-results]').addEventListener('click', function () { dlg.close(); location.hash = '#results'; });
  }

  /* ---------- results ---------- */
  function renderResults() {
    if (!S.loaded) return;
    var p = phase();
    $('#results-note').innerHTML = p === 'active' ? '<b>Live results.</b> Counted directly from the smart contract while voting is still open. Votes on this prototype are public, not secret.' :
      p === 'ended' ? '<b>Final results.</b> Voting has closed. These counts are read from the smart contract on ' + esc(C.name) + '.' : '<b>No votes yet.</b> Results come from the smart contract once voting opens.';
    results.update(S.cands);
    $('#updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }
  $('#btn-refresh').addEventListener('click', function () {
    var b = this; UI.busy(b, true, 'Refreshing…'); load(false).then(function () { UI.busy(b, false); });
  });

  function renderVerify() {
    if (currentView() !== 'verify') return;
    Verify.render($('#verify-root'), 'voter', { voted: S.voted, phase: phase(), electionId: S.election.id });
  }

  /* ---------- data ---------- */
  function renderAll() { renderElection(); renderCards(); renderBallot(); renderResults(); renderVerify(); }

  function load(quiet) {
    if (!Chain.canRead()) { S.loaded = true; S.cands = []; renderAll(); return Promise.resolve(); }
    return Chain.snapshot().then(function (r) {
      S.cands = r.candidates; S.dates = r.dates; S.election = r.election; S.voted = r.voted; S.loaded = true;
      if (S.selected != null && !S.cands.some(function (c) { return c.id === S.selected && c.active; })) S.selected = null;
      return S.voted ? Chain.findMyVote().then(function (v) { S.myVote = v; }) : (S.myVote = null);
    }).then(renderAll).catch(function (e) {
      S.loaded = true; renderAll();
      if (!quiet) UI.toast('error', 'Unable to retrieve blockchain data', e.friendly || e.message);
    });
  }

  var lastKey = '';
  Chain.subscribe(function (s) {
    var key = [s.state, s.account, s.chainId, s.contractOk].join(':');
    if (key !== lastKey) { lastKey = key; S.ballotSig = ''; if (shell) load(true); else renderCards(); }
  });

  shell = Shell.init({ role: 'user', views: { dashboard: 'Dashboard', vote: 'Cast your vote', results: 'Results', verify: 'Blockchain verification' }, default: 'dashboard', onEnter: function (id) { if (id === 'verify') renderVerify(); } });
  if (!shell) return;
  Shell.chainAlert($('#chain-alert'), 'Voting uses your MetaMask account. Reading results doesn’t need it.');
  renderBallot();
  setTimeout(function () { load(); }, 60);
  setInterval(function () { if (!document.hidden && S.loaded) load(true); }, CFG.POLL_MS);
})();
