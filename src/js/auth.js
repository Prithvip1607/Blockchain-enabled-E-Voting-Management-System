/* ==========================================================================
   ChainVote — application authentication (FastAPI + MySQL + JWT)

   This is APPLICATION login only. It does not authorise anything on the blockchain:
   voting and administration are enforced by the smart contract and the wallet that
   signs the transaction.
   ========================================================================== */
(function (w) {
  'use strict';
  var CFG = w.EVOTE_CONFIG, F = CFG.FIELDS, E = CFG.ENDPOINTS;

  function ApiError(message, status) { var e = new Error(message); e.friendly = message; e.status = status; return e; }

  var Auth = {
    session: function () {
      var token = localStorage.getItem('token');
      if (!token) return null;
      return { token: token, role: localStorage.getItem('role') || 'user', voterId: localStorage.getItem('voterId') || '' };
    },
    save: function (s) {
      localStorage.setItem('token', s.token || '');
      localStorage.setItem('role', s.role || 'user');
      localStorage.setItem('voterId', s.voterId || '');
    },
    clear: function () { ['token', 'role', 'voterId'].forEach(function (k) { localStorage.removeItem(k); }); },
    logout: function () { Auth.clear(); location.href = CFG.ROUTES.login; },
    home: function (role) { return role === 'admin' ? CFG.ROUTES.admin : CFG.ROUTES.voter; },
    // Redirects when there is no session or the role doesn't match. This is a convenience only;
    // the API enforces access on the server and the contract enforces it on-chain.
    guard: function (role) {
      var s = Auth.session();
      if (!s) { location.replace(CFG.ROUTES.login); return null; }
      if (role && s.role !== role) { location.replace(Auth.home(s.role)); return null; }
      return s;
    }
  };

  async function http(path, opts) {
    opts = opts || {};
    var s = Auth.session(), headers = { 'Content-Type': 'application/json' };
    if (s && s.token) headers.Authorization = 'Bearer ' + s.token;
    var res;
    try {
      res = await fetch(CFG.API_BASE + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    } catch (e) { throw ApiError('Can’t reach the server. Check your connection and that the backend is running.', 0); }
    var data = null; try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var detail = data && data.detail;
      if (Array.isArray(detail)) detail = detail.map(function (d) { return d.msg; }).join(' ');
      if (res.status === 401 && s && !opts.noRedirect) { Auth.clear(); location.href = CFG.ROUTES.login; }
      throw ApiError(typeof detail === 'string' && detail ? detail : 'Something went wrong (' + res.status + ').', res.status);
    }
    return data;
  }
  function body(o) { var b = {}; Object.keys(o).forEach(function (k) { b[F[k]] = o[k]; }); return b; }

  Auth.login = async function (id, pw) {
    var data = await http(E.login, { method: 'POST', body: body({ id: id, password: pw }), noRedirect: true });
    var s = CFG.parseLogin(data, id);
    if (!s.token) throw ApiError('The server did not return a session token.', 500);
    Auth.save(s); return s;
  };
  Auth.signup = function (id, pw) { return http(E.signup, { method: 'POST', body: body({ id: id, password: pw }), noRedirect: true }); };
  Auth.me = function () { return http(E.me); };
  Auth.listVoters = async function () { var d = await http(E.voters); return (Array.isArray(d) ? d : []).map(CFG.parseVoter); };
  Auth.deleteVoter = function (id) { return http(E.deleteVoter(id), { method: 'DELETE' }); };
  Auth.changePassword = function (id, oldPw, newPw) { return http(E.changePassword, { method: 'POST', body: body({ oldPassword: oldPw, newPassword: newPw }) }); };

  w.Auth = Auth;
})(window);
