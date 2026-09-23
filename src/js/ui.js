/* ==========================================================================
   ChainVote — UI toolkit (no blockchain or API logic in here)
   ========================================================================== */
(function (w) {
  'use strict';
  var UI = {};
  var d = document;

  UI.$ = function (s, r) { return (r || d).querySelector(s); };
  UI.$$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Icons (Lucide-style, inline so there is no network dependency) ---------- */
  var P = {
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M2 2l20 20"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    home: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    cube: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    vote: '<path d="m9 12 2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5z"/><path d="M22 19H2"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    idcard: '<rect width="20" height="14" x="2" y="5" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 17c.5-1.5 1.7-2 3-2s2.5.5 3 2"/><path d="M15 10h4"/><path d="M15 14h3"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/>'
  };
  UI.icon = function (name, size) {
    size = size || 20;
    return '<svg class="ic" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[name] || '') + '</svg>';
  };
  // Replace <i data-icon="name" data-size="18"></i> with inline SVG.
  UI.hydrate = function (root) {
    UI.$$('[data-icon]', root || d).forEach(function (el) {
      el.outerHTML = UI.icon(el.getAttribute('data-icon'), +el.getAttribute('data-size') || 20);
    });
  };

  /* ---------- Formatting ---------- */
  UI.short = function (a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; };
  UI.shortHash = function (h) { return h ? h.slice(0, 10) + '…' + h.slice(-8) : ''; };
  UI.dt = function (sec) {
    if (!sec) return '—';
    return new Date(sec * 1000).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  UI.initials = function (s) {
    var p = String(s || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  UI.num = function (n) { return Number(n || 0).toLocaleString(); };
  UI.copy = function (text, label) {
    var done = function () { UI.toast('success', 'Copied', label || 'Copied to clipboard.', { timeout: 2200 }); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { UI.toast('error', 'Could not copy', 'Select the text and copy it manually.'); });
    } else {
      var t = d.createElement('textarea'); t.value = text; d.body.appendChild(t); t.select();
      try { d.execCommand('copy'); done(); } catch (e) { UI.toast('error', 'Could not copy', 'Select the text and copy it manually.'); }
      t.remove();
    }
  };

  /* ---------- Toasts ---------- */
  UI.toast = function (type, title, msg, opts) {
    opts = opts || {};
    var region = UI.$('.toasts');
    if (!region) { region = d.createElement('div'); region.className = 'toasts'; d.body.appendChild(region); }
    var el = d.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    var ico = { success: 'check', error: 'alert', info: 'info', warn: 'alert' }[type] || 'info';
    el.innerHTML = UI.icon(ico, 20) + '<div><b>' + UI.esc(title) + '</b>' + (msg ? '<p>' + UI.esc(msg) + '</p>' : '') + '</div>' +
      '<button type="button" aria-label="Dismiss notification">' + UI.icon('x', 16) + '</button>';
    region.appendChild(el);
    var close = function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 200); };
    el.querySelector('button').addEventListener('click', close);
    setTimeout(close, opts.timeout || (type === 'error' ? 8000 : 5000));
    return close;
  };

  /* ---------- Buttons ---------- */
  UI.busy = function (btn, on, label) {
    if (!btn) return;
    if (on) {
      if (btn.dataset.html == null) btn.dataset.html = btn.innerHTML;
      btn.disabled = true; btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = '<span class="spin" aria-hidden="true"></span><span>' + UI.esc(label || 'Working…') + '</span>';
    } else {
      btn.disabled = false; btn.removeAttribute('aria-busy');
      if (btn.dataset.html != null) { btn.innerHTML = btn.dataset.html; delete btn.dataset.html; }
    }
  };

  /* ---------- Form validation ---------- */
  UI.rules = {
    required: function (label) { return function (v) { return String(v).trim() ? null : label + ' is required.'; }; },
    min: function (n, label) { return function (v) { return String(v).trim().length >= n ? null : label + ' must be at least ' + n + ' characters.'; }; },
    max: function (n, label) { return function (v) { return String(v).trim().length <= n ? null : label + ' must be ' + n + ' characters or fewer.'; }; },
    pattern: function (re, msg) { return function (v) { return re.test(String(v)) ? null : msg; }; },
    match: function (other, msg) { return function (v, form) { return v === form.elements[other].value ? null : msg; }; }
  };
  function fieldOf(input) { return input.closest('.field'); }
  function setError(input, msg) {
    var f = fieldOf(input); if (!f) return;
    var e = f.querySelector('.err');
    if (!e) { e = d.createElement('div'); e.className = 'err'; e.id = input.name + '-err'; f.appendChild(e); }
    if (msg) {
      e.innerHTML = UI.icon('alert', 16) + '<span>' + UI.esc(msg) + '</span>';
      f.classList.add('has-error'); input.setAttribute('aria-invalid', 'true');
      var ids = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean);
      if (ids.indexOf(e.id) < 0) ids.push(e.id);
      input.setAttribute('aria-describedby', ids.join(' '));
    } else {
      f.classList.remove('has-error'); input.removeAttribute('aria-invalid');
    }
  }
  UI.setFieldError = function (form, name, msg) { setError(form.elements[name], msg); };
  function check(form, rules, name) {
    var input = form.elements[name], list = rules[name] || [], msg = null;
    for (var i = 0; i < list.length && !msg; i++) msg = list[i](input.value, form);
    setError(input, msg); return msg;
  }
  UI.form = function (form, rules, onValid) {
    form.setAttribute('novalidate', '');
    var touched = {};
    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name]; if (!input) return;
      input.addEventListener('blur', function () { touched[name] = true; check(form, rules, name); });
      input.addEventListener('input', function () {
        if (touched[name]) check(form, rules, name);
        // keep dependent "match" fields honest
        Object.keys(rules).forEach(function (o) { if (o !== name && touched[o] && /confirm/i.test(o)) check(form, rules, o); });
      });
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var first = null;
      Object.keys(rules).forEach(function (name) { touched[name] = true; if (check(form, rules, name) && !first) first = form.elements[name]; });
      if (first) { first.focus(); return; }
      var vals = {}; Object.keys(rules).forEach(function (n) { vals[n] = form.elements[n].value.trim ? form.elements[n].value : form.elements[n].value; });
      onValid(vals, ev);
    });
    return { reset: function () { form.reset(); touched = {}; Object.keys(rules).forEach(function (n) { if (form.elements[n]) setError(form.elements[n], null); }); } };
  };
  UI.passwordToggles = function (root) {
    UI.$$('.reveal', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.parentElement.querySelector('input'); var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = UI.icon(show ? 'eye-off' : 'eye', 20);
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.setAttribute('aria-pressed', String(show));
      });
    });
  };
  UI.strength = function (pw) {
    var s = 0;
    if (pw.length >= 6) s++;
    if (pw.length >= 10) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return pw ? Math.max(1, s) : 0;
  };

  /* ---------- Dialogs ---------- */
  UI.dialog = function (html, label) {
    var dlg = d.createElement('dialog'); dlg.className = 'dlg';
    if (label) dlg.setAttribute('aria-label', label);
    dlg.innerHTML = '<div class="dlg-in">' + html + '</div>';
    d.body.appendChild(dlg); UI.hydrate(dlg);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { setTimeout(function () { dlg.remove(); }, 0); });
    UI.$$('[data-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
    dlg.showModal();
    return dlg;
  };
  UI.confirm = function (o) {
    return new Promise(function (resolve) {
      var id = 'ph' + Math.random().toString(36).slice(2, 7);
      var dlg = UI.dialog(
        '<h2>' + UI.esc(o.title) + '</h2><div>' + (o.body || '') + '</div>' +
        (o.phrase ? '<div class="field" style="margin:0"><label for="' + id + '">Type <b>' + UI.esc(o.phrase) + '</b> to continue</label><input class="input" id="' + id + '" autocomplete="off" spellcheck="false"></div>' : '') +
        '<div class="dlg-actions"><button type="button" class="btn btn-secondary" data-close>Cancel</button>' +
        '<button type="button" class="btn ' + (o.danger ? 'btn-danger' : '') + '" data-ok' + (o.phrase ? ' disabled' : '') + '>' + UI.esc(o.confirmLabel || 'Confirm') + '</button></div>', o.title);
      var ok = UI.$('[data-ok]', dlg), done = false;
      if (o.phrase) UI.$('input', dlg).addEventListener('input', function (e) { ok.disabled = e.target.value.trim() !== o.phrase; });
      ok.addEventListener('click', function () { done = true; dlg.close(); });
      dlg.addEventListener('close', function () { resolve(done); });
    });
  };

  /* ---------- Countdown ---------- */
  UI.countdown = function (root, target, nowFn, onDone) {
    var parts = { d: UI.$('[data-u="d"]', root), h: UI.$('[data-u="h"]', root), m: UI.$('[data-u="m"]', root), s: UI.$('[data-u="s"]', root) };
    var fired = false;
    function tick() {
      var left = Math.max(0, target - nowFn());
      parts.d.textContent = String(Math.floor(left / 86400));
      parts.h.textContent = String(Math.floor(left % 86400 / 3600)).padStart(2, '0');
      parts.m.textContent = String(Math.floor(left % 3600 / 60)).padStart(2, '0');
      parts.s.textContent = String(Math.floor(left % 60)).padStart(2, '0');
      if (left <= 0 && !fired) { fired = true; clearInterval(t); if (onDone) onDone(); }
    }
    tick(); var t = setInterval(tick, 500);
    return function () { clearInterval(t); };
  };

  /* ---------- Transaction tracker ---------- */
  var activeTx = null;
  UI.closeTx = function () { if (activeTx) { activeTx.remove(); activeTx = null; } };
  UI.trackTx = function (o) {
    if (activeTx) activeTx.remove();
    var el = d.createElement('div'); el.className = 'txp'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="txp-head"><div><h3>' + UI.esc(o.title) + '</h3><p class="muted" style="font-size:.87rem">' + UI.esc(o.subtitle || '') + '</p></div>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Close transaction status" data-x>' + UI.icon('x', 18) + '</button></div>' +
      '<ol class="txp-steps">' +
      '<li data-s="wallet"><span class="mk">' + UI.icon('check', 14) + '</span><span>Confirm in MetaMask</span></li>' +
      '<li data-s="pending"><span class="mk">' + UI.icon('check', 14) + '</span><span>Submitted, waiting for confirmation</span></li>' +
      '<li data-s="mined"><span class="mk">' + UI.icon('check', 14) + '</span><span>Confirmed on Ethereum Sepolia</span></li></ol>' +
      '<div class="txp-hash" hidden>' + UI.icon('link', 16) + '<span class="mono"></span><button type="button" class="btn btn-ghost btn-icon btn-sm" aria-label="Copy transaction hash" data-copy>' + UI.icon('copy', 16) + '</button></div>' +
      '<p class="txp-msg" hidden></p>';
    d.body.appendChild(el); activeTx = el;
    var set = function (name, cls) { var li = UI.$('[data-s="' + name + '"]', el); li.className = cls || ''; };
    var msg = UI.$('.txp-msg', el), hashBox = UI.$('.txp-hash', el), hash = null;
    function showHash(h) { hashBox.hidden = false; var a = UI.$('.mono', hashBox); a.textContent = h; a.href = w.Chain.txUrl(h); }
    UI.$('[data-x]', el).addEventListener('click', function () { el.remove(); });
    UI.$('[data-copy]', el).addEventListener('click', function () { UI.copy(hash, 'Transaction hash copied.'); });
    set('wallet', 'active');
    var hooks = {
      onHash: function (h) {
        hash = h; hashBox.hidden = false; showHash(h);
        set('wallet', 'done'); set('pending', 'active');
      }
    };
    return Promise.resolve().then(function () { return o.run(hooks); }).then(function (receipt) {
      set('wallet', 'done'); set('pending', 'done'); set('mined', 'done');
      if (receipt && receipt.hash && !hash) { hash = receipt.hash; showHash(hash); }
      msg.hidden = false; msg.innerHTML = '<b>Confirmed</b>' + (receipt && receipt.block ? ' in block ' + UI.esc(receipt.block) : '') + '.';
      setTimeout(function () { if (activeTx === el) { el.remove(); activeTx = null; } }, 7000);
      return { ok: true, receipt: receipt };
    }, function (err) {
      var cur = UI.$('.active', el) || UI.$('[data-s="wallet"]', el);
      cur.className = 'fail'; el.classList.add('is-error');
      msg.hidden = false; msg.className = 'txp-msg alert alert-err';
      msg.innerHTML = UI.icon('alert', 18) + '<div><strong>Transaction not completed</strong>' + UI.esc(err.friendly || err.message) + '</div>';
      return { ok: false, error: err };
    });
  };

  /* ---------- Wallet chip & popover (state comes from Chain.status(); nothing is assumed) ---------- */
  UI.wallet = {
    mount: function (slot, chain, cfg) {
      slot.innerHTML = '<div class="wallet-wrap"><button type="button" class="chip wallet" aria-haspopup="dialog" aria-expanded="false"></button><div class="pop" hidden role="dialog" aria-label="Wallet details"></div></div>';
      var btn = UI.$('.chip', slot), pop = UI.$('.pop', slot), connecting = false;
      var A = function (href, text) { return '<a href="' + UI.esc(href) + '" target="_blank" rel="noopener">' + UI.esc(text) + '</a>'; };

      function label(s) {
        if (connecting) return ['is-connecting', 'wallet', 'Connecting…'];
        switch (s.state) {
          case 'missing': return ['is-missing', 'wallet', 'Install MetaMask'];
          case 'disconnected': return ['is-disconnected', 'wallet', 'Connect wallet'];
          case 'wrong-network': return ['is-wrong-network', 'alert', 'Wrong network'];
          case 'unconfigured': return ['is-error', 'alert', 'Contract not set up'];
          case 'error': return ['is-error', 'alert', 'Blockchain issue'];
          case 'loading': return ['is-connecting', 'wallet', 'Checking…'];
          default: return ['is-connected', 'wallet', UI.short(s.account)];
        }
      }
      function render(s) {
        var l = label(s);
        btn.className = 'chip wallet ' + l[0];
        btn.innerHTML = '<span class="dot" aria-hidden="true"></span>' + UI.icon(l[1], 18) + '<span class="wl-text">' + (l[2] === 'Connect wallet' ? 'Connect<span class="long"> wallet</span>' : UI.esc(l[2])) + '</span>';
        btn.setAttribute('aria-label', 'Wallet: ' + ({ connected: 'connected, ' + s.account, disconnected: 'not connected. Activate to connect', missing: 'MetaMask not detected', 'wrong-network': 'wrong network. Activate for details', unconfigured: 'contract not configured', error: 'blockchain problem. Activate for details', loading: 'checking' }[s.state] || ''));
        if (!pop.hidden) renderPop(s);
      }
      function renderPop(s) {
        var h = '';
        if (s.state === 'connected') {
          h = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>MetaMask connected</b><span class="badge badge-ok plain">' + UI.esc(s.networkName) + '</span></div>' +
            '<div class="addr">' + UI.esc(s.account) + '</div>' +
            '<dl class="kv"><dt>Network</dt><dd>' + UI.esc(s.networkName) + ' <span class="muted">(chain ' + UI.esc(s.chainId) + ')</span></dd>' +
            '<dt>Contract</dt><dd class="mono">' + A(chain.addressUrl(s.contract), UI.short(s.contract)) + '</dd>' +
            '<dt>Owner</dt><dd class="mono">' + (s.owner ? A(chain.addressUrl(s.owner), UI.short(s.owner)) : '—') + '</dd>' +
            '<dt>This wallet</dt><dd>' + (s.isOwner ? 'Contract owner (admin)' : 'Voter') + '</dd></dl>' +
            '<div class="pop-actions"><button type="button" class="btn btn-secondary btn-sm" data-a="copy">' + UI.icon('copy', 16) + 'Copy address</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-a="switch">' + UI.icon('refresh', 16) + 'Switch account</button></div>' +
            '<p class="hint">Your vote is tied to this address. Changing account changes who is voting.</p>';
        } else if (s.state === 'wrong-network') {
          h = '<b>Please switch to ' + UI.esc(cfg.CHAIN.name) + '</b><p class="muted" style="font-size:.9rem">Your wallet is on ' + UI.esc(s.networkName) + '. ChainVote runs on ' + UI.esc(cfg.CHAIN.name) + ' (chain ' + cfg.CHAIN.id + ').</p>' +
            '<div class="pop-actions"><button type="button" class="btn btn-sm" data-a="network">Switch network</button></div>';
        } else if (s.state === 'error' || s.state === 'unconfigured') {
          h = '<b>' + (s.state === 'unconfigured' ? 'Contract not configured' : 'Blockchain unavailable') + '</b><p class="muted" style="font-size:.9rem">' + UI.esc(s.detail) + '</p><div class="pop-actions"><button type="button" class="btn btn-secondary btn-sm" data-a="retry">Try again</button></div>';
        }
        pop.innerHTML = h;
      }
      function close() { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }

      btn.addEventListener('click', function () {
        var s = chain.status();
        if (s.state === 'missing') { w.open('https://metamask.io/download/', '_blank', 'noopener'); return; }
        if (s.state === 'disconnected' && !connecting) {
          connecting = true; render(s);
          chain.connect().then(function () { UI.toast('success', 'Wallet connected', UI.short(chain.status().account)); })
            .catch(function (e) { UI.toast('error', 'Wallet not connected', e.friendly || e.message); })
            .then(function () { connecting = false; render(chain.status()); });
          return;
        }
        if (s.state === 'loading') return;
        pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden));
        if (!pop.hidden) renderPop(s);
      });
      pop.addEventListener('click', function (e) {
        var a = e.target.closest('[data-a]'); if (!a) return; var act = a.dataset.a, s = chain.status();
        if (act === 'copy') UI.copy(s.account, 'Wallet address copied.');
        if (act === 'switch') chain.switchAccount().catch(function (er) { UI.toast('error', 'Could not switch account', er.friendly || er.message); });
        if (act === 'network') chain.switchNetwork().catch(function (er) { UI.toast('error', 'Could not switch network', er.friendly || er.message); });
        if (act === 'retry') chain.refresh();
      });
      d.addEventListener('click', function (e) { if (!slot.contains(e.target)) close(); });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) { close(); btn.focus(); } });
      chain.subscribe(render); render(chain.status());
    }
  };

  /* ---------- Blockchain status list: every line reflects a real runtime check ---------- */
  // items: [{ ok: bool, on: 'text when true', off: 'text when false', hint?: 'why' }]
  UI.statusList = function (items) {
    return '<ul class="bstatus" aria-label="Blockchain status">' + items.map(function (i) {
      return '<li class="' + (i.ok ? 'ok' : 'off') + '"><span class="bs-dot" aria-hidden="true">' + UI.icon(i.ok ? 'check' : 'x', 12) + '</span><span><b>' + UI.esc(i.ok ? i.on : i.off) + '</b>' +
        (i.hint && !i.ok ? '<span class="muted"> · ' + UI.esc(i.hint) + '</span>' : '') + '</span></li>';
    }).join('') + '</ul>';
  };

  w.UI = UI;
})(window);
