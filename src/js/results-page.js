/* ChainVote — public, read-only results page. Uses the public Sepolia RPC; no wallet or login. */
(function () {
  'use strict';
  var CFG = EVOTE_CONFIG, C = CFG.CHAIN, $ = UI.$, esc = UI.esc;
  UI.hydrate();
  var results = new Results($('#results-root'), { showInactive: false });
  var banner = new Election.Banner($('#election'), 'voter');
  var S = { cands: [], dates: { start: 0, end: 0 }, election: {}, loaded: false };

  function phase() { return Election.phase(S.dates, Chain.now()); }

  function render() {
    var s = Chain.status(), p = phase(), pb = $('#problem');
    if (s.state === 'unconfigured' || s.state === 'error') {
      pb.innerHTML = '<div class="alert alert-err">' + UI.icon('alert', 20) + '<div><strong>' + esc(/connection unavailable/i.test(s.detail) ? 'Ethereum Sepolia connection unavailable.' : 'Blockchain problem') + '</strong>' + esc(s.detail) + '</div></div>'; pb.hidden = false;
    } else pb.hidden = true;

    $('#contract-link').innerHTML = s.contract ? '<a class="btn btn-secondary" href="' + esc(Chain.addressUrl(s.contract)) + '" target="_blank" rel="noopener">' + UI.icon('external', 16) + 'View contract on Sepolia Etherscan</a> <span class="mono muted" style="margin-left:8px">' + esc(s.contract) + '</span>' : '';
    $('#chain-status').innerHTML = UI.statusList(Verify.checks('public', {}).slice(0, 1).concat(Verify.checks('public', {}).slice(2)));
    if (!S.loaded) return;
    banner.render(S.dates, render, { id: S.election.id, title: S.election.title });
    Election.stepper($('#stepper'), { phase: p, activeCandidates: S.election.activeCandidates });
    $('#results-note').innerHTML = p === 'active' ? '<b>Live results.</b> Counted directly from the smart contract while voting is still open.' : p === 'ended' ? '<b>Final results.</b> Voting has closed.' : '<b>No votes yet.</b> Results come from the smart contract once voting opens.';
    results.update(S.cands);
    $('#updated').textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  function load(quiet) {
    if (!Chain.canRead()) { S.loaded = false; render(); return Promise.resolve(); }
    return Chain.snapshot().then(function (r) { S.cands = r.candidates; S.dates = r.dates; S.election = r.election; S.loaded = true; render(); })
      .catch(function (e) { if (!quiet) UI.toast('error', 'Unable to retrieve blockchain data', e.friendly || e.message); });
  }
  $('#btn-refresh').addEventListener('click', function () { var b = this; UI.busy(b, true, 'Refreshing…'); load(false).then(function () { UI.busy(b, false); }); });

  var last = '';
  Chain.subscribe(function (s) { var k = s.state + ':' + s.contractOk; render(); if (k !== last) { last = k; load(true); } });
  Chain.init();
  setInterval(function () { if (!document.hidden && S.loaded) load(true); }, CFG.POLL_MS);
})();
