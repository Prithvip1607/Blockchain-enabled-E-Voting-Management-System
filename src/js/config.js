/* ==========================================================================
   ChainVote — frontend configuration (contains NO secrets)

   Contract address + ABI are NOT set here. They come from /deployment.json, which is
   generated from the Truffle artifact by `npm run export:frontend` after deployment.
   That keeps a single source of truth for the address and guarantees the ABI matches
   the deployed contract.
   ========================================================================== */
(function (w) {
  'use strict';
  w.EVOTE_CONFIG = {
    APP_NAME: 'ChainVote',

    /* ----- Application backend (FastAPI + MySQL). Same origin as this page. ----- */
    API_BASE: '/api',
    ENDPOINTS: {
      login: '/login',
      signup: '/signup',
      me: '/me',
      voters: '/voters',
      deleteVoter: function (id) { return '/voters/' + encodeURIComponent(id); },
      changePassword: '/change-password'
    },
    FIELDS: { id: 'voter_id', password: 'password', oldPassword: 'old_password', newPassword: 'new_password' },
    parseLogin: function (data, submittedId) {
      return { token: data.token, role: String(data.role || 'user').toLowerCase(), voterId: data.voter_id || submittedId };
    },
    parseVoter: function (v) { return { id: v.voter_id, role: String(v.role || 'user').toLowerCase(), created: v.created_at }; },

    ROUTES: { login: '/html/login.html', signup: '/html/signup.html', voter: '/html/voter.html', admin: '/html/admin.html', results: '/html/results.html' },

    /* ----- Blockchain: Ethereum Sepolia ----- */
    CHAIN: {
      id: 11155111,
      hex: '0xaa36a7',
      name: 'Ethereum Sepolia',
      currency: 'ETH',
      explorer: 'https://sepolia.etherscan.io',
      // Public, key-less RPC used ONLY for read-only calls (results, election state) when the
      // wallet is unavailable or on another network. Transactions are always signed in MetaMask.
      // Do not put an RPC URL that contains an API key here: it would be visible to every visitor.
      readRpc: 'https://ethereum-sepolia-rpc.publicnode.com'
    },
    DEPLOYMENT_URL: '/deployment.json',
    POLL_MS: 15000
  };
})(window);
