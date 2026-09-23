/* ChainVote — sign in page (application login only; wallet authorization is separate) */
(function () {
  'use strict';
  var CFG = EVOTE_CONFIG, $ = UI.$;
  UI.hydrate(); UI.passwordToggles(document);

  var s = Auth.session();
  if (s) { location.replace(Auth.home(s.role)); return; }

  var form = $('#login-form'), alertBox = $('#form-alert');
  function showAlert(msg) { alertBox.innerHTML = UI.icon('alert', 18) + '<div>' + UI.esc(msg) + '</div>'; alertBox.hidden = false; }

  UI.form(form, {
    voterId: [UI.rules.required('Voter ID')],
    password: [UI.rules.required('Password')]
  }, function (v) {
    alertBox.hidden = true;
    var btn = $('#submit'); UI.busy(btn, true, 'Signing in…');
    Auth.login(v.voterId.trim(), v.password).then(function (sess) {
      UI.toast('success', 'Signed in', 'Redirecting…', { timeout: 1500 });
      setTimeout(function () { location.href = Auth.home(sess.role); }, 300);
    }, function (e) {
      UI.busy(btn, false); showAlert(e.friendly || e.message); form.elements.password.select();
    });
  });
})();
