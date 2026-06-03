// ═══════════════════════════════════════════════════════════════════════════
//  custom-ui.js — StartupSync Shared UI Utilities
//  Include on every protected page AFTER socket.io.js and session-guard.js
//  Provides: custom black/white alerts, notification badges, mobile fixes
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── 1. CUSTOM BLACK & WHITE ALERT SYSTEM ──────────────────────────────────
  // Replaces native alert(), confirm(), prompt() with styled B&W modals

  // Inject styles once
  if (!document.getElementById("_ssCustomAlertStyle")) {
    var css = document.createElement("style");
    css.id = "_ssCustomAlertStyle";
    css.textContent = `
      @keyframes _ssAlertIn{from{opacity:0;transform:translateY(-12px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes _ssAlertOut{from{opacity:1}to{opacity:0;transform:scale(0.97)}}
      ._ss-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;backdrop-filter:blur(4px);}
      ._ss-modal{background:#fff;border-radius:14px;padding:2rem 1.75rem;width:min(380px,92vw);box-shadow:0 32px 80px rgba(0,0,0,0.25);animation:_ssAlertIn 0.28s cubic-bezier(0.4,0,0.2,1) both;font-family:'Sora','Inter',sans-serif;}
      ._ss-modal-icon{width:44px;height:44px;border-radius:50%;background:#111118;display:flex;align-items:center;justify-content:center;margin-bottom:1rem;flex-shrink:0;}
      ._ss-modal-title{font-size:0.95rem;font-weight:700;color:#111118;margin-bottom:0.5rem;line-height:1.4;}
      ._ss-modal-msg{font-size:0.8rem;color:#555;line-height:1.7;margin-bottom:1.5rem;font-family:'Inter',sans-serif;}
      ._ss-modal-input{width:100%;padding:0.72rem 0.9rem;border:1.5px solid #e4e4e7;border-radius:8px;font-size:0.88rem;font-family:'Inter',sans-serif;color:#111118;margin-bottom:1.25rem;box-sizing:border-box;outline:none;}
      ._ss-modal-input:focus{border-color:#111118;box-shadow:0 0 0 3px rgba(17,17,24,0.08);}
      ._ss-btn-row{display:flex;gap:0.6rem;flex-direction:column;}
      ._ss-btn{width:100%;padding:0.78rem 1rem;border-radius:8px;border:none;font-family:'Sora',sans-serif;font-size:0.78rem;font-weight:600;cursor:pointer;letter-spacing:0.02em;transition:all 0.18s;}
      ._ss-btn-primary{background:#111118;color:#fff;}
      ._ss-btn-primary:hover{background:#2d2d35;}
      ._ss-btn-secondary{background:#f4f4f5;color:#111118;border:1.5px solid #e4e4e7;}
      ._ss-btn-secondary:hover{background:#e4e4e7;}
      ._ss-toast-container{position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;flex-direction:column;align-items:center;gap:0.5rem;pointer-events:none;}
      @keyframes _ssToastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @keyframes _ssToastOut{from{opacity:1}to{opacity:0;transform:translateY(6px)}}
      ._ss-toast{background:#ffffff;color:#111118;border:1.5px solid #E4E4E7;font-family:'Sora',sans-serif;font-size:0.76rem;font-weight:500;padding:0.72rem 1.2rem;border-radius:10px;white-space:nowrap;animation:_ssToastIn 0.25s ease both;box-shadow:0 8px 32px rgba(0,0,0,0.12);pointer-events:auto;}
    `;
    document.head.appendChild(css);
  }

  function _createOverlay() {
    var ov = document.createElement("div");
    ov.className = "_ss-overlay";
    document.body.appendChild(ov);
    return ov;
  }

  function _removeOverlay(ov, cb) {
    if (!ov) return;
    var modal = ov.querySelector("._ss-modal");
    if (modal) modal.style.animation = "_ssAlertOut 0.2s ease forwards";
    setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); if (cb) cb(); }, 220);
  }

  // Detect icon type from message
  function _getIcon(msg) {
    var m = (msg || "").toString();
    if (/✅|success|saved|done/i.test(m)) return '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
    if (/❌|error|fail|wrong|invalid/i.test(m)) return '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
    if (/⚠️|warning|caution/i.test(m)) return '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>';
    return '<svg width="18" height="18" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 16v-4m0-4h.01"/></svg>';
  }

  // window.alert replacement
  window.alert = function (msg) {
    return new Promise(function (resolve) {
      var ov = _createOverlay();
      var txt = (msg || "").toString();
      ov.innerHTML = '<div class="_ss-modal">' +
        '<div class="_ss-modal-icon">' + _getIcon(txt) + '</div>' +
        '<div class="_ss-modal-title">Notice</div>' +
        '<div class="_ss-modal-msg">' + txt.replace(/</g,"&lt;").replace(/>/g,"&gt;") + '</div>' +
        '<div class="_ss-btn-row"><button class="_ss-btn _ss-btn-primary" id="_ssAlertOk">OK</button></div>' +
        '</div>';
      ov.querySelector("#_ssAlertOk").onclick = function () {
        _removeOverlay(ov, function () { resolve(); });
      };
    });
  };

  // window.confirm replacement
  window.confirm = function (msg) {
    return new Promise(function (resolve) {
      var ov = _createOverlay();
      var txt = (msg || "").toString();
      ov.innerHTML = '<div class="_ss-modal">' +
        '<div class="_ss-modal-icon">' + _getIcon(txt) + '</div>' +
        '<div class="_ss-modal-title">Confirm</div>' +
        '<div class="_ss-modal-msg">' + txt.replace(/</g,"&lt;").replace(/>/g,"&gt;") + '</div>' +
        '<div class="_ss-btn-row">' +
          '<button class="_ss-btn _ss-btn-primary" id="_ssConfirmYes">Yes, proceed</button>' +
          '<button class="_ss-btn _ss-btn-secondary" id="_ssConfirmNo">Cancel</button>' +
        '</div>' +
        '</div>';
      ov.querySelector("#_ssConfirmYes").onclick = function () { _removeOverlay(ov, function () { resolve(true); }); };
      ov.querySelector("#_ssConfirmNo").onclick = function () { _removeOverlay(ov, function () { resolve(false); }); };
    });
  };

  // window.prompt replacement
  window.prompt = function (msg, def) {
    return new Promise(function (resolve) {
      var ov = _createOverlay();
      var txt = (msg || "").toString();
      ov.innerHTML = '<div class="_ss-modal">' +
        '<div class="_ss-modal-icon">' + _getIcon(txt) + '</div>' +
        '<div class="_ss-modal-title">Input Required</div>' +
        '<div class="_ss-modal-msg">' + txt.replace(/</g,"&lt;").replace(/>/g,"&gt;") + '</div>' +
        '<input class="_ss-modal-input" id="_ssPromptInput" value="' + (def||"") + '" />' +
        '<div class="_ss-btn-row">' +
          '<button class="_ss-btn _ss-btn-primary" id="_ssPromptOk">OK</button>' +
          '<button class="_ss-btn _ss-btn-secondary" id="_ssPromptCancel">Cancel</button>' +
        '</div>' +
        '</div>';
      var inp = ov.querySelector("#_ssPromptInput");
      inp.focus();
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") ov.querySelector("#_ssPromptOk").click(); });
      ov.querySelector("#_ssPromptOk").onclick = function () { var v = inp.value; _removeOverlay(ov, function () { resolve(v); }); };
      ov.querySelector("#_ssPromptCancel").onclick = function () { _removeOverlay(ov, function () { resolve(null); }); };
    });
  };

  // Toast notifications (non-blocking)
  window.showToast = function (msg, duration) {
    duration = duration || 3500;
    if (!document.getElementById("_ssToastCont")) {
      var cont = document.createElement("div");
      cont.id = "_ssToastCont";
      cont.className = "_ss-toast-container";
      document.body.appendChild(cont);
    }
    var t = document.createElement("div");
    t.className = "_ss-toast";
    t.textContent = msg;
    document.getElementById("_ssToastCont").appendChild(t);
    setTimeout(function () {
      t.style.animation = "_ssToastOut 0.3s ease forwards";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, duration);
  };

  // ── 2. NOTIFICATION BADGE SYSTEM ─────────────────────────────────────────
  // Handled by Section 2 (socket + _fetchNotis) — polling removed to prevent conflicts

  function _getAuthHeaders() {
    var token = "";
    try { token = sessionStorage.getItem("token") || ""; } catch (e) {}
    try { if (!token) token = localStorage.getItem("token") || ""; } catch (e) {}
    return token ? { "Authorization": "Bearer " + token, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  }

  function _getCurrentUser() {
    try {
      var raw = sessionStorage.getItem("currentUser") || localStorage.getItem("currentUser") || "";
      return JSON.parse(raw || "null");
    } catch (e) { return null; }
  }

  // ── 3. EMAIL VALIDATION (allows @support gmail + normal gmail) ─────────────
  // Block fake/disposable/spam domains
  var _SPAM_DOMAINS = [
    "mailinator.com","guerrillamail.com","throwam.com","yopmail.com",
    "tempmail.com","temp-mail.org","fakeinbox.com","mailnull.com",
    "spamgourmet.com","trashmail.com","getnada.com","dispostable.com",
    "sharklasers.com","guerrillamailblock.com","grr.la","guerrillamail.info",
    "spam4.me","spamfree24.org","mailnesia.com","maildrop.cc","mailnull.net"
  ];

  window.isValidSupportEmail = function (email) {
    var e = (email || "").toLowerCase().trim();
    // Allow support@gmail.com pattern and normal @gmail.com
    if (!/^[a-zA-Z0-9._%+\-]+@gmail\.com$/.test(e)) return false;
    var local = e.split("@")[0];
    // Block obviously fake locals
    if (local.length < 2) return false;
    return true;
  };

  window.isSpamEmail = function (email) {
    var e = (email || "").toLowerCase().trim();
    var domain = e.split("@")[1] || "";
    return _SPAM_DOMAINS.includes(domain);
  };

  // ── 4. PROFILE PHOTO COVER FIX ───────────────────────────────────────────
  // Ensures profile photos fully cover their containers (no cuts)
  // NOTE: does NOT override border-radius — each element owns its own shape
  window.fixProfilePhotos = function () {
    // Circle avatars only (nav, chat sidebar, message bubbles, chat header)
    var circleImgs = document.querySelectorAll(".uc-avatar, .head-avatar, .msg-avatar, .nav-avatar img, .conn-avatar, .profile-photo, .profile-image, .avatar-wrap img");
    circleImgs.forEach(function (img) {
      img.style.objectFit = "cover";
      img.style.objectPosition = "center";
      img.style.width = "100%";
      img.style.height = "100%";
      // Only force circle on elements that are meant to be circular
      if (img.classList.contains("uc-avatar") || img.classList.contains("head-avatar") || img.classList.contains("msg-avatar") || img.classList.contains("nav-avatar") || img.classList.contains("conn-avatar")) {
        img.style.borderRadius = "50%";
      }
    });
    // Circle avatars (connected page) — full circle like Instagram
    var squareContainers = document.querySelectorAll(".avatar");
    squareContainers.forEach(function (el) {
      el.style.borderRadius = "50%";
      var img = el.querySelector("img");
      if (img) {
        img.style.objectFit = "cover";
        img.style.objectPosition = "center";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.borderRadius = "50%";
      }
    });
    // Background-image avatars
    var bgAvatars = document.querySelectorAll(".nav-avatar, [style*='background-image']");
    bgAvatars.forEach(function (el) {
      if (el.style.backgroundImage || el.classList.contains("nav-avatar")) {
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(window.fixProfilePhotos, 300); });
  } else {
    setTimeout(window.fixProfilePhotos, 300);
  }

  // ── 5. HOVER EFFECTS FOR CONNECTIONS ─────────────────────────────────────
  // Adds smooth hover to skipped/unskipped/connected cards
  var _hoverStyle = document.getElementById("_ssHoverStyle");
  if (!_hoverStyle) {
    _hoverStyle = document.createElement("style");
    _hoverStyle.id = "_ssHoverStyle";
    _hoverStyle.textContent = `
      .connection-card, .skipped-card, .user-card, .conn-card {
        transition: transform 0.2s cubic-bezier(0.4,0,0.2,1), box-shadow 0.2s cubic-bezier(0.4,0,0.2,1) !important;
      }
      .connection-card:hover, .skipped-card:hover, .user-card:hover, .conn-card:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
      }
      .unskip-btn, .skip-btn, .connect-btn, .btn-unskip, .btn-skip {
        transition: all 0.18s cubic-bezier(0.4,0,0.2,1) !important;
      }
      .unskip-btn:hover, .btn-unskip:hover { background:#111118 !important; color:#fff !important; transform:scale(1.03); }
      .skip-btn:hover, .btn-skip:hover { opacity:0.85; transform:scale(1.03); }
    `;
    document.head.appendChild(_hoverStyle);
  }

  // ── 6. MOBILE ANIMATION PERFORMANCE FIX ──────────────────────────────────
  // Reduces animation complexity on low-RAM mobile devices
  (function () {
    var isMobile = window.innerWidth <= 768 || ("ontouchstart" in window);
    var isLowEnd = (navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2);
    if (isMobile && isLowEnd) {
      var perfStyle = document.createElement("style");
      perfStyle.textContent = `
        .ring1, .ring2, .ring3, .halo, [class*="ring"] { animation: none !important; display: none !important; }
        .bob { animation-duration: 6s !important; }
        .glowPulse, .imgGlow, .glowBlink, .logoGlow { animation-duration: 5s !important; }
        * { will-change: auto !important; }
      `;
      document.head.appendChild(perfStyle);
    }
  })();

  // ── 7. LOGIN FROM ONE DEVICE CHECK ───────────────────────────────────────
  // session-guard.js handles the main logic; this just ensures it's active
  // and the UI/animation works on mobile too
  (function () {
    // Fix viewport meta for mobile if missing
    var meta = document.querySelector("meta[name='viewport']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0";
      document.head.appendChild(meta);
    }
  })();

})();

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIG 1: REAL-TIME NOTIFICATION POPUP — works on EVERY page
//  CONFIG 2: CHAT TOAST with sender photo + count badge
//  CONFIG 4: LinkedIn duplicate error (styled B&W modal, not native alert)
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── Wait for currentUser to be available before initialising ──────────────
  // Fixes race condition where session-guard.js hasn't written currentUser yet
  function _getUser() {
    try { return JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser") || "null"); } catch (e) { return null; }
  }

  function _waitAndInit(tries) {
    tries = tries || 0;
    var cu = _getUser();
    if (cu && cu._id) { _startUI(cu); return; }
    if (tries >= 40) return; // give up after ~4 seconds
    setTimeout(function () { _waitAndInit(tries + 1); }, 100);
  }

  function _startUI(_cu) {
  var _tok = function () { return localStorage.getItem("token") || sessionStorage.getItem("token") || ""; };
  var _authH = function () { return { "Authorization": "Bearer " + _tok(), "Content-Type": "application/json" }; };

  // ── Inject styles ──────────────────────────────────────────────────────────
  if (!document.getElementById("_ssNP2Style")) {
    var _s = document.createElement("style");
    _s.id = "_ssNP2Style";
    _s.textContent =
      // Notification panel
      "#_ssNP{position:fixed;top:68px;right:16px;z-index:2147483644;width:310px;max-width:calc(100vw - 32px);background:#fff;border:1.5px solid #E4E4E7;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,0.15);font-family:'Sora','Inter',sans-serif;display:none;flex-direction:column;max-height:400px;overflow:hidden;}" +
      "#_ssNP.show{display:flex;animation:_npIn .2s cubic-bezier(.4,0,.2,1) both;}" +
      "@keyframes _npIn{from{opacity:0;transform:translateY(-8px) scale(.97)}to{opacity:1;transform:none}}" +
      "#_ssNP .nh{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid #E4E4E7;flex-shrink:0;}" +
      "#_ssNP .nh-t{font-size:.78rem;font-weight:700;color:#111118;}" +
      "#_ssNP .nh-c{font-size:.62rem;font-weight:600;color:#6B7280;cursor:pointer;border:none;background:none;padding:3px 8px;border-radius:6px;transition:background .15s;}" +
      "#_ssNP .nh-c:hover{background:#F4F4F5;color:#111118;}" +
      "#_ssNP .nl{overflow-y:auto;flex:1;}" +
      "#_ssNP .ni{display:flex;align-items:flex-start;gap:10px;padding:10px 14px;border-bottom:1px solid #F4F4F5;cursor:pointer;transition:background .15s;}" +
      "#_ssNP .ni:hover{background:#F9FAFB;}" +
      "#_ssNP .ni.u{background:#F5F5FF;border-left:3px solid #111118;padding-left:11px;}" +
      "#_ssNP .ni-ic{width:30px;height:30px;border-radius:50%;background:#111118;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-top:1px;}" +
      "#_ssNP .ni-b{flex:1;min-width:0;}" +
      "#_ssNP .ni-m{font-size:.7rem;color:#111118;line-height:1.5;font-family:'Inter',sans-serif;}" +
      "#_ssNP .ni-t{font-size:.6rem;color:#9CA3AF;margin-top:2px;}" +
      "#_ssNP .ne{text-align:center;padding:2rem 1rem;font-size:.74rem;color:#9CA3AF;}" +
      "#_ssNP .nf{padding:10px 14px;border-top:1px solid #E4E4E7;flex-shrink:0;}" +
      "#_ssNP .nf a{font-size:.68rem;font-weight:600;color:#111118;text-decoration:none;display:block;text-align:center;padding:6px;border-radius:8px;background:#F4F4F5;transition:background .15s;}" +
      "#_ssNP .nf a:hover{background:#111118;color:#fff;}" +
      // Chat toast keyframes
      "@keyframes _ssftIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}" +
      "@keyframes _ssftOut{from{opacity:1}to{opacity:0;transform:translateX(20px)}}" +
      // Chat toast with photo
      "._ctToast{display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid #E4E4E7;border-left:3px solid #111118;border-radius:10px;padding:10px 12px;box-shadow:0 8px 24px rgba(0,0,0,0.1);min-width:220px;max-width:300px;pointer-events:all;cursor:pointer;animation:_ssftIn .25s ease-out both;}" +
      "._ctToast .ctp{width:36px;height:36px;border-radius:50%;background:#F4F4F5;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#111118;font-family:'Sora',sans-serif;font-size:.7rem;font-weight:700;overflow:hidden;border:2px solid #E4E4E7;}" +
      "._ctToast .ctp img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;}" +
      "._ctToast .ctb{flex:1;min-width:0;}" +
      "._ctToast .ctn{font-size:.72rem;font-weight:700;color:#111118;font-family:'Sora',sans-serif;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
      "._ctToast .ctm{font-size:.68rem;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}";
    document.head.appendChild(_s);
  }

  // ── Notification panel DOM ─────────────────────────────────────────────────
  var _panel = null;
  function _getPanel() {
    if (_panel && document.getElementById("_ssNP")) return _panel;
    _panel = document.createElement("div");
    _panel.id = "_ssNP";
    _panel.innerHTML =
      '<div class="nh"><span class="nh-t">🔔 Notifications</span><button class="nh-c" id="_ssNPMark">Mark all read</button></div>' +
      '<div class="nl" id="_ssNPList"><div class="ne">Loading…</div></div>' +
      '<div class="nf"><a href="notifications.html">View all</a></div>';
    document.body.appendChild(_panel);
    document.getElementById("_ssNPMark").onclick = function () {
      fetch("/notifications/mark-seen", { method: "POST", headers: _authH() }).catch(function(){});
      _panel.querySelectorAll(".ni.u").forEach(function (i) { i.classList.remove("u"); });
      _setBadge(0);
    };
    // Close on outside click
    document.addEventListener("click", function (e) {
      if (!_panel || !_panel.classList.contains("show")) return;
      if (_panel.contains(e.target)) return;
      var btn = document.getElementById("nav-notifications");
      if (btn && btn.contains(e.target)) return;
      _panel.classList.remove("show");
    }, true);
    return _panel;
  }

  function _relTime(d) {
    var diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return Math.floor(diff / 86400000) + "d ago";
  }

  function _icon(type) {
    if (type === "connected" || type === "auto_connected") return "🤝";
    if (type === "request_received") return "📩";
    if (type === "request_sent") return "✅";
    if (type === "declined") return "❌";
    return "🔔";
  }

  function _setBadge(count) {
    // ✅ Respect mark-all-read flag — don't overwrite zeroed badge
    var _allRead = window._ssNotiAllRead ||
      ((Date.now() - (parseInt(localStorage.getItem("notiAllReadAt")||"0"))) < 30000);
    if (_allRead && count > 0) return;
    ["navNotiBadge", "mobNavNotiBadge"].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      if (count > 0) { b.textContent = count > 99 ? "99+" : String(count); b.style.display = "flex"; }
      else { b.style.display = "none"; b.textContent = ""; }
    });
  }

  var _cache = [];

  function _renderPanel() {
    var list = document.getElementById("_ssNPList");
    if (!list) return;
    var valid = ["request_sent","request_received","auto_connected","connected","declined"];
    var items = _cache.filter(function (n) { return valid.includes(n.type); }).slice(0, 20);
    if (!items.length) { list.innerHTML = '<div class="ne">No notifications yet 🎉</div>'; return; }
    list.innerHTML = items.map(function (n) {
      return '<div class="ni' + (n.seen ? "" : " u") + '" onclick="window.location.href=\'notifications.html\'">' +
        '<div class="ni-ic">' + _icon(n.type) + '</div>' +
        '<div class="ni-b"><div class="ni-m">' + (n.message || "").replace(/</g,"&lt;") + '</div>' +
        '<div class="ni-t">' + _relTime(n.createdAt) + '</div></div></div>';
    }).join("");
  }

  async function _fetchNotis() {
    try {
      var r = await fetch("/notifications?userId=" + encodeURIComponent(_cu._id), { cache: "no-store", headers: _authH() });
      var d = await r.json();
      if (!d || !d.success) return;
      _cache = d.notifications || [];
      var valid = ["request_sent","request_received","auto_connected","connected","declined"];
      var unseen = _cache.filter(function (n) { return valid.includes(n.type) && !n.seen; }).length;
      _setBadge(unseen);
      _renderPanel();
    } catch (e) {}
  }

  // ── CONFIG 1: Hook bell click — override existing navigation listener ──────
  // Uses capture phase (3rd arg = true) so it fires BEFORE the page's own listener
  // Does NOT hook on notifications.html — that page manages its own bell/content
  function _hookBell() {
    // On notifications.html, let the page handle its own bell — no dropdown needed
    if (window.location.href.indexOf("notifications") !== -1) return;
    var btn = document.getElementById("nav-notifications");
    if (!btn || btn._ssNPHooked) return;
    btn._ssNPHooked = true;

    btn.addEventListener("click", function (e) {
      e.stopImmediatePropagation(); // block the page's own onclick that navigates away
      e.preventDefault();
      var panel = _getPanel();
      if (panel.classList.contains("show")) {
        panel.classList.remove("show");
      } else {
        _fetchNotis();
        panel.classList.add("show");
      }
    }, true); // capture phase — fires first
  }

  // ── CONFIG 2: Chat toast with sender photo ─────────────────────────────────
  // ── Notification toast (normal — connections, requests etc) ──────────────
  function _showNotifToast(icon, title, msg) {
    var c = document.getElementById("_ssFlashCont");
    if (!c) {
      c = document.createElement("div");
      c.id = "_ssFlashCont";
      c.style.cssText = "position:fixed;top:68px;right:16px;z-index:2147483640;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:calc(100vw - 32px);";
      document.body.appendChild(c);
    }
    var el = document.createElement("div");
    el.className = "_ctToast";
    el.style.borderLeft = "3px solid #16A34A";
    el.innerHTML = '<div class="ctp" style="background:#111118;color:#fff;font-size:1rem;">' + icon + '</div><div class="ctb"><div class="ctn">' + title + '</div><div class="ctm">' + msg + '</div></div>';
    el.onclick = function () { window.location.href = "notifications.html"; };
    c.appendChild(el);
    setTimeout(function () { el.style.animation = "_ssftOut .3s ease forwards"; }, 5000);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 5300);
  }

  // ── Chat toast (shows on ALL pages including chat page) ───────────────────
  function _chatToast(fromName, msgText, photo) {
    // Force everything to plain strings — prevents "object object"
    fromName = String(fromName || "New Message");
    msgText  = String(msgText  || "[File]");
    photo    = String(photo    || "");

    var c = document.getElementById("_ssFlashCont");
    if (!c) {
      c = document.createElement("div");
      c.id = "_ssFlashCont";
      c.style.cssText = "position:fixed;top:68px;right:16px;z-index:2147483640;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:calc(100vw - 32px);";
      document.body.appendChild(c);
    }
    var el = document.createElement("div");
    el.className = "_ctToast";
    var initial = (fromName[0] || "U").toUpperCase();
    var av = (photo && (photo.startsWith("http") || photo.startsWith("/") || photo.startsWith("data:")))
      ? '<div class="ctp"><img src="' + photo + '" onerror="this.onerror=null;this.style.display=\'none\';this.parentNode.textContent=\'' + initial + '\'"></div>'
      : '<div class="ctp">' + initial + '</div>';
    el.innerHTML = av + '<div class="ctb"><div class="ctn">💬 ' + fromName.substring(0, 24) + '</div><div class="ctm">' + msgText.substring(0, 55) + '</div></div>';
    el.onclick = function () { window.location.href = "chat.html"; };
    c.appendChild(el);
    setTimeout(function () { el.style.animation = "_ssftOut .3s ease forwards"; }, 4500);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 4800);
  }

  // ── Socket setup ──────────────────────────────────────────────────────────
  var _sk = null;

  function _setupSocket() {
    if (_sk) return;
    if (!window.io) return;
    try {
      // Reuse session-guard socket — never create a duplicate
      _sk = window._ssSocket || window.io({ auth: { userId: _cu._id, token: localStorage.getItem('token')||sessionStorage.getItem('token')||'' }, transports: ["websocket", "polling"] });
      window._ssSocket = _sk;

      if (_sk.connected) { _fetchNotis(); }
      _sk.on("connect", function () { _fetchNotis(); });

      // ── Normal notification toast (every page) ──────────────────────────
      _sk.on("notification:new", function (n) {
        if (!n) return;
        _cache.unshift(n);
        var valid = ["request_sent","request_received","auto_connected","connected","declined"];
        if (!valid.includes(n.type)) return;
        var unseen = _cache.filter(function (x) { return valid.includes(x.type) && !x.seen; }).length;
        _setBadge(unseen);
        var panel = document.getElementById("_ssNP");
        if (panel && panel.classList.contains("show")) _renderPanel();
        // Toast
        var icon  = (n.type === "connected" || n.type === "auto_connected") ? "🤝" : n.type === "request_received" ? "📩" : n.type === "declined" ? "❌" : "✅";
        var title = (n.type === "connected" || n.type === "auto_connected") ? "New Connection!" : n.type === "request_received" ? "Connection Request" : "Connection Update";
        _showNotifToast(icon, title, String(n.message || "").substring(0, 60));
      });

      // ✅ FIX: Block notification on EVERY page
      _sk.on("user:blocked", function(payload) {
        if (!payload) return;
        var name = String(payload.byUserName || "A user");
        _showNotifToast("⛔", "You've been blocked", name + " has removed you from their connections.");
        // Redirect to connections page after 3 seconds if on chat page
        var page = (window.location.pathname.split("/").pop() || "").toLowerCase();
        if (page === "chat.html") {
          setTimeout(function() { window.location.href = "connections.html"; }, 3000);
        }
      });

      // ── Chat toast (every page — including chat page) ───────────────────
      _sk.on("chat:newMessage", function (payload) {
        if (!payload) return;
        var toId = String(payload.toUserId || "").trim();
        var myId = String(_cu._id || "").trim();
        if (!toId || toId !== myId) return;
        // Extract as plain strings immediately — no object leaks
        var fromName = String(payload.fromUserName || "");
        var msgText  = String(payload.text || (payload.file ? "[File]" : ""));
        var photo    = String(payload.fromUserPhoto || "");
        var fromId   = String(payload.fromUserId || "");
        // Only show toast on non-chat pages — chat.html handles its own toast
        if (window.location.pathname.indexOf("chat.html") === -1) {
          // If backend didn't send name/photo, fetch from /get-user as fallback
          if (!fromName && fromId) {
            fetch("/get-user?userId=" + encodeURIComponent(fromId), {
              cache: "no-store",
              headers: { "Authorization": "Bearer " + _tok() }
            }).then(function(r){ return r.json(); })
              .then(function(d){
                if (d && d.success) {
                  var n = String(d.fullName || d.name || "New Message");
                  var p = String(d.photo || (d.founderProfile && d.founderProfile.photo) || (d.investorProfile && d.investorProfile.photo) || "");
                  _chatToast(n, msgText, p);
                } else {
                  _chatToast("New Message", msgText, "");
                }
              }).catch(function(){ _chatToast("New Message", msgText, ""); });
          } else {
            _chatToast(fromName || "New Message", msgText, photo);
          }
        }
        // Bump chat badge
        ["navChatBadge","mobNavChatBadge","mobChatBadge"].forEach(function (id) {
          var b = document.getElementById(id);
          if (!b) return;
          var cur = parseInt(b.textContent || "0") || 0;
          cur++;
          b.textContent = cur > 99 ? "99+" : String(cur);
          b.style.display = "flex";
        });
      });


      // ✅ FIX: When sender deletes an unread message, decrement badge
      _sk.on("chat:messageDeleted", function (payload) {
        if (!payload) return;
        // Re-fetch unread counts from server to get accurate number
        if (_cu && _cu._id) {
          fetch("/chat/unread-counts?userId=" + encodeURIComponent(_cu._id), {
            cache: "no-store",
            headers: { "Authorization": "Bearer " + _tok() }
          }).then(function(r){ return r.json(); })
            .then(function(d){
              if (!d || !d.success) return;
              var total = Object.values(d.counts || {}).reduce(function(s,c){ return s+c; }, 0);
              ["navChatBadge","mobNavChatBadge","mobChatBadge"].forEach(function(id){
                var b = document.getElementById(id);
                if (!b) return;
                if (total > 0) { b.textContent = total > 99 ? "99+" : String(total); b.style.display = "flex"; }
                else { b.textContent = ""; b.style.display = "none"; }
              });
            }).catch(function(){});
        }
      });

      // ✅ FIX: Also handle chat:unreadUpdate event
      _sk.on("chat:unreadUpdate", function () {
        if (_cu && _cu._id) {
          fetch("/chat/unread-counts?userId=" + encodeURIComponent(_cu._id), {
            cache: "no-store",
            headers: { "Authorization": "Bearer " + _tok() }
          }).then(function(r){ return r.json(); })
            .then(function(d){
              if (!d || !d.success) return;
              var total = Object.values(d.counts || {}).reduce(function(s,c){ return s+c; }, 0);
              ["navChatBadge","mobNavChatBadge","mobChatBadge"].forEach(function(id){
                var b = document.getElementById(id);
                if (!b) return;
                if (total > 0) { b.textContent = total > 99 ? "99+" : String(total); b.style.display = "flex"; }
                else { b.textContent = ""; b.style.display = "none"; }
              });
            }).catch(function(){});
        }
      });

      _sk.on("connect_error", function (err) {
        console.warn("[custom-ui] Socket connect_error:", err && err.message);
      });

    } catch (e) {
      console.error("[custom-ui] Socket setup error:", e);
    }
  }

  // ── CONFIG 4: LinkedIn duplicate — override alert to show B&W modal ────────
  // The dashboards call alert("❌ This LinkedIn profile URL is already registered...")
  // custom-ui.js already overrides window.alert with a styled B&W modal ✅
  // But also add a real-time paste check with inline error under the field
  function _hookLinkedInField() {
    var input = document.getElementById("linkedinUrl");
    if (!input || input._ssLIHooked) return;
    input._ssLIHooked = true;

    // Show/hide inline error helper
    function _showLIError(msg) {
      var existing = document.getElementById("_ssLIErr");
      if (!existing) {
        existing = document.createElement("div");
        existing.id = "_ssLIErr";
        existing.style.cssText = "margin-top:6px;padding:8px 12px;background:#111118;color:#fff;border-radius:8px;font-size:.68rem;font-family:'Inter',sans-serif;line-height:1.5;display:flex;align-items:flex-start;gap:8px;";
        input.parentNode.insertBefore(existing, input.nextSibling);
      }
      existing.innerHTML = '<span style="flex-shrink:0;font-size:14px;">🔒</span><span>' + msg + '</span>';
      existing.style.display = "flex";
    }
    function _hideLIError() {
      var e = document.getElementById("_ssLIErr");
      if (e) e.style.display = "none";
    }

    var _checkTimer = null;
    input.addEventListener("input", function () { _hideLIError(); });
    input.addEventListener("paste", function () {
      clearTimeout(_checkTimer);
      _checkTimer = setTimeout(function () {
        var val = input.value.trim();
        if (!val || !/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/.test(val)) return;
        var tok = _tok();
        var cu = _cu;
        fetch("/profile/check-linkedin", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
          body: JSON.stringify({ linkedinUrl: val, userId: cu._id })
        }).then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.taken) {
              input.value = "";
              _showLIError("This LinkedIn profile is already registered on StartupSync. Each account must use their own unique LinkedIn profile link. Do not try to misuse this link.");
            }
          }).catch(function () {});
      }, 600);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function _init() {
    _hookBell();
    _fetchNotis();
    _hookLinkedInField();
    // FIX: retry every 200ms until socket.io is loaded — no hard 15s cutoff that silently gives up
    if (window.io) {
      _setupSocket();
    } else {
      var _ioWait = setInterval(function () {
        if (window.io) { clearInterval(_ioWait); _setupSocket(); }
      }, 200);
    }
    // Expose socket getter globally so other scripts can reuse the same socket
    window._ssGetSocket = function () { return _sk; };
    // Re-try hooking bell after a delay (some pages load nav late)
    setTimeout(_hookBell, 600);
    setTimeout(_hookBell, 1500);
    setTimeout(_hookBell, 3000);
    // MutationObserver: re-hook if bell is replaced by another script (e.g. chat.html clones it)
    var _mo = new MutationObserver(function() { _hookBell(); });
    if (document.body) {
      _mo.observe(document.body, { childList: true, subtree: true });
      setTimeout(function() { _mo.disconnect(); }, 5000);
    }
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", _init); }
  else { setTimeout(_init, 100); }

  } // end _startUI

  // Kick off — retries until currentUser is ready (handles session-guard.js timing)
  _waitAndInit();

})();

// ═══════════════════════════════════════════════════════════════════════════
//  OFFLINE / ONLINE DETECTION SYSTEM — StartupSync
//  Works on ALL pages automatically
//  - Shows banner when internet drops
//  - Shows reconnecting toast when socket disconnects
//  - Auto-hides when connection restored
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  // ── Inject CSS ──────────────────────────────────────────────────────────
  var _offlineCss = document.createElement("style");
  _offlineCss.textContent = [
    // Offline banner — top of page
    "#_ssOfflineBanner{",
      "position:fixed;top:0;left:0;right:0;z-index:2147483645;",
      "background:#111118;color:#fff;",
      "display:flex;align-items:center;justify-content:center;gap:8px;",
      "padding:9px 16px;",
      "font-family:'Sora',sans-serif;font-size:0.72rem;font-weight:600;",
      "letter-spacing:0.02em;",
      "transform:translateY(-100%);transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);",
      "box-shadow:0 2px 12px rgba(0,0,0,0.3);",
    "}",
    "#_ssOfflineBanner.show{transform:translateY(0);}",
    "#_ssOfflineBanner svg{flex-shrink:0;}",
    // Reconnecting toast — bottom center
    "#_ssReconnToast{",
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);",
      "z-index:2147483645;",
      "background:#111118;color:#fff;",
      "display:flex;align-items:center;gap:8px;",
      "padding:9px 18px;border-radius:999px;",
      "font-family:'Sora',sans-serif;font-size:0.7rem;font-weight:600;",
      "letter-spacing:0.02em;white-space:nowrap;",
      "opacity:0;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);",
      "pointer-events:none;",
      "box-shadow:0 4px 20px rgba(0,0,0,0.25);",
    "}",
    "#_ssReconnToast.show{opacity:1;transform:translateX(-50%) translateY(0);}",
    // Spinner inside reconnect toast
    "@keyframes _ssSpin{to{transform:rotate(360deg)}}",
    "._ss-spin{animation:_ssSpin 0.8s linear infinite;display:inline-block;}",
    // Online restored toast — green flash
    "#_ssOnlineToast{",
      "position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);",
      "z-index:2147483645;",
      "background:#111118;color:#fff;border:1.5px solid #22c55e;",
      "display:flex;align-items:center;gap:8px;",
      "padding:9px 18px;border-radius:999px;",
      "font-family:'Sora',sans-serif;font-size:0.7rem;font-weight:600;",
      "letter-spacing:0.02em;white-space:nowrap;",
      "opacity:0;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);",
      "pointer-events:none;",
      "box-shadow:0 4px 20px rgba(0,0,0,0.25);",
    "}",
    "#_ssOnlineToast.show{opacity:1;transform:translateX(-50%) translateY(0);}",
    // Push page content down when banner shows
    "body._ss-offline-push{padding-top:96px !important;transition:padding-top 0.3s;}","@media(max-width:768px){body._ss-offline-push{padding-top:94px !important;}}",
    "@media(max-width:480px){",
      "#_ssOfflineBanner{font-size:0.65rem;padding:8px 12px;}",
      "#_ssReconnToast,#_ssOnlineToast{font-size:0.65rem;padding:8px 14px;bottom:70px;}",
    "}",
  ].join("");
  document.head.appendChild(_offlineCss);

  // ── Create banner + toasts ──────────────────────────────────────────────
  function _ensureBanner() {
    if (!document.getElementById("_ssOfflineBanner")) {
      var b = document.createElement("div");
      b.id = "_ssOfflineBanner";
      b.innerHTML = '<svg width="14" height="14" fill="none" stroke="#fff" stroke-width="2" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg><span>You are offline — check your connection</span>';
      document.body.insertBefore(b, document.body.firstChild);
    }
    if (!document.getElementById("_ssReconnToast")) {
      var r = document.createElement("div");
      r.id = "_ssReconnToast";
      r.innerHTML = '<span class="_ss-spin">⟳</span><span>Reconnecting…</span>';
      document.body.appendChild(r);
    }
    if (!document.getElementById("_ssOnlineToast")) {
      var o = document.createElement("div");
      o.id = "_ssOnlineToast";
      o.innerHTML = '<svg width="13" height="13" fill="none" stroke="#22c55e" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><span>Back online!</span>';
      document.body.appendChild(o);
    }
  }

  // ── Show/hide offline banner ────────────────────────────────────────────
  var _offlineTimer = null;
  function _showOffline() {
    _ensureBanner();
    var b = document.getElementById("_ssOfflineBanner");
    if (b) b.classList.add("show");
    document.body.classList.add("_ss-offline-push");
  }

  function _hideOffline() {
    var b = document.getElementById("_ssOfflineBanner");
    if (b) b.classList.remove("show");
    document.body.classList.remove("_ss-offline-push");
  }

  // ── Show/hide reconnecting toast ────────────────────────────────────────
  var _reconnTimer = null;
  function _showReconn() {
    _ensureBanner();
    var t = document.getElementById("_ssReconnToast");
    if (t) t.classList.add("show");
  }

  function _hideReconn() {
    var t = document.getElementById("_ssReconnToast");
    if (t) t.classList.remove("show");
  }

  // ── Show "Back online!" toast ───────────────────────────────────────────
  function _showOnlineFlash() {
    _ensureBanner();
    var t = document.getElementById("_ssOnlineToast");
    if (!t) return;
    t.classList.add("show");
    clearTimeout(_reconnTimer);
    _reconnTimer = setTimeout(function () {
      t.classList.remove("show");
    }, 2500);
  }

  // ── Network event listeners ─────────────────────────────────────────────
  var _wasOffline = !navigator.onLine;

  window.addEventListener("offline", function () {
    _wasOffline = true;
    _showOffline();
    _hideReconn();
  });

  window.addEventListener("online", function () {
    if (_wasOffline) {
      _wasOffline = false;
      _hideOffline();
      _showOnlineFlash();
    }
  });

  // Check on load
  if (!navigator.onLine) {
    document.addEventListener("DOMContentLoaded", function () {
      _showOffline();
    });
  }

  // ── Socket disconnect/reconnect handling ────────────────────────────────
  // Polls for socket instance and hooks disconnect/reconnect events
  var _sockHooked = false;
  var _sockPoll = setInterval(function () {
    var sock = window._ssSocket || window._ssGetSocket && window._ssGetSocket() || null;
    if (!sock || _sockHooked) return;
    _sockHooked = true;
    clearInterval(_sockPoll);

    sock.on("disconnect", function (reason) {
      // Don't show reconnecting if it's a voluntary disconnect (logout)
      if (reason === "io client disconnect" || reason === "io server disconnect") return;
      if (!navigator.onLine) return; // already showing offline banner
      _showReconn();
    });

    sock.on("reconnect", function () {
      _hideReconn();
      if (!_wasOffline) _showOnlineFlash();
    });

    sock.on("reconnect_attempt", function () {
      _showReconn();
    });

    sock.on("reconnect_failed", function () {
      _hideReconn();
      if (window.showToast) window.showToast("⚠️ Connection failed — please refresh the page.");
    });

    sock.on("connect", function () {
      _hideReconn();
    });

  }, 300);

  // Safety stop — after 30s if socket never found, stop polling
  setTimeout(function () { clearInterval(_sockPoll); }, 30000);

  // ── Slow connection detection ───────────────────────────────────────────
  // If fetch takes >8s, show a "Slow connection" warning
  var _origFetch = window.fetch ? window.fetch.bind(window) : null;
  var _slowTimer = null;
  var _slowShown = false;

  if (_origFetch) {
    window.fetch = function () {
      var args = arguments;
      var url = (args[0] || "").toString();
      // Only monitor our own API calls
      var isApi = url.startsWith("/") && !url.includes("socket.io") && !url.includes("googleapis");
      var timer = null;
      if (isApi) {
        timer = setTimeout(function () {
          if (!_slowShown && navigator.onLine) {
            _slowShown = true;
            if (window.showToast) window.showToast("⏳ Slow connection — please wait…");
            setTimeout(function () { _slowShown = false; }, 15000);
          }
        }, 8000);
      }
      return _origFetch.apply(window, args).then(function (response) {
        if (timer) clearTimeout(timer);
        return response;
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
    };
  }

})();
// ═══════════════════════════════════════════════════════════════════════════
//  NAV PFP GLITCH FIX — StartupSync
//  Strategy: inject photo via <style> in <head> BEFORE body renders (zero flash)
//  custom-ui.js only handles updates/refreshes after initial load
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  function _getAvatarEl() {
    return document.getElementById("sbAvatar") ||
           document.getElementById("navAvatar") ||
           document.querySelector(".nav-avatar");
  }

  function _getUser() {
    try { return JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser") || "null"); } catch (e) { return null; }
  }

  function _getToken() {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  }

  function _getPhoto(cu) {
    if (!cu) return "";
    var isFounder = (cu.role || "").toLowerCase() === "founder";
    var profile = isFounder ? (cu.founderProfile || {}) : (cu.investorProfile || {});
    return (profile.photo || cu.photo || localStorage.getItem("profilePhoto") || sessionStorage.getItem("profilePhoto") || "").trim();
  }

  function _getInitials(cu) {
    var name = (cu && cu.fullName || "U").trim();
    return name.split(/\s+/).filter(Boolean).map(function(w){ return w[0] || ""; }).join("").substring(0, 2).toUpperCase() || "U";
  }

  // Set avatar to photo — preload silently, swap only when ready
  function _setPhoto(el, photo, initials) {
    if (!el || !photo) return;
    // If already showing this photo — skip
    var existing = el.querySelector("img");
    if (existing && existing.src && existing.src.indexOf(encodeURI(photo)) !== -1) return;

    var img = new window.Image();
    img.onload = function() {
      el.innerHTML = "";
      el.style.color = "transparent";
      var imgEl = document.createElement("img");
      imgEl.src = photo;
      imgEl.style.cssText = "width:100%;height:100%;border-radius:50%;object-fit:cover;object-position:center;display:block;";
      el.appendChild(imgEl);
    };
    img.onerror = function() {
      if (!el.querySelector("img")) {
        el.innerHTML = "";
        el.textContent = initials;
        el.style.color = "#fff";
      }
    };
    img.src = photo;
  }

  // Called once on page load — only refreshes from server, doesn't cause flash
  function _initNavAvatar() {
    var el = _getAvatarEl();
    if (!el) return;
    var cu = _getUser();
    if (!cu) return;

    var photo    = _getPhoto(cu);
    var initials = _getInitials(cu);

    // If head script already injected the img — don't interfere
    if (el.querySelector("img")) return;

    // Head script set background-image — replace with proper img tag silently
    if (photo) {
      el.style.color = "transparent";
      _setPhoto(el, photo, initials);
    } else {
      el.innerHTML  = "";
      el.textContent = initials;
      el.style.color = "#fff";
    }

    // Fetch fresh photo from server (handles profile updates)
    if (cu._id) {
      fetch("/get-user?userId=" + encodeURIComponent(cu._id), {
        cache: "no-store",
        headers: { "Authorization": "Bearer " + _getToken() }
      }).then(function(r){ return r.json(); })
        .then(function(d){
          if (!d || !d.success || !d.photo || !d.photo.trim()) return;
          var freshPhoto = d.photo.trim();
          if (freshPhoto === photo) return; // no change
          // Update storage
          try {
            var stored = JSON.parse(localStorage.getItem("currentUser") || "null");
            if (stored) {
              if (stored.founderProfile)  stored.founderProfile.photo  = freshPhoto;
              if (stored.investorProfile) stored.investorProfile.photo = freshPhoto;
              localStorage.setItem("currentUser", JSON.stringify(stored));
            }
          } catch(e) {}
          _setPhoto(_getAvatarEl(), freshPhoto, initials);
        }).catch(function(){});
    }
  }

  // Re-run when storage changes (dashboard save → nav updates instantly)
  window.addEventListener("storage", function(e) {
    if (e.key === "currentUser" && e.newValue) {
      setTimeout(_initNavAvatar, 80);
    }
    if (e.key === "profilePhoto" && e.newValue) {
      var cu = _getUser();
      if (cu) _setPhoto(_getAvatarEl(), e.newValue.trim(), _getInitials(cu));
    }
  });

  // Socket hook — profile:updated fires when dashboard saves
  function _hookSocket() {
    var sock = window._ssSocket || (window._ssGetSocket && window._ssGetSocket());
    if (!sock || sock.__pfpHooked) return;
    sock.__pfpHooked = true;
    sock.on("profile:updated", function(data) {
      var cu = _getUser();
      if (!cu || String(data.userId) !== String(cu._id)) return;
      var photo = (data.profile && data.profile.photo) ? data.profile.photo.trim() : "";
      if (photo) _setPhoto(_getAvatarEl(), photo, _getInitials(cu));
    });
  }

  // Poll for socket
  var _poll = setInterval(function() {
    _hookSocket();
    if (window._ssSocket && window._ssSocket.__pfpHooked) clearInterval(_poll);
  }, 500);
  setTimeout(function(){ clearInterval(_poll); }, 30000);

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _initNavAvatar);
  } else {
    _initNavAvatar();
  }

})();