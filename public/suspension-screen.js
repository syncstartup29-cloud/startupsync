// ══════════════════════════════════════════════════════════
//  suspension-screen.js  —  StartupSync
//  Place on EVERY protected page. Script order does NOT matter.
//  Two trigger paths:
//    1. Socket.IO → "user:suspended" event  (instant)
//    2. Any fetch() returning { suspended: true }  (fallback)
// ══════════════════════════════════════════════════════════

(function () {
  "use strict";

  // ── 0. Skip on admin + auth pages ──
  try {
    var _p = (window.location.pathname.split("/").pop() || "").toLowerCase();
    var _skip = ["admin.html","index.html","reset-password.html","terms.html","welcome.html"];
    if (_skip.indexOf(_p) !== -1) return;
  } catch (e) {}

  // ── 1. Get current user's ID from storage ───────────────
  function getMyUserId() {
    if (window.currentUserId) return String(window.currentUserId);
    try {
      var raw = sessionStorage.getItem("currentUser") || localStorage.getItem("currentUser") || "";
      if (raw) { var cu = JSON.parse(raw); if (cu && cu._id) return String(cu._id); }
    } catch (e) {}
    try {
      var token = sessionStorage.getItem("token") || localStorage.getItem("token") || "";
      if (token) { var payload = JSON.parse(atob(token.split(".")[1])); if (payload && payload.userId) return String(payload.userId); }
    } catch (e) {}
    return null;
  }

  // ── 2. Inject the overlay HTML + CSS ────────────────────
  function injectOverlay() {
    if (document.getElementById("ss-suspension-overlay")) return;

    // Load Sora + Inter fonts (same as all other pages)
    if (!document.getElementById("ss-fonts")) {
      var fontLink = document.createElement("link");
      fontLink.id = "ss-fonts";
      fontLink.rel = "stylesheet";
      fontLink.href = "https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(fontLink);
    }

    var style = document.createElement("style");
    style.textContent = [
      // ── Overlay base ──
      "#ss-suspension-overlay{position:fixed;inset:0;z-index:2147483647;background:#ffffff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem;box-sizing:border-box;font-family:'Inter',sans-serif;animation:ss-fadeIn 0.5s cubic-bezier(0.4,0,0.2,1) forwards;}",
      "@keyframes ss-fadeIn{from{opacity:0}to{opacity:1}}",
      // ── Card wrapper ──
      "#ss-card{position:relative;z-index:1;background:#ffffff;border:1.5px solid #e4e4e7;border-radius:20px;padding:2.75rem 2.5rem 2.25rem;max-width:430px;width:100%;box-shadow:0 4px 32px rgba(0,0,0,0.07),0 1px 4px rgba(0,0,0,0.04);animation:ss-slideUp 0.55s 0.1s cubic-bezier(0.4,0,0.2,1) both;}",
      "@keyframes ss-slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}",
      // ── Brand tag ──
      "#ss-brand{font-family:'Sora',sans-serif;font-size:0.6rem;font-weight:700;letter-spacing:0.18em;color:#aaa;text-transform:uppercase;margin-bottom:1.75rem;}",
      // ── Icon ring ──
      "#ss-icon-wrap{position:relative;width:76px;height:76px;margin:0 auto 1.75rem;display:flex;align-items:center;justify-content:center;}",
      "#ss-icon-ring{position:absolute;inset:0;border-radius:50%;border:1.5px solid #111;animation:ss-ringPulse 2.2s ease-in-out infinite;}",
      "#ss-icon-ring2{position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(0,0,0,0.08);animation:ss-ringPulse 2.2s ease-in-out 0.4s infinite;}",
      "@keyframes ss-ringPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:0.5}}",
      "#ss-icon{width:76px;height:76px;border-radius:50%;background:#111;display:flex;align-items:center;justify-content:center;position:relative;z-index:1;}",
      "#ss-icon svg{width:36px;height:36px;fill:#ffffff;}",
      // ── Text ──
      "#ss-heading{font-family:'Sora',sans-serif;font-size:1.45rem;font-weight:800;color:#111111;margin:0 0 0.5rem;letter-spacing:-0.3px;line-height:1.3;}",
      "#ss-divider{width:36px;height:2.5px;background:#111;border-radius:2px;margin:0.9rem auto 1rem;}",
      "#ss-body{font-family:'Inter',sans-serif;font-size:0.88rem;color:#444;line-height:1.75;margin:0 0 0.5rem;}",
      "#ss-sub{font-family:'Inter',sans-serif;font-size:0.95rem;font-weight:500;color:#333;line-height:1.6;margin:0 0 0.4rem;}",
      "#ss-email{font-family:'Sora',sans-serif;font-size:0.8rem;font-weight:600;color:#111;letter-spacing:0.01em;margin:0 0 1.5rem;display:block;}",
      // ── Tick clock countdown ──
      "#ss-countdown-wrap{border-top:1px solid #f0f0f0;padding-top:1.4rem;display:flex;flex-direction:column;align-items:center;gap:0.6rem;}",
      "#ss-clock{position:relative;width:64px;height:64px;}",
      "#ss-clock svg{width:64px;height:64px;transform:rotate(-90deg);}",
      "#ss-clock-bg{fill:none;stroke:#e4e4e7;stroke-width:3;}",
      "#ss-clock-ring{fill:none;stroke:#111;stroke-width:3;stroke-linecap:round;stroke-dasharray:163;stroke-dashoffset:0;transition:stroke-dashoffset 1s linear;}",
      "#ss-clock-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:'Sora',sans-serif;font-size:1.3rem;font-weight:800;color:#111;animation:ss-tick 1s ease-in-out infinite;}",
      "@keyframes ss-tick{0%{transform:scale(1)}45%{transform:scale(0.88)}55%{transform:scale(0.88)}100%{transform:scale(1)}}",
      "#ss-redir-text{font-family:'Inter',sans-serif;font-size:0.72rem;color:#999;letter-spacing:0.01em;}"
    ].join("");
    document.head.appendChild(style);

    var overlay = document.createElement("div");
    overlay.id = "ss-suspension-overlay";

    // Card
    var card = document.createElement("div");
    card.id = "ss-card";

    // Brand
    var brand = document.createElement("div");
    brand.id = "ss-brand";
    brand.textContent = "StartupSync\u2122";
    card.appendChild(brand);

    // Icon
    var iconWrap = document.createElement("div");
    iconWrap.id = "ss-icon-wrap";
    var ring2 = document.createElement("div"); ring2.id = "ss-icon-ring2"; iconWrap.appendChild(ring2);
    var ring1 = document.createElement("div"); ring1.id = "ss-icon-ring"; iconWrap.appendChild(ring1);
    var icon = document.createElement("div");
    icon.id = "ss-icon";
    icon.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5L12 1zm0 6c.55 0 1 .45 1 1v4c0 .55-.45 1-1 1s-1-.45-1-1V8c0-.55.45-1 1-1zm0 8a1.25 1.25 0 110-2.5A1.25 1.25 0 0112 15z"/></svg>';
    iconWrap.appendChild(icon);
    card.appendChild(iconWrap);

    // Heading
    var heading = document.createElement("h1");
    heading.id = "ss-heading";
    heading.textContent = "Account Suspended";
    card.appendChild(heading);

    // Divider
    var divider = document.createElement("div");
    divider.id = "ss-divider";
    card.appendChild(divider);

    // Body text
    var body = document.createElement("p");
    body.id = "ss-body";
    body.textContent = "You have violated the Terms and Conditions of StartupSync. As a result, we have been required to remove or suspend your account from the platform.";
    card.appendChild(body);

    // Sub text — bigger now
    var sub = document.createElement("p");
    sub.id = "ss-sub";
    sub.textContent = "If you believe this is a mistake, please contact our support team:";
    card.appendChild(sub);

    // Email
    var email = document.createElement("a");
    email.id = "ss-email";
    email.href = "mailto:syncstartup29@gmail.com";
    email.textContent = "syncstartup29@gmail.com";
    card.appendChild(email);

    // ── Tick clock countdown ─────────────────────────────
    var TOTAL = 10;
    var cdWrap = document.createElement("div");
    cdWrap.id = "ss-countdown-wrap";

    // SVG clock face
    var clockDiv = document.createElement("div");
    clockDiv.id = "ss-clock";
    var CIRCUMFERENCE = 163; // 2π × r where r≈26
    clockDiv.innerHTML =
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
        '<circle id="ss-clock-bg" cx="32" cy="32" r="26"/>' +
        '<circle id="ss-clock-ring" cx="32" cy="32" r="26"/>' +
      '</svg>' +
      '<div id="ss-clock-num">10</div>';
    cdWrap.appendChild(clockDiv);

    var redirText = document.createElement("div");
    redirText.id = "ss-redir-text";
    redirText.textContent = "Redirecting you to login\u2026";
    cdWrap.appendChild(redirText);

    card.appendChild(cdWrap);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // ── Start countdown ──────────────────────────────────
    var remaining = TOTAL;
    var ringEl = document.getElementById("ss-clock-ring");
    var numEl  = document.getElementById("ss-clock-num");

    // Animate ring shrinking over full 10 seconds via CSS transition on first tick
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (ringEl) {
          ringEl.style.transition = "stroke-dashoffset " + TOTAL + "s linear";
          ringEl.style.strokeDashoffset = String(CIRCUMFERENCE);
        }
      });
    });

    var cdInterval = setInterval(function () {
      remaining -= 1;
      if (numEl) numEl.textContent = remaining > 0 ? remaining : "0";
      if (remaining <= 0) {
        clearInterval(cdInterval);
        try {
          for (var _h = 0; _h < 20; _h++) { history.pushState(null, "", "index.html"); }
          history.replaceState(null, "", "index.html");
        } catch (e) {}
        window.addEventListener("popstate", function () { history.pushState(null, "", "index.html"); });
        window.location.replace("index.html");
      }
    }, 1000);
  }

  // ── 3. Trigger suspension ────────────────────────────────
  var triggered = false;
  function triggerSuspension() {
    if (triggered) return;
    triggered = true;
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    if (document.body) {
      injectOverlay();
    } else {
      document.addEventListener("DOMContentLoaded", injectOverlay);
    }
  }

  // Expose trigger so session-guard can call it on page load (reload case)
  window._ssTriggerSuspension = triggerSuspension;

  // ── 4. Check if suspended event is for me ───────────────
  // ✅ FIXED: was using OR logic (||) which triggered for wrong users.
  // Now uses AND logic — only triggers if ALL conditions are true
  // AND the userId in the event matches THIS user's ID.
  function handleSuspendedEvent(data) {
    var myId = getMyUserId();
    if (myId && data && data.userId && String(data.userId) === myId) {
      triggerSuspension();
    }
  }

  // ── 5. Attach listener to a socket instance ─────────────
  function attachToSocket(sock) {
    if (!sock || sock.__ss_hooked) return;
    sock.__ss_hooked = true;
    sock.on("user:suspended", handleSuspendedEvent);
  }

  // ── 6. Intercept window._ssSocket assignment ─────────────
  // session-guard.js sets window._ssSocket = socket.
  // We proxy that assignment to hook in the moment it's set.
  var _realSocket = null;

  // If _ssSocket already set before this script ran
  if (window._ssSocket) {
    _realSocket = window._ssSocket;
    attachToSocket(_realSocket);
  }

  try {
    Object.defineProperty(window, "_ssSocket", {
      configurable: true,
      enumerable: true,
      get: function () { return _realSocket; },
      set: function (val) {
        _realSocket = val;
        if (val) attachToSocket(val);
      }
    });
  } catch (e) { /* fallback to polling below */ }

  // ── 7. Polling fallback (covers all edge cases) ──────────
  // ✅ FIXED: now clears the interval as soon as socket is found
  // instead of running 100 times unnecessarily.
  var pollCount = 0;
  var poll = setInterval(function () {
    pollCount++;
    var sock = window._ssSocket || window.socket || null;
    if (sock) {
      attachToSocket(sock);
      clearInterval(poll); // ✅ stop polling once socket is hooked
    }
    if (pollCount >= 100) clearInterval(poll); // safety stop after 10s
  }, 100);

  document.addEventListener("DOMContentLoaded", function () {
    var sock = window._ssSocket || window.socket || null;
    if (sock) attachToSocket(sock);
  });
  window.addEventListener("load", function () {
    var sock = window._ssSocket || window.socket || null;
    if (sock) attachToSocket(sock);
  });

  // ── 8. Fetch interceptor (fallback for inactive tabs) ────
  var _origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (_origFetch) {
    window.fetch = function () {
      var args = arguments;
      return _origFetch.apply(window, args).then(function (response) {
        try {
          response.clone().json().then(function (data) {
            // ✅ Only trigger if BOTH suspended:true AND userId matches
            // Prevents false positives from other API responses
            if (data && data.suspended === true && data.success === false) {
              var myId = getMyUserId();
              if (!data.userId || (myId && String(data.userId) === myId)) {
                triggerSuspension();
              }
            }
          }).catch(function () {});
        } catch (e) {}
        return response;
      });
    };
  }

})();