/* ==========================================================================
   ChainVote — app shell (voter + admin pages)
   Hash routing, wallet chip, account dialog.
   ========================================================================== */
(function (w) {
  'use strict';
  var CFG = w.EVOTE_CONFIG, $ = UI.$, $$ = UI.$$;

  function accountDialog(session) {
    var dlg = UI.dialog(
      '<div class="cell-person"><span class="avatar" style="width:48px;height:48px;font-size:1rem">' + UI.esc(UI.initials(session.voterId)) + '</span>' +
      '<div><h2 style="font-size:1.25rem">' + UI.esc(session.voterId || 'Signed in') + '</h2><span class="badge badge-mute plain">' + (session.role === 'admin' ? 'Administrator' : 'Voter') + '</span></div></div>' +
      '<form id="pw-form" novalidate><h3 style="margin-bottom:12px">Change password</h3>' +
      '<div class="field"><label for="pw-old">Current password</label><div class="input-wrap"><input class="input" id="pw-old" name="old" type="password" autocomplete="current-password"></div></div>' +
      '<div class="field"><label for="pw-new">New password</label><div class="input-wrap"><input class="input" id="pw-new" name="next" type="password" autocomplete="new-password" aria-describedby="pw-new-hint"></div><span class="hint" id="pw-new-hint">At least 6 characters.</span></div>' +
      '<div class="field"><label for="pw-conf">Confirm new password</label><div class="input-wrap"><input class="input" id="pw-conf" name="confirm" type="password" autocomplete="new-password"></div></div>' +
      '<div class="dlg-actions"><button type="button" class="btn btn-secondary" data-close>Close</button><button type="submit" class="btn">Update password</button></div></form>' +
      '<hr style="border:0;border-top:1px solid var(--line);width:100%;margin:0"><button type="button" class="btn btn-danger-quiet" id="pw-out"><i data-icon="logout" data-size="18"></i>Sign out</button>',
      'Account');
    var form = $('#pw-form', dlg);
    UI.form(form, {
      old: [UI.rules.required('Current password')],
      next: [UI.rules.required('New password'), UI.rules.min(6, 'New password')],
      confirm: [UI.rules.required('Confirmation'), UI.rules.match('next', 'Passwords don’t match.')]
    }, function (v) {
      var btn = $('button[type=submit]', form); UI.busy(btn, true, 'Updating…');
      Auth.changePassword(session.voterId, v.old, v.next).then(function () {
        UI.toast('success', 'Password updated', 'Use your new password next time you sign in.'); dlg.close();
      }, function (e) { UI.busy(btn, false); UI.setFieldError(form, 'old', e.friendly); form.elements.old.focus(); });
    });
    $('#pw-out', dlg).addEventListener('click', Auth.logout);
  }


  /* Wallet / network status banner shared by voter + admin pages */
  function chainAlert(el, connectHint) {
    function render(s) {
      var h = '', esc = UI.esc;
      if (s.state === 'unconfigured') h = '<div class="alert alert-err">' + UI.icon('alert', 20) + '<div><strong>Smart contract not configured</strong>' + esc(s.detail) + '</div></div>';
      else if (s.state === 'error') h = '<div class="alert alert-err">' + UI.icon('alert', 20) + '<div><strong>' + esc(/connection unavailable/i.test(s.detail) ? 'Ethereum Sepolia connection unavailable.' : 'Blockchain problem') + '</strong>' + esc(/connection unavailable/i.test(s.detail) ? 'Unable to retrieve blockchain data. Check your internet connection.' : s.detail) + '</div><button type="button" class="btn btn-secondary btn-sm" style="margin-left:auto" data-act="retry">Try again</button></div>';
      else if (s.state === 'missing') h = '<div class="alert alert-warn">' + UI.icon('wallet', 20) + '<div><strong>MetaMask is not installed.</strong>You can read results, but a wallet is required to send transactions. <a href="https://metamask.io/download/" target="_blank" rel="noopener">Install MetaMask</a>, then reload this page.</div></div>';
      else if (s.state === 'wrong-network') h = '<div class="alert alert-warn">' + UI.icon('alert', 20) + '<div><strong>Please switch your MetaMask network to Ethereum Sepolia.</strong>Your wallet is on ' + esc(s.networkName) + '.</div><button type="button" class="btn btn-sm" style="margin-left:auto" data-act="net">Switch network</button></div>';
      else if (s.state === 'disconnected') h = '<div class="alert alert-info">' + UI.icon('wallet', 20) + '<div><strong>Please connect your wallet.</strong>' + esc(connectHint) + '</div><button type="button" class="btn btn-sm" style="margin-left:auto" data-act="connect">Connect wallet</button></div>';
      el.innerHTML = h; el.hidden = !h;
    }
    el.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'connect') { UI.busy(a, true, 'Connecting…'); Chain.connect().catch(function (er) { UI.toast('error', 'Wallet not connected', er.friendly); }).then(function () { UI.busy(a, false); }); }
      if (a.dataset.act === 'net') Chain.switchNetwork().catch(function (er) { UI.toast('error', 'Could not switch network', er.friendly); });
      if (a.dataset.act === 'retry') Chain.refresh();
    });
    Chain.subscribe(render); render(Chain.status());
  }

  w.Shell = {
    chainAlert: chainAlert,
    init: function (o) {
      var session = o.public ? (Auth.session() || { voterId: '', role: '' }) : Auth.guard(o.role);
      if (!session) return null;                       // guard is redirecting to the login page
      if (!o.public) {
        // Ask the server who this token belongs to; the browser's stored role is not trusted.
        Auth.me().then(function (u) {
          var role = String(u.role || 'user').toLowerCase();
          if (o.role && role !== o.role) { Auth.save({ token: session.token, role: role, voterId: u.voter_id }); location.replace(Auth.home(role)); }
        }, function () { /* a 401 already cleared the session and redirected */ });
      }
      UI.hydrate();

      UI.wallet.mount($('#wallet-slot'), Chain, CFG);
      Chain.init();

      var chip = $('#user-chip');
      if (chip) {
        $('.avatar', chip).textContent = UI.initials(session.voterId || o.role);
        $('.who', chip).textContent = session.voterId || (o.role === 'admin' ? 'Admin' : 'Voter');
        chip.addEventListener('click', function () { accountDialog(session); });
      }
      var out = $('#btn-logout'); if (out) out.addEventListener('click', Auth.logout);
      if (o.public && !session.token) { var uc = $('#user-chip'); if (uc) uc.hidden = true; }

      var views = o.views, def = o.default, current = null;
      function route() {
        var id = (location.hash || '').replace('#', '');
        if (!views[id]) id = def;
        $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + id; });
        $$('.nav a').forEach(function (a) { if (a.dataset.view === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        var h = $('#page-title'); h.textContent = views[id]; document.title = views[id] + ' · ' + CFG.APP_NAME;
        if (current !== null) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); w.scrollTo(0, 0); }
        current = id; if (o.onEnter) o.onEnter(id);
      }
      w.addEventListener('hashchange', route); route();
      return { session: session, go: function (id) { location.hash = '#' + id; } };
    }
  };
})(window);
