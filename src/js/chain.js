/* ==========================================================================
   ChainVote — blockchain adapter (ethers.js v6 + MetaMask + Ethereum Sepolia)

   Every interaction with the Voting smart contract goes through this file.
   There is NO simulation: reads come from the chain, writes are transactions
   signed by the user's MetaMask wallet, and any hash / block number shown in
   the UI is taken from the real transaction receipt.

   Reads   -> MetaMask's provider when the wallet is on Sepolia, otherwise the
              public read-only Sepolia RPC in config.js.
   Writes  -> MetaMask signer only. No private key ever exists in this code.
   ========================================================================== */
(function (w) {
  'use strict';
  var CFG = w.EVOTE_CONFIG, C = CFG.CHAIN;

  var NETWORKS = { 1: 'Ethereum Mainnet', 11155111: 'Ethereum Sepolia', 17000: 'Holesky', 5: 'Goerli', 137: 'Polygon', 56: 'BNB Chain' };
  var netName = function (id) { return id == null ? '—' : (NETWORKS[id] || ('Chain ' + id)); };
  var nowSec = function () { return Math.floor(Date.now() / 1000); };

  var subs = [], D = null, rpc = null, browser = null, offset = 0, bound = false, queue = Promise.resolve();
  var S = { state: 'loading', detail: '', fatal: '', account: null, chainId: null, contract: '', owner: null, contractOk: false, rpcOk: false, walletPresent: false };

  /* ---------- errors ---------- */
  function fail(msg, code) { var e = new Error(msg); e.friendly = msg; e.code = code; return e; }

  // Turns ethers / MetaMask / EVM errors into sentences a voter can act on.
  // Revert strings match contracts/Voting.sol.
  function normalize(e) {
    if (e && e.friendly) return e;
    var code = e && e.code, info = e && e.info && e.info.error, reason = e && (e.reason || (e.revert && e.revert.args && e.revert.args[0]));
    var text = [reason, e && e.shortMessage, e && e.message, info && info.message].filter(Boolean).join(' | ');
    var f;
    if (code === 'ACTION_REJECTED' || code === 4001 || (info && info.code === 4001) || /user (rejected|denied)/i.test(text)) f = 'You rejected the transaction in MetaMask. Nothing was sent.';
    else if (code === -32002 || (info && info.code === -32002)) f = 'A MetaMask request is already open. Open MetaMask to continue.';
    else if (/only admin/i.test(text)) f = 'Only the contract owner can perform this action.';
    else if (/already voted/i.test(text)) f = 'You have already voted in this election.';
    else if (/not scheduled/i.test(text)) f = 'The election has not been scheduled yet.';
    else if (/has not started/i.test(text)) f = 'The election has not started.';
    else if (/has ended/i.test(text)) f = 'The election has ended.';
    else if (/Voting has already started/i.test(text)) f = 'Voting has already started, so this can no longer be changed.';
    else if (/Candidate already exists/i.test(text)) f = 'A candidate with this name is already on the ballot.';
    else if (/Invalid candidate name/i.test(text)) f = 'Candidate name must be 1–60 characters.';
    else if (/Invalid party/i.test(text)) f = 'Party name must be 1–60 characters.';
    else if (/not active|Invalid candidate/i.test(text)) f = 'That candidate is not available. Refresh and try again.';
    else if (/two candidates/i.test(text)) f = 'At least two candidates are required before scheduling the election.';
    else if (/after start|Invalid start|in the future/i.test(text)) f = 'Check the dates: the end must be after the start and in the future.';
    else if (/Cannot reset/i.test(text)) f = 'The election can’t be reset while voting is active.';
    else if (/Invalid title/i.test(text)) f = 'Election title must be 1–100 characters.';
    else if (code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(text)) f = 'Your wallet doesn’t have enough Sepolia ETH to pay the network fee. Get test ETH from a Sepolia faucet.';
    else if (code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'SERVER_ERROR' || /failed to fetch|network error|timeout|could not detect network/i.test(text)) f = 'Ethereum Sepolia connection unavailable.';
    else if (code === 'CALL_EXCEPTION' || /revert/i.test(text)) f = 'The smart contract rejected this transaction.';
    else f = 'Transaction failed.';
    var err = new Error(text || f); err.friendly = f; err.code = code; return err;
  }

  /* ---------- state ---------- */
  function status() {
    var owner = S.owner, acct = S.account;
    return {
      state: S.state, detail: S.detail, account: acct, chainId: S.chainId, networkName: netName(S.chainId),
      onSepolia: S.chainId === C.id, contract: S.contract, owner: owner,
      isOwner: !!(owner && acct && owner.toLowerCase() === acct.toLowerCase()),
      contractOk: S.contractOk, rpcOk: S.rpcOk, walletPresent: S.walletPresent,
      deploymentTx: D && D.deploymentTx || null
    };
  }
  function emit() { var s = status(); subs.forEach(function (f) { try { f(s); } catch (e) { console.error(e); } }); }

  function computeState() {
    S.detail = '';
    if (S.fatal) { S.state = 'error'; S.detail = S.fatal; return; }
    if (!D) { S.state = 'unconfigured'; S.detail = 'The contract address is not configured. Deploy Voting.sol to Sepolia, then run "npm run export:frontend".'; return; }
    if (!S.rpcOk) { S.state = 'error'; S.detail = 'Ethereum Sepolia connection unavailable.'; return; }
    if (!S.contractOk) { S.state = 'error'; S.detail = 'No Voting contract was found at ' + S.contract + ' on ' + C.name + '. Check deployment.json.'; return; }
    if (!S.walletPresent) { S.state = 'missing'; S.detail = 'MetaMask is not installed.'; return; }
    if (S.chainId !== C.id) { S.state = 'wrong-network'; S.detail = 'Please switch your MetaMask network to ' + C.name + '.'; return; }
    if (!S.account) { S.state = 'disconnected'; return; }
    S.state = 'connected';
  }

  function reader() { return (S.account && S.chainId === C.id && browser) ? browser : rpc; }
  function contract(runner) { return new ethers.Contract(D.address, D.abi, runner); }

  function refresh() {
    queue = queue.then(doRefresh, doRefresh);
    return queue;
  }
  async function doRefresh() {
    if (typeof ethers === 'undefined') { computeState(); emit(); return; }
    S.walletPresent = !!w.ethereum; S.account = null; S.chainId = null; browser = null;
    if (S.walletPresent) {
      try { S.chainId = parseInt(await w.ethereum.request({ method: 'eth_chainId' }), 16); } catch (e) {}
      try { var a = await w.ethereum.request({ method: 'eth_accounts' }); S.account = a && a[0] ? ethers.getAddress(a[0]) : null; } catch (e) {}
      browser = new ethers.BrowserProvider(w.ethereum);
    }
    if (D && !S.fatal) {
      try {
        var p = reader(), code = await p.getCode(D.address);
        S.rpcOk = true; S.contractOk = !!code && code !== '0x';
        if (S.contractOk) S.owner = await contract(p).owner();
        var b = await p.getBlock('latest'); if (b) offset = Number(b.timestamp) - nowSec();
      } catch (e) { S.rpcOk = false; S.contractOk = false; }
    }
    computeState(); emit();
  }

  async function init() {
    if (typeof ethers === 'undefined') {
      S.fatal = 'ethers.js is not loaded. Run "npm install" (it copies ethers into src/vendor).';
      computeState(); emit(); return;
    }
    try {
      var r = await fetch(CFG.DEPLOYMENT_URL, { cache: 'no-store' });
      if (!r.ok) throw new Error('missing');
      D = await r.json();
    } catch (e) { D = null; }
    if (D) {
      if (!ethers.isAddress(D.address) || !Array.isArray(D.abi)) { S.fatal = 'deployment.json is invalid (needs "address" and "abi").'; D = null; }
      else if (Number(D.chainId) !== C.id) { S.fatal = 'deployment.json is for chain ' + D.chainId + ', but this app requires ' + C.name + ' (' + C.id + ').'; D = null; }
      else {
        S.contract = ethers.getAddress(D.address);
        rpc = new ethers.JsonRpcProvider(C.readRpc, C.id, { staticNetwork: true });
      }
    }
    if (w.ethereum && w.ethereum.on && !bound) {
      bound = true;
      ['accountsChanged', 'chainChanged', 'connect', 'disconnect'].forEach(function (ev) { w.ethereum.on(ev, function () { refresh(); }); });
    }
    await refresh();
  }

  /* ---------- wallet actions ---------- */
  async function connect() {
    if (!w.ethereum) throw fail('MetaMask is not installed.');
    try { await w.ethereum.request({ method: 'eth_requestAccounts' }); } catch (e) { throw normalize(e); }
    await refresh();
  }
  async function switchAccount() {
    if (!w.ethereum) throw fail('MetaMask is not installed.');
    try { await w.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] }); } catch (e) { throw normalize(e); }
    await refresh();
  }
  async function switchNetwork() {
    if (!w.ethereum) throw fail('MetaMask is not installed.');
    try { await w.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: C.hex }] }); }
    catch (e) {
      if (e && e.code === 4902) {
        try {
          await w.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: C.hex, chainName: C.name, rpcUrls: [C.readRpc], nativeCurrency: { name: 'Sepolia Ether', symbol: C.currency, decimals: 18 }, blockExplorerUrls: [C.explorer] }] });
        } catch (e2) { throw normalize(e2); }
      } else throw normalize(e);
    }
    await refresh();
  }

  /* ---------- reads ---------- */
  function needRead() {
    if (!D || !S.contractOk) throw fail(S.detail || 'Contract connection failed.');
  }
  // One consistent read of everything the UI needs.
  async function snapshot() {
    needRead();
    try {
      var p = reader(), c = contract(p);
      var r = await Promise.all([c.electionId(), c.electionTitle(), c.startTime(), c.endTime(), c.totalVotes(), c.activeCandidatesCount(), c.getCountCandidates(), c.owner(), p.getBlock('latest')]);
      var n = Number(r[6]), calls = [];
      for (var i = 1; i <= n; i++) calls.push(c.getCandidate(i));
      var res = await Promise.all(calls);
      var voted = S.account ? await c.hasVoted(S.account) : false;
      offset = Number(r[8].timestamp) - nowSec();
      if (S.owner !== r[7]) { S.owner = r[7]; emit(); }
      return {
        election: { id: Number(r[0]), title: r[1], total: Number(r[4]), activeCandidates: Number(r[5]), count: n },
        dates: { start: Number(r[2]), end: Number(r[3]) },
        candidates: res.map(function (x) { return { id: Number(x[0]), name: x[1], party: x[2], votes: Number(x[3]), active: !!x[4] }; }),
        voted: !!voted
      };
    } catch (e) { throw normalize(e); }
  }
  async function hasVoted() {
    needRead(); if (!S.account) return false;
    try { return !!(await contract(reader()).hasVoted(S.account)); } catch (e) { throw normalize(e); }
  }

  /* ---------- writes (real transactions, signed in MetaMask) ---------- */
  function guard(ownerOnly) {
    var s = status();
    if (!s.walletPresent) throw fail('MetaMask is not installed.');
    if (s.state === 'wrong-network') throw fail('Please switch your MetaMask network to ' + C.name + '.');
    if (!s.account) throw fail('Please connect your wallet.');
    if (!s.contractOk) throw fail('Contract connection failed.');
    if (ownerOnly && !s.isOwner) throw fail('You are not authorized to perform blockchain administration.');
  }
  function saveLastTx(rec) {
    try { localStorage.setItem('chainvote:tx:' + S.account.toLowerCase(), JSON.stringify(rec)); } catch (e) {}
  }
  async function send(fn, args, hooks, ownerOnly) {
    guard(ownerOnly);
    hooks = hooks || {};
    try {
      var signer = await new ethers.BrowserProvider(w.ethereum).getSigner();
      var c = contract(signer);
      await c[fn].staticCall(...args);          // dry-run: surfaces the revert reason before MetaMask opens
      var tx = await c[fn](...args);                // MetaMask asks the user to confirm here
      if (hooks.onHash) hooks.onHash(tx.hash);             // submitted, not yet confirmed
      var rc = await tx.wait();                            // resolves only when mined; throws if it reverted
      if (!rc || rc.status !== 1) throw fail('Transaction failed.');
      var iface = new ethers.Interface(D.abi), events = [];
      rc.logs.forEach(function (l) {
        if (String(l.address).toLowerCase() !== D.address.toLowerCase()) return;
        try { var p = iface.parseLog({ topics: Array.from(l.topics), data: l.data }); if (p) events.push({ name: p.name, args: p.args }); } catch (e) {}
      });
      var out = { hash: tx.hash, block: Number(rc.blockNumber), gasUsed: rc.gasUsed.toString(), contract: S.contract, network: C.name, kind: fn, events: events };
      saveLastTx({ hash: out.hash, block: out.block, kind: fn, at: nowSec() });
      return out;
    } catch (e) { throw normalize(e); }
  }

  /* ---------- verification helpers ---------- */
  function latestTx() {
    if (!S.account) return null;
    try { return JSON.parse(localStorage.getItem('chainvote:tx:' + S.account.toLowerCase())); } catch (e) { return null; }
  }
  // Asks the chain whether a transaction is really mined. Never trusts local storage for the status.
  async function txStatus(hash) {
    try {
      var r = await reader().getTransactionReceipt(hash);
      if (!r) return 'pending';
      return r.status === 1 ? 'confirmed' : 'failed';
    } catch (e) { return 'unknown'; }
  }
  // Finds the connected wallet's vote for the current election from on-chain VoteCast events.
  async function findMyVote() {
    if (!S.account || !D || !S.contractOk) return null;
    try {
      var c = contract(reader()), cur = Number(await c.electionId());
      var logs = await c.queryFilter(c.filters.VoteCast(null, null, S.account), D.deploymentBlock || 0, 'latest');
      var mine = logs.filter(function (l) { return Number(l.args.electionId) === cur; }).pop();
      if (!mine) return null;
      return { hash: mine.transactionHash, block: Number(mine.blockNumber), candidateId: Number(mine.args.candidateId), electionId: cur };
    } catch (e) { return null; }   // some RPCs limit log ranges; callers fall back to the local record
  }

  w.Chain = {
    init: init, refresh: refresh, status: status, subscribe: function (fn) { subs.push(fn); },
    connect: connect, switchAccount: switchAccount, switchNetwork: switchNetwork,
    now: function () { return nowSec() + offset; },
    snapshot: snapshot, hasVoted: hasVoted,
    canRead: function () { return !!(D && S.contractOk); },
    vote: function (id, h) { return send('vote', [id], h, false); },
    addCandidate: function (name, party, h) { return send('addCandidate', [name, party], h, true); },
    deleteCandidate: function (id, h) { return send('deleteCandidate', [id], h, true); },
    setDates: function (start, end, h) { return send('setDates', [start, end], h, true); },
    setTitle: function (title, h) { return send('setElectionTitle', [title], h, true); },
    resetElection: function (h) { return send('resetElection', [], h, true); },
    latestTx: latestTx, txStatus: txStatus, findMyVote: findMyVote,
    txUrl: function (hash) { return C.explorer + '/tx/' + hash; },
    addressUrl: function (a) { return C.explorer + '/address/' + a; },
    NETWORK_NAME: netName
  };
})(window);
