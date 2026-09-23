/* ChainVote — sign up page (registers, then signs the new voter in) */
(function () {
  'use strict';
  var CFG = EVOTE_CONFIG, $ = UI.$;
  UI.hydrate(); UI.passwordToggles(document);

  var form = $('#signup-form'), alertBox = $('#form-alert');
  var labels = ['Longer passwords with mixed characters are stronger.', 'Weak', 'Fair', 'Good', 'Strong'];
  form.elements.password.addEventListener('input', function (e) {
    var lvl = UI.strength(e.target.value); $('#pw-meter').dataset.level = lvl; $('#pw-label').textContent = labels[lvl];
  });
  function showAlert(msg) { alertBox.innerHTML = UI.icon('alert', 18) + '<div>' + UI.esc(msg) + '</div>'; alertBox.hidden = false; }

  UI.form(form, {
    voterId: [UI.rules.required('Voter ID'), UI.rules.pattern(/^\S{3,32}$/, 'Voter ID must be 3–32 characters with no spaces.')],
    password: [UI.rules.required('Password'), UI.rules.min(6, 'Password')],
    confirm: [UI.rules.required('Confirmation'), UI.rules.match('password', 'Passwords don’t match.')]
  }, function (v) {
    alertBox.hidden = true;
    var btn = $('#submit'); UI.busy(btn, true, 'Creating account…');
    var id = v.voterId.trim();
    Auth.signup(id, v.password).then(function () {
      UI.busy(btn, true, 'Signing you in…');
      return Auth.login(id, v.password);
    }).then(function (sess) {
      UI.toast('success', 'Account created', 'Welcome, ' + id + '.', { timeout: 1800 });
      setTimeout(function () { location.href = Auth.home(sess.role); }, 500);
    }, function (e) {
      UI.busy(btn, false);
      if (e.status === 409 || /exist|already/i.test(e.friendly || '')) UI.setFieldError(form, 'voterId', 'That voter ID is already registered.'), form.elements.voterId.focus();
      else showAlert(e.friendly || e.message);
    });
  });
})();
