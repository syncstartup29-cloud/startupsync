// session-guard.js v9 — FINAL PRODUCTION (multi-tab allowed)
(function () {
  'use strict';

  // ── Skip if logout in progress ──
  try {
    if (sessionStorage.getItem('_ss_loggingOut') === '1' || localStorage.getItem('_ss_loggingOut') === '1') return;
  } catch (e) {}

  // ── On back-forward cache restore, verify token ──
  window.addEventListener('pageshow', function (ev) {
    if (ev.persisted) {
      var t = '';
      try { t = sessionStorage.getItem('token') || ''; } catch (e) {}
      try { if (!t) t = localStorage.getItem('token') || ''; } catch (e) {}
      if (!t) window.location.replace('index.html');
    }
  });

  var token = '', userId = '';
  try { token = sessionStorage.getItem('token') || ''; } catch (e) {}
  try { if (!token) token = localStorage.getItem('token') || ''; } catch (e) {}
  try {
    var raw = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser') || '';
    var cu = JSON.parse(raw || 'null');
    if (cu && cu._id) userId = cu._id.toString();
  } catch (e) {}
  if (!token || !userId) return;

  var done = false;

  function _isLoggingOut() {
    try {
      return sessionStorage.getItem('_ss_loggingOut') === '1' || localStorage.getItem('_ss_loggingOut') === '1';
    } catch (e) { return false; }
  }

  function stillLoggedIn() {
    var t = '';
    try { t = sessionStorage.getItem('token') || ''; } catch (e) {}
    try { if (!t) t = localStorage.getItem('token') || ''; } catch (e) {}
    if (!t) return false;
    var f = '';
    try {
      var r = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser') || '';
      if (r) { var c = JSON.parse(r); if (c && c._id) f = c._id.toString(); }
    } catch (e) {}
    return !!(f && f === userId);
  }

  function showKicked() {
    if (done) return;
    if (_isLoggingOut()) return;
    done = true;
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    var ov = document.createElement('div');
    ov.style.cssText = "position:fixed;inset:0;background:#fff;display:flex;align-items:center;justify-content:center;z-index:2147483647;font-family:'Sora',sans-serif;padding:1.5rem;box-sizing:border-box;";
    ov.innerHTML = '<div style="text-align:center;max-width:340px;width:100%;"><div style="font-size:0.62rem;font-weight:600;letter-spacing:0.16em;color:#aaa;text-transform:uppercase;margin-bottom:2rem;">StartupSync\u2122</div><div style="width:72px;height:72px;margin:0 auto 1.5rem;border-radius:50%;background:#f4f4f5;border:1.5px solid #e4e4e7;display:flex;align-items:center;justify-content:center;"><svg width="28" height="28" fill="none" stroke="#DC2626" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg></div><div style="font-size:1.1rem;font-weight:700;color:#111118;margin-bottom:0.5rem;line-height:1.4;">You\'ve been logged in<br>on another device</div><div style="font-size:0.76rem;color:#6B7280;line-height:1.75;margin-bottom:2rem;">Redirecting to login\u2026</div></div>';
    document.body.appendChild(ov);
    setTimeout(function () { window.location.replace('index.html'); }, 2800);
  }

  // ── Session check (once, 5s after load) ──
  var _sessionChecked = false;
  setTimeout(function () {
    if (_sessionChecked) return;
    _sessionChecked = true;
    if (!stillLoggedIn()) return;
    if (_isLoggingOut()) return;
    var t = '';
    try { t = sessionStorage.getItem('token') || localStorage.getItem('token') || ''; } catch (e) {}
    if (!t) return;
    fetch('/session/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.deleted === true) {
        try { localStorage.clear(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}
        if (window._ssTriggerSuspension) window._ssTriggerSuspension();
        else window.location.replace('index.html');
      }
    }).catch(function () {});
  }, 5000);

  // ── Socket (reuse existing if available) ──
  try {
    // FIX: pass token in socket auth so server middleware can verify JWT
    var socket = window._ssSocket || window.io({ auth: { userId: userId, token: token }, transports: ['websocket', 'polling'] });
    window._ssSocket = socket;

    socket.on('auth:forceLogout', function (payload) {
      if (_isLoggingOut()) return;
      if (!stillLoggedIn()) return;
      var myTok = '';
      try { myTok = sessionStorage.getItem('token') || localStorage.getItem('token') || ''; } catch (e) {}
      if (payload && payload.newToken && myTok && payload.newToken === myTok) return;
      if (payload && (payload.reason === 'logout' || payload.reason === 'newLogin')) return;
      if (payload && payload.reason === 'Your account has been deleted.') {
        try { localStorage.clear(); } catch (e) {}
        try { sessionStorage.clear(); } catch (e) {}
        window.location.replace('index.html');
        return;
      }
      showKicked();
    });
  } catch (e) {}

})();