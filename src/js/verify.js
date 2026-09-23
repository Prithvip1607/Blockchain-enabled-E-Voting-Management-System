/* ==========================================================================
   ChainVote — Blockchain Verification view + status checks
   Every value is read from MetaMask, the RPC or the contract at runtime.
   ========================================================================== */
(function (w) {
  'use strict';
  var CFG = w.EVOTE_CONFIG, C = CFG.CHAIN, esc = UI.esc;

  var link = function (href, text, mono) { return '<a href="' + esc(href) + '" target="_blank" rel="noopener"' + (mono ? ' class="mono"' : '') + '>' + esc(text) + '</a>'; };

  // role: 'admin' | 'voter' | 'public'; ctx: { voted, phase }
  function checks(role, ctx) {
    ctx = ctx || {};
    var s = Chain.status();
    var onSepolia = s.walletPresent ? s.chainId === C.id : s.rpcOk;
    var items = [
      { ok: onSepolia && s.rpcOk, on: C.name + ' Connected', off: C.name + ' Not Connected', hint: s.state === 'wrong-network' ? 'Wallet is on ' + s.networkName : (!s.rpcOk ? 'RPC unreachable' : '') },
      { ok: s.walletPresent && !!s.account, on: 'MetaMask Connected', off: 'MetaMask Not Connected', hint: !s.walletPresent ? 'Not installed' : 'Connect your wallet' },
      { ok: s.contractOk, on: 'Smart Contract Connected', off: 'Contract Unavailable', hint: s.state === 'unconfigured' ? 'Not configured' : '' }
    ];
    if (role === 'admin') {
      items.push({ ok: s.isOwner, on: 'Wallet Authorized (contract owner)', off: 'Wallet Not Authorized', hint: s.account ? 'This wallet is not the contract owner' : 'Connect the owner wallet' });
    } else if (role === 'voter') {
      var can = !!s.account && s.chainId === C.id && !ctx.voted && ctx.phase === 'active';
      if (ctx.voted) items.push({ ok: true, on: 'Vote recorded for this wallet (one wallet, one vote)', off: '' });
      else items.push({ ok: can, on: 'Wallet Authorized to Vote', off: 'Wallet Not Authorized to Vote', hint: ctx.voted ? 'Already voted' : (ctx.phase !== 'active' ? 'Voting is not open' : (!s.account ? 'Connect your wallet' : (s.chainId !== C.id ? 'Wrong network' : ''))) });
    }
    return items;
  }

  var seq = 0;
  function render(el, role, ctx) {
    ctx = ctx || {};
    var s = Chain.status(), my = ++seq;
    var local = Chain.latestTx();
    var base = function (txHtml, statusHtml, blockHtml, hasTx) {
      el.innerHTML =
        '<div class="verify-grid"><div class="card"><div class="card-head"><div><h2>Status</h2><p class="card-sub">Checked live, not assumed.</p></div></div>' + UI.statusList(checks(role, ctx)) + '</div>' +
        '<div class="card"><div class="card-head"><div><h2>Where to verify</h2><p class="card-sub">Public records on Sepolia Etherscan.</p></div></div>' +
        '<div style="display:grid;gap:10px">' +
        (s.contract ? '<a class="btn btn-secondary" href="' + esc(Chain.addressUrl(s.contract)) + '" target="_blank" rel="noopener">' + UI.icon('external', 16) + 'View contract on Sepolia Etherscan</a>' : '<span class="muted">No contract configured.</span>') +
        (hasTx ? '<a class="btn btn-secondary" href="' + esc(Chain.txUrl(hasTx)) + '" target="_blank" rel="noopener">' + UI.icon('external', 16) + 'View latest transaction on Sepolia Etherscan</a>' : '<span class="muted" style="font-size:.9rem">No transaction from this wallet yet.</span>') +
        '</div></div></div>' +
        '<div class="card"><div class="card-head"><div><h2>Blockchain verification</h2><p class="card-sub">Values you can check independently on Etherscan.</p></div></div>' +
        '<dl class="kv">' +
        '<dt>Network</dt><dd>' + esc(C.name) + '</dd>' +
        '<dt>Chain ID</dt><dd class="num">' + C.id + '</dd>' +
        '<dt>Wallet network</dt><dd>' + (s.walletPresent ? esc(s.networkName) + (s.chainId === C.id ? '' : ' <span class="badge badge-warn plain">Not Sepolia</span>') : '—') + '</dd>' +
        '<dt>Contract address</dt><dd>' + (s.contract ? link(Chain.addressUrl(s.contract), s.contract, true) : '—') + '</dd>' +
        '<dt>Contract owner</dt><dd>' + (s.owner ? link(Chain.addressUrl(s.owner), s.owner, true) : '—') + '</dd>' +
        '<dt>Connected wallet</dt><dd class="mono">' + (s.account ? esc(s.account) : 'Not connected') + '</dd>' +
        '<dt>Election ID</dt><dd class="num">' + (ctx.electionId != null ? esc(ctx.electionId) : '—') + '</dd>' +
        '<dt>Latest transaction</dt><dd>' + txHtml + '</dd>' +
        '<dt>Block number</dt><dd class="num">' + blockHtml + '</dd>' +
        '<dt>Transaction status</dt><dd>' + statusHtml + '</dd></dl></div>';
    };
    var none = '<span class="muted">None yet</span>';
    if (!local) { base(none, '—', '—', null); }
    else base(link(Chain.txUrl(local.hash), UI.shortHash(local.hash), true), '<span class="badge badge-mute plain">Checking…</span>', esc(local.block), local.hash);

    // Voters can recover their vote from on-chain events even in a new browser.
    var chain = role === 'voter' ? Chain.findMyVote() : Promise.resolve(null);
    chain.then(function (v) {
      if (my !== seq) return null;
      var rec = v ? { hash: v.hash, block: v.block } : local;
      if (!rec) return null;
      if (v && (!local || local.hash !== v.hash)) base(link(Chain.txUrl(v.hash), UI.shortHash(v.hash), true), '<span class="badge badge-mute plain">Checking…</span>', esc(v.block), v.hash);
      return Chain.txStatus(rec.hash);
    }).then(function (st) {
      if (my !== seq || !st) return;
      var rows = el.querySelectorAll('.kv dd'), last = rows[rows.length - 1];
      var html = { confirmed: '<span class="badge badge-ok">Confirmed</span>', failed: '<span class="badge badge-err">Failed</span>', pending: '<span class="badge badge-warn">Pending</span>', unknown: '<span class="badge badge-mute plain">Unknown</span>' }[st];
      if (last) last.innerHTML = html;
    });
  }

  w.Verify = { checks: checks, render: render };
})(window);
