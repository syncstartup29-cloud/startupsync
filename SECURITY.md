# StartupSync — Security Policy & Documentation
**Version:** Final Production | **Stack:** Node.js · Express · MongoDB Atlas · Socket.IO · Cloudinary

---

## 1. SERVER.JS SECURITY LAYERS (Lines 14–18 and beyond)

### Layer 1 — Environment Variable Validation (Lines 14–18)
```javascript
if (!process.env[key]) {
  console.error(`❌ Missing required env variable: ${key}`);
  process.exit(1);
}
```
The server **immediately exits** on startup if any required environment variable is missing. This prevents the application from running in a misconfigured state where secrets are undefined. Variables validated: `MONGO_URI`, `JWT_SECRET`, `ADMIN_SECRET`, `EMAIL_USER`, `EMAIL_PASS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

### Layer 2 — HTTP Security Headers (Helmet)
```javascript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));
```
Helmet sets ~12 HTTP security headers automatically including `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection`, `Strict-Transport-Security`, `Referrer-Policy`, and `Permissions-Policy`. CSP is disabled for local development compatibility — enable on production with HTTPS.

### Layer 3 — CORS Locked to Domain
```javascript
app.use(cors({ origin: ALLOWED_ORIGIN, credentials: true }));
```
Cross-Origin Resource Sharing is restricted to `FRONTEND_URL` from environment variables. No wildcard (`*`) origins allowed. Credentials enabled for cookie-based flows.

### Layer 4 — Request Logging
```javascript
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
```
All HTTP requests logged in `combined` format on production (includes IP, user agent, response time) and `dev` format locally. Essential for detecting attack patterns and anomalies.

### Layer 5 — Response Compression
```javascript
app.use(compression({ level: 6, threshold: 1024 }));
```
Compresses responses above 1KB. Reduces bandwidth and improves performance.

### Layer 6 — JSON Body Size Limit
```javascript
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
```
Global JSON body capped at 2MB. Prevents memory exhaustion via oversized request bodies. File uploads handled separately via `multer` with 200MB limit (intentional for pitch videos via Cloudinary).

### Layer 7 — NoSQL Injection Prevention
```javascript
function sanitizeKeys(obj) {
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) { delete obj[key]; }
    else sanitizeKeys(obj[key]);
  }
}
if (req.body) sanitizeKeys(req.body);
```
Global middleware strips all MongoDB operator keys (`$where`, `$gt`, etc.) and dot-notation keys from every request body before any route handler runs. Prevents NoSQL injection attacks.

### Layer 8 — Rate Limiting (Three Tiers)
```javascript
const otpLimiter     = rateLimit({ windowMs: 10*60*1000, max: 5 });   // OTP routes
const loginLimiter   = rateLimit({ windowMs: 15*60*1000, max: 10 });  // Auth routes
const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 2000 }); // All routes
```
Three-tier rate limiting:
- OTP endpoints: 5 requests per IP per 10 minutes (prevents OTP brute force)
- Login/signup endpoints: 10 requests per IP per 15 minutes (prevents credential stuffing)
- All other endpoints: 2000 requests per IP per 15 minutes (prevents general abuse)
- Additionally: per-email OTP cooldown of 60 seconds (prevents inbox flooding via rotating proxies)

### Layer 9 — Socket.IO JWT Verification
```javascript
io.use((socket, next) => {
  const { userId, token } = socket.handshake.auth || {};
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded.userId !== userId) return next(new Error("Token mismatch"));
  socket.userId = userId;
  next();
});
```
Every WebSocket connection verified with JWT. Callers cannot join another user's room without a valid matching token. Prevents socket room spoofing.

### Layer 10 — bcrypt Password Hashing
```javascript
const hashed = await bcrypt.hash(password, 10);
await bcrypt.compare(password, user.password);
```
All passwords hashed with bcrypt at cost factor 10. Passwords never stored or logged in plaintext. Hash comparison used on every login attempt.

### Layer 11 — JWT Authentication
```javascript
return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
```
JWT signed with `JWT_SECRET` (minimum 32 characters enforced). 7-day expiry. Single-session enforcement via `activeSessionToken` — new login invalidates all previous tokens.

### Layer 12 — Auth Middleware (Every Protected Route)
Every one of the 40+ protected API routes passes through `authMiddleware` which:
- Verifies JWT signature and expiry
- Blocks deleted accounts (user not found → 401)
- Blocks suspended accounts (isSuspended → 403 with `suspended: true`)
- Validates `activeSessionToken` — rejects stolen or expired tokens
- Updates `lastActiveAt` throttled to once per 2 minutes

### Layer 13 — MongoDB ObjectId Validation
```javascript
if (!mongoose.Types.ObjectId.isValid(id))
  return res.json({ success: false, message: "Invalid user ID" });
```
All route parameters and body IDs validated before any DB query. Prevents invalid ObjectId crashes and enumeration attacks.

### Layer 14 — Admin JWT Authentication (Separate from User Auth)
```javascript
const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "8h" });
jwt.verify(tokenHeader, JWT_SECRET);
if (!decoded.admin) throw new Error("Not admin");
```
Admin panel uses a separate short-lived JWT (8h expiry). Raw `ADMIN_SECRET` never exposed in responses. Admin token sent via `x-admin-token` header (not Authorization). All admin routes gated by `adminAuth` middleware.

### Layer 15 — Sensitive Field Exclusion
```javascript
User.findById(id).select("-password -recoveryPin").lean()
delete safeUser.password;
delete safeUser.recoveryPin;
delete safeUser.activeSessionToken;
```
`password`, `recoveryPin`, and `activeSessionToken` are never returned in any API response. Double protection: `.select()` at DB level + manual `delete` before sending.

### Layer 16 — Socket.IO Room Scoping
```javascript
io.to(`user:${userId}`).emit("user:suspended", { userId });
io.to(`user:${connId}`).emit("account:deleted", { ... });
```
All sensitive real-time events emitted only to the specific user's room. No global `io.emit()` for security events. Prevents userId leakage to all connected clients.

### Layer 17 — File Upload Security
```javascript
const fileWhitelist = ['image/jpeg','image/png','image/gif','image/webp',
                       'application/pdf','video/mp4','video/webm',
                       'text/plain','application/msword'];
```
MIME type whitelist on chat file uploads. Screenshot uploads restricted to image types only. Files never stored on local disk permanently — streamed directly to Cloudinary. Cloudinary provides its own virus scanning and CDN security.

### Layer 18 — Graceful Shutdown & DB Connection Safety
```javascript
process.on("SIGTERM", () => {
  server.close(() => {
    mongoose.connection.close(false);
    process.exit(0);
  });
});
```
Graceful shutdown on `SIGTERM` and `SIGINT`. HTTP server stops accepting new connections before MongoDB disconnects. Prevents data corruption from abrupt termination. MongoDB connection pool limited to 10 (`maxPoolSize: 10`) with 5-second server selection timeout.

---

## 2. FRONTEND SECURITY

### Session Guard (session-guard.js)
- JWT passed in socket auth for server-side verification
- `auth:forceLogout` forces page redirect when new login detected on another device
- Back-forward cache restore check prevents stale authenticated pages
- `_ss_loggingOut` flag prevents guard from triggering during intentional logout
- Session validity check via `/session/check` endpoint fires 5 seconds after page load

### Suspension Screen (suspension-screen.js)
- `user:suspended` socket event filtered by userId (AND logic — no false positives)
- Fetch interceptor catches `{ suspended: true }` from any API response
- localStorage and sessionStorage cleared before showing overlay
- History stack poisoned to prevent back navigation after suspension
- 10-second countdown before redirect to login

### Custom UI (custom-ui.js)
- Native `alert()`, `confirm()`, `prompt()` replaced with styled async modals
- Prevents browser default dialogs that could be spoofed or blocked
- All callers use `await` correctly — no synchronous confirm pattern

### Inline Event Handler Policy
All `onclick="window.location.href='...'"` inline handlers replaced with `data-nav` attributes and `addEventListener` to comply with browser Content Security Policy restrictions. No eval() or Function() constructor usage anywhere.

---

## 3. DATABASE SECURITY

### MongoDB Atlas
- Connection string stored in `MONGO_URI` environment variable only — never in code
- Connection pool limited to 10 concurrent connections
- All queries use Mongoose with schema validation
- `.lean()` used on read queries — returns plain objects, not Mongoose documents (faster, less memory)
- `$addToSet` used instead of `$push` where uniqueness matters (prevents duplicate entries)

### Schema-Level Protection
- `recoveryPin` field: `immutable: true` — set once at signup, never changeable
- `recoveryPin` field: `sparse: true, unique: true` — prevents duplicates while allowing `undefined`
- Notifications array: capped at 100 via validator + pre-save hook
- Email field: `lowercase: true` — normalized before storage, prevents case-variation duplicates
- Phone field: 10-digit regex validation at schema level

### Index Strategy
All indexes designed to support query patterns without over-indexing. Sparse indexes used for optional fields (photo) to avoid indexing null values. Compound indexes cover multi-field filter queries in a single scan.

---

## 4. ENVIRONMENT VARIABLES

All secrets managed via environment variables. Never commit `.env` to version control.

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URI` | MongoDB Atlas connection string | ✅ Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | ✅ Yes |
| `ADMIN_SECRET` | Admin panel password | ✅ Yes |
| `EMAIL_USER` | Gmail address for OTP sending | ✅ Yes |
| `EMAIL_PASS` | Gmail App Password | ✅ Yes |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier | ✅ Yes |
| `CLOUDINARY_API_KEY` | Cloudinary API key | ✅ Yes |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | ✅ Yes |
| `FRONTEND_URL` | Allowed CORS origin | ✅ Yes |
| `NODE_ENV` | Runtime environment (`production`) | ✅ Yes |
| `PORT` | Server port (default 3000) | Optional |

**Generating secure secrets:**
```bash
# JWT_SECRET (48 bytes):
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"

# ADMIN_SECRET (24 bytes):
node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
```

---

## 5. PRE-DEPLOYMENT CHECKLIST

- [ ] All environment variables set on host (not in `.env` file committed to repo)
- [ ] `NODE_ENV=production` set
- [ ] `FRONTEND_URL` set to actual HTTPS domain
- [ ] HTTPS/TLS enabled (Render, Railway, or Nginx + Let's Encrypt)
- [ ] MongoDB Atlas IP whitelist configured
- [ ] Cloudinary upload presets configured with size limits
- [ ] Gmail App Password generated (not account password)
- [ ] `npm audit` run — no high/critical vulnerabilities
- [ ] Helmet CSP re-enabled with proper directives for production

---

## 6. INCIDENT RESPONSE

### Suspected Account Compromise
1. Admin panel → find user → suspend immediately (triggers `user:suspended` socket event)
2. Delete user record if confirmed
3. If JWT_SECRET compromised: rotate in environment variables and restart server (invalidates ALL sessions)

### Suspected Admin Panel Breach
1. Rotate `ADMIN_SECRET` immediately
2. Rotate `JWT_SECRET` (invalidates admin JWT + all user sessions)
3. Check server logs for unusual `/admin/*` requests

### Data Breach
1. Take server offline
2. Revoke MongoDB Atlas credentials
3. Rotate all environment variables
4. Assess scope: passwords are bcrypt-hashed (safe), emails and profile data may be exposed

---

## 7. SECURITY CONTACTS

Support: `syncstartup29@gmail.com`

For responsible disclosure of security vulnerabilities, email the above address with subject `[SECURITY] StartupSync Vulnerability Report`. Please allow 72 hours for response before public disclosure.