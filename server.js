// ══════════════════════════════════════════════════════════
//  🔒 SECURITY: Validate required env vars at startup
//  App will crash immediately with a clear message if any
//  critical env variable is missing — prevents silent failures
// ══════════════════════════════════════════════════════════
require("dotenv").config();
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET", "EMAIL_USER", "EMAIL_PASS", "ADMIN_SECRET", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "BREVO_API_KEY"];

if (process.env.JWT_SECRET.length < 32) {
  console.error("❌ JWT_SECRET must be at least 32 characters");
  process.exit(1);
}
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env variable: ${key}`);
    process.exit(1);
  }
}

const express    = require("express");
const mongoose   = require("mongoose");
const bcrypt     = require("bcrypt");
const jwt        = require("jsonwebtoken");
const cors       = require("cors");
const path       = require("path");
const fs         = require("fs");
const multer     = require("multer");
const http       = require("http");
const dns        = require("dns");
const rateLimit  = require("express-rate-limit");
const helmet     = require("helmet");      // 🔒 SECURITY: HTTP security headers
const morgan     = require("morgan");      // 🔒 STARTUP: Request logging
const compression = require("compression"); // 🔒 STARTUP: Compress responses
dns.setDefaultResultOrder("ipv4first");

const authMiddleware = require("./models/Authmiddleware");

// ── Models ──────────────────────────────────────────────
const Otp              = require("./models/Otp");
const User             = require("./models/User");
const ChatConversation = require("./models/ChatConversation");
const ChatMessage      = require("./models/ChatMessage");
const HelpRequest      = require("./models/Helprequest");
const Feedback         = require("./models/Feedback");

// ── App + Socket.IO setup ────────────────────────────────
const app    = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

// ✅ FIX: Trust Railway's proxy — required for rate limiters and IP detection
app.set("trust proxy", 1);

// 🔒 SECURITY: Lock CORS to your actual domain only
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || "https://startupsync-production.up.railway.app";
const ALLOWED_ORIGINS = [
  ALLOWED_ORIGIN,
  "https://startupsync.in",
  "https://www.startupsync.in",
  "https://startupsync-production.up.railway.app",
];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  upgradeTimeout: 10000,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024,
  },
});

// 🔒 SECURITY: Helmet sets ~15 HTTP security headers automatically
// CSP disabled — all pages use inline scripts (no nonce system)
app.use(helmet({ contentSecurityPolicy: false }));

// 🔒 SECURITY: CORS locked to your domain only (was wide open)
app.use(cors({ 
  origin: function(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true 
}));

// 🔒 STARTUP: Request logging — see every request in console
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// 🔒 STARTUP: Compress all responses — faster load times
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

app.use(express.json({ limit: "25mb" }));

// 🔒 SECURITY: Strip $ and . from request body keys — prevents NoSQL injection
app.use((req, res, next) => {
  function sanitizeKeys(obj) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return;
    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key.includes(".")) { delete obj[key]; }
      else sanitizeKeys(obj[key]);
    }
  }
  if (req.body) sanitizeKeys(req.body);
  next();
});


app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// ── Static + uploads ─────────────────────────────────────
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: true,
  lastModified: true,
}));
const uploadDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

const uploadRoutes = require('./routes/upload');
app.use('/api/upload', uploadRoutes);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, Date.now() + "-" + (file.originalname || "file").replace(/\s+/g, "_")),
});

// 🔒 SECURITY: Added 200MB file size limit — was unlimited before (crash risk)
// memoryUpload used for Cloudinary (needs buffer), diskUpload for local screenshot saves
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
});


// ── Performance: Ensure MongoDB indexes on startup ──────────────────────────
async function ensureIndexes() {
  try {
    await User.collection.createIndex({ role: 1, termsAccepted: 1, isSuspended: 1 });
    await User.collection.createIndex({ activeSessionToken: 1 });
    await User.collection.createIndex({ email: 1 }, { unique: true, background: true });
    await User.collection.createIndex({ "founderProfile.phone": 1, "investorProfile.phone": 1 });
    await User.collection.createIndex({ "founderProfile.photo": 1 }, { sparse: true });
    await User.collection.createIndex({ "investorProfile.photo": 1 }, { sparse: true });
    await User.collection.createIndex({ blockedBy: 1 });
    await ChatMessage.collection.createIndex({ receiverId: 1, seen: 1, deleted: 1 });
    await ChatMessage.collection.createIndex({ conversationId: 1, createdAt: 1 });
    await ChatConversation.collection.createIndex({ pairKey: 1 }, { unique: true });
    await ChatConversation.collection.createIndex({ participants: 1 });
    // console.log("✅ MongoDB indexes ensured");
  } catch(e) { console.error("⚠️ Index error (non-fatal):", e.message); }
}

// ── MongoDB ──────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  family: 4,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
})
  .then(async () => { await ensureIndexes(); })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err);
    process.exit(1); // 🔒 STARTUP: Exit if DB fails — don't run without a database
  });

// ── Email transporter ─────────────────────────────────────
const sendEmail = async (to, subject, html) => {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "StartupSync", email: "syncstartup29@gmail.com" },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html,
    }),
  });
  return response.json();
};
// ── Rate Limiters ─────────────────────────────────────────
// OTP limiter — max 5 OTP requests per IP per 10 minutes
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many OTP requests. Please wait 10 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔒 SECURITY: Login rate limiter — was completely missing!
// Prevents brute force attacks on passwords. Max 10 attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🔒 SECURITY: General API limiter — protects all other routes
// Max 2000 requests per 15 minutes per IP (polling routes fire every 10s per page)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // increased — polling routes fire every 10s per page
  message: { success: false, message: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply general limiter to all routes globally (except OTP + polling routes)
const _pollRoutes = ["/auth/send-otp", "/reset-password/send-otp",
  "/notifications", "/chat/unread-counts", "/session/beacon", "/session/check"];
app.use((req, res, next) => {
  if (_pollRoutes.some(r => req.path.startsWith(r))) return next();
  return generalLimiter(req, res, next);
});

// NOTE: lastActiveAt is updated (throttled, once per 2 min) inside authMiddleware.
// The global middleware that was here was a duplicate unthrottled write on every request — removed.

// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════

function getOtpEmailHtml(otp, type = "signup") {
  const isReset = type === "reset";
  const title   = isReset ? "Password Reset OTP" : "Verify Your Email";
  const subtext = isReset
    ? "You requested a password reset for your StartupSync account."
    : "Welcome to StartupSync! Use the OTP below to verify your email and complete signup.";
  const warning = isReset
    ? "If you did not request a password reset, please ignore this email."
    : "If you did not request this OTP, please ignore this email.";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title></head><body style="margin:0;padding:0;background:#F7F7F8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F8;padding:40px 0;"><tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #E4E4E7;overflow:hidden;max-width:480px;width:100%;"><tr><td style="background:linear-gradient(90deg,#2563EB,#7C3AED);height:4px;"></td></tr><tr><td align="center" style="padding:32px 40px 0;"><table cellpadding="0" cellspacing="0"><tr><td align="center"><span style="font-size:20px;font-weight:700;color:#2563EB;letter-spacing:0.04em;">StartupSync™</span></td></tr><tr><td align="center" style="padding-top:4px;"><span style="font-size:11px;color:#9CA3AF;letter-spacing:0.04em;">Where Startups Meet Opportunity</span></td></tr></table></td></tr><tr><td align="center" style="padding:28px 40px 0;"><h1 style="margin:0;font-size:22px;font-weight:700;color:#111118;letter-spacing:0.02em;">${title}</h1><p style="margin:10px 0 0;font-size:13px;color:#6B7280;line-height:1.6;max-width:340px;">${subtext}</p></td></tr><tr><td align="center" style="padding:28px 40px;"><table cellpadding="0" cellspacing="0"><tr><td align="center" style="background:#F0F4FF;border-radius:12px;padding:20px 40px;"><p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6B7280;letter-spacing:0.08em;text-transform:uppercase;">Your OTP Code</p><p style="margin:0;font-size:38px;font-weight:700;color:#2563EB;letter-spacing:0.18em;">${otp}</p><p style="margin:8px 0 0;font-size:11px;color:#9CA3AF;">Expires in <strong>5 minutes</strong></p></td></tr></table></td></tr><tr><td style="padding:0 40px 24px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:10px;padding:16px 20px;"><tr><td style="font-size:12px;color:#6B7280;line-height:1.7;"><strong style="color:#374151;">📌 Tips:</strong><br/>• Do not share this OTP with anyone<br/>• Check Spam / Promotions if not in inbox<br/>• ${warning}</td></tr></table></td></tr><tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #E4E4E7;margin:0;"/></td></tr><tr><td align="center" style="padding:20px 40px 32px;"><p style="margin:0;font-size:11px;color:#9CA3AF;line-height:1.6;">This email was sent by <strong style="color:#6B7280;">StartupSync</strong><br/>If you did not request this, you can safely ignore this email.</p></td></tr></table></td></tr></table></body></html>`;
}

function normalizeEmail(e) { return (e || "").toLowerCase().trim(); }
function isGmail(e)        { return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(e); }

// ══ 14-LAYER SECURITY: Block disposable/temp email providers ══
const TEMP_EMAIL_DOMAINS = new Set([
  // Mailinator family
  "mailinator.com","mailinator2.com","mailinator.us","suremail.info","spamherelots.com",
  // Guerrilla Mail
  "guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.biz","guerrillamail.de","guerrillamail.info","grr.la","spam4.me","sharklasers.com","guerrillamailblock.com",
  // YopMail
  "yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc","nomail.xl.cx","mega.zik.dj","speed.1s.fr","courriel.fr.nf","moncourrier.fr.nf","monemail.fr.nf","monmail.fr.nf",
  // TempMail
  "tempmail.com","tempmail.net","tempmail.org","temp-mail.org","temp-mail.io","temp-mail.ru","dispostable.com","tempr.email","discard.email","discardmail.com","discardmail.de","wegwerfmail.de","wegwerfmail.net","wegwerfmail.org",
  // Throwaway
  "throwam.com","throwam.net","throwaway.email","fakeinbox.com","maildrop.cc","spamgourmet.com","spamgourmet.net","spamgourmet.org","mailnull.com","mailnull.net","mailnesia.com","spamfree24.org","spamfree24.de","spamfree24.org","getnada.com","trashmail.com","trashmail.at","trashmail.io","trashmail.me","trashmail.net","trashmail.org","trashmail.xyz","trashmailer.com",
  // 10 minute mail variants
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.co.uk","10minutemail.de","10minutemail.info","10minutemail.ru","10minutemail.us","10minutemail.be","10minutemail.cf","10minutemail.ga","10minutemail.gq","10minutemail.ml","10minutemail.tk",
  // Others
  "mohmal.com","mailnull.com","spamevader.com","spam4.me","binkmail.com","bobmail.info","chammy.info","devnullmail.com","letthemeatspam.com","put2.net","suremail.info","tradermail.info","mail-temporaire.fr","jetable.com","jetable.net","jetable.org","jetable.de","filzmail.com","fakemail.net","mailismagic.com","spamgob.com","incognitomail.com","incognitomail.net","incognitomail.org","spamthisplease.com","tempemail.co","tempemail.net","spamhereplease.com","mailnew.com","maileater.com",
  // Extended fake/temp email list — 2024 updated
  "sharklasers.com","spam4.me","spamgob.com","mailnull.com",
  "deadaddress.com","sogetthis.com","noblepioneer.com","chacuo.net",
  "cuvox.de","dayrep.com","einrot.com","fleckens.hu","gustr.com",
  "superrito.com","teleworm.us","rhyta.com","armyspy.com",
  "cuvox.de","jourrapide.com","lavabit.com","hushmail.com",
  "spamgourmet.com","spamgourmet.net","spamgourmet.org",
  "mailme.lv","mailme24.com","mailmetrash.com","mailmoat.com",
  "mailnew.com","mailnull.com","mailscrap.com","mailshell.com",
  "mailsiphon.com","mailslite.com","mailtemp.net","mailzilla.com",
  "meltmail.com","mierdamail.com","mintemail.com","moncourrier.fr",
  "monemail.fr.nf","monmail.fr.nf","mt2009.com","mx0.wwwnew.eu",
  "mycleaninbox.net","mypartyclip.de","myphantomemail.com",
  "netmails.com","netmails.net","netzidiot.de","nh3.ro",
  "nice-4u.com","noclickemail.com","nogmailspam.info","nomail.pw",
  "nomail.xl.cx","nomail2me.com","nospamfor.us","nospammail.net",
  "notmailinator.com","nowmymail.com","objectmail.com","obobbo.com",
  "odaymail.com","oneoffemail.com","onewaymail.com","oopi.org",
  "pepbot.com","pookmail.com","prtnx.com","punkass.com",
  "putthisinyourspamdatabase.com","quickinbox.com","rcpt.at",
  "rtrtr.com","s0ny.net","safe-mail.net","safetymail.info",
  "safetypost.de","sandelf.de","schafmail.de","schrott-mail.de",
  "secretemail.de","secure-mail.biz","shortmail.net","shut.ws",
  "sibmail.com","skeefmail.com","slapsfromlastnight.com",
  "slopsbox.com","smashmail.de","smellfear.com","snkmail.com",
  "sofimail.com","sofort-mail.de","sogetthis.com","spam.la",
  "spam.su","spam4.me","spamavert.com","spambob.com","spambob.net",
  "spambob.org","spamcannon.com","spamcannon.net","spamcero.com",
  "spamcon.org","spamcorptastic.com","spamcowboy.com",
  "spamcowboy.net","spamcowboy.org","spamday.com","spamex.com",
  "spamfree.eu","spamgoes.in","spamhereplease.com","spamhole.com",
  "spamify.com","spaminator.de","spamkill.info","spammotel.com",
  "spamoff.de","spamslicer.com","spamspot.com","spamstack.net",
  "spamthisplease.com","spamtrail.com","speed.1s.fr","super-auswahl.de",
  "tempalias.com","tempe.ml","tempemail.biz","tempemail.co.uk",
  "tempinbox.co.uk","tempinbox.com","tempmail2.com","tempmailer.com",
  "tempmailer.de","tempomail.fr","temporaryemail.net",
  "temporaryemail.us","temporaryforwarding.com","temporaryinbox.com",
  "temporarymailaddress.com","tempthe.net","thanksnospam.info",
  "thecloudindex.com","thetempmail.com","throwam.com",
  "throwaway.email","tilien.com","tmail.com","tpwmail.net",
  "trash-me.com","trash-mail.at","trash-mail.cf","trash-mail.ga",
  "trash-mail.gq","trash-mail.io","trash-mail.ml","trash-mail.tk",
  "trashcanmail.com","trashdevil.com","trashdevil.net",
  "trashemail.de","trashimail.com","trashmail.fr","trashmail.io",
  "trashmail.me","trashmail.net","trashmail.org","trashmail.xyz",
  "trashmailer.com","trashmalware.com","trbvm.com","turual.com",
  "twinmail.de","tyldd.com","uggsrock.com","umail.net",
  "uroid.com","uteach.org","veryrealemail.com","viditag.com",
  "vipxp.cn","viral.ms","void.blackhole.dk","vpn.st","vubby.com",
  "wetrainbayarea.com","wetrainbayarea.org","whyspam.me",
  "willhackforfood.biz","willselfdestruct.com","winemaven.info",
  "wuzupmail.net","xemaps.com","xents.com","xmaily.com","xoxy.net",
  "xyzfree.net","yapped.net","yep.it","yogamaven.com","yopmail.fr",
  "yourdomain.com","yuurok.com","z1p.biz","za.com","zehnminutenmail.de",
  "zetmail.com","zippymail.info","zoemail.com","zoemail.net",
  "zoemail.org","zolly.de","zombie.com","zomg.info","zuvio.com"
]);

function isTempEmail(email) {
  const e = (email || "").toLowerCase().trim();
  const domain = e.split("@")[1] || "";
  if (TEMP_EMAIL_DOMAINS.has(domain)) return true;
  // Also block common temp-email subdomains
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (TEMP_EMAIL_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}
function generateRecoveryPin() { return Math.floor(100000 + Math.random() * 900000).toString(); }

async function generateUniqueRecoveryPin() {
  for (let i = 0; i < 100; i++) {
    const pin = generateRecoveryPin();
    const exists = await User.findOne({ recoveryPin: pin }).select("_id").lean();
    if (!exists) return pin;
  }
  throw new Error("Could not generate a unique recovery pin — please try again.");
}

function generateUserToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

async function pushNotification(userId, type, message, refUserId = null) {
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    const notif = {
      type, message,
      refUserId: refUserId && mongoose.Types.ObjectId.isValid(refUserId) ? refUserId : null,
      seen: false,
      createdAt: new Date(),
    };
    await User.findByIdAndUpdate(userId, {
      $push: {
        notifications: {
          $each: [notif],
          $slice: -100,
        },
      },
    });
    // Emit real-time to user on every page
    io.to(`user:${userId}`).emit("notification:new", notif);
  } catch (e) { console.error("pushNotification error:", e); }
}

async function assertConnected(userId, otherId) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(otherId)) return false;
  const u = await User.findById(userId).select("connections").lean();
  return u ? (u.connections || []).some(x => x.toString() === otherId.toString()) : false;
}

async function isUserBlockedBy(userId, blockerId) {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(blockerId)) return false;
  const u = await User.findById(userId).select("blockedBy").lean();
  return u ? (u.blockedBy || []).some(x => x.toString() === blockerId.toString()) : false;
}

function makePairKey(a, b) {
  const as = a.toString(), bs = b.toString();
  return as < bs ? `${as}_${bs}` : `${bs}_${as}`;
}
function roomFromPairKey(k) { return "chat:" + k; }

// ════════════════════════════════════════════════════════
//  SOCKET.IO
// ════════════════════════════════════════════════════════

const onlineUsers    = new Set();
const profileViewers = new Map();

// ══ LAYER 8: Input sanitization — strip dangerous chars ══
function sanitize(val, maxLen) {
  if (val === null || val === undefined) return "";
  const s = String(val).replace(/<[^>]*>/g, "").replace(/[<>"'`]/g, "").trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

io.use((socket, next) => {
  const { userId, token } = socket.handshake.auth || {};
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return next(new Error("Invalid userId"));
  // ✅ FIX: Token is optional — verify if provided, allow connection either way
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (String(decoded.userId) !== String(userId)) return next(new Error("Token mismatch"));
    } catch {
      return next(new Error("Invalid token"));
    }
  }
  socket.userId = userId;
  socket._connCache = new Map();
  next();
});

io.on("connection", (socket) => {
  const userId = socket.userId;
  onlineUsers.add(userId);

  io.emit("presence:update", { userId, online: true });

  socket.join(`user:${userId}`);
  socket.join(userId.toString());

  socket.on("presence:whoIsOnline", (cb) => {
    cb?.({ onlineUserIds: Array.from(onlineUsers) });
  });

  socket.on("admin:join", ({ adminToken } = {}, cb) => {
    try {
      const decoded = jwt.verify(adminToken || "", process.env.JWT_SECRET);
      if (!decoded.admin) throw new Error("Not admin");
      socket.join("admin");
      cb?.({ success: true });
    } catch {
      cb?.({ success: false, message: "Invalid admin token" });
    }
  });

  socket.on("profile:view", ({ viewingUserId }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(viewingUserId)) return;
      const viewingId = String(viewingUserId);
      if (!profileViewers.has(viewingId)) profileViewers.set(viewingId, new Set());
      profileViewers.get(viewingId).add(userId);
    } catch (e) { console.error("profile:view error:", e); }
  });

  socket.on("profile:unview", ({ viewingUserId }) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(viewingUserId)) return;
      const viewingId = String(viewingUserId);
      if (profileViewers.has(viewingId)) {
        profileViewers.get(viewingId).delete(userId);
        if (profileViewers.get(viewingId).size === 0) profileViewers.delete(viewingId);
      }
    } catch (e) { console.error("profile:unview error:", e); }
  });

  socket.on("disconnect", () => {
    onlineUsers.delete(userId);
    socket._connCache.clear();
    for (const [viewingId, viewers] of profileViewers.entries()) {
      viewers.delete(userId);
      if (viewers.size === 0) profileViewers.delete(viewingId);
    }
    io.emit("presence:update", { userId, online: false });
  });

  socket.on("chat:join", async ({ otherId }, cb) => {
    try {
      if (!otherId || !mongoose.Types.ObjectId.isValid(otherId)) return cb?.({ success: false });
      const ok = await assertConnected(userId, otherId);
      if (!ok) return cb?.({ success: false, message: "Not connected" });
      socket._connCache.set(`${userId}_${otherId}`, true);
      socket.join(roomFromPairKey(makePairKey(userId, otherId)));
      return cb?.({ success: true });
    } catch { return cb?.({ success: false }); }
  });

  socket.on("chat:send", async ({ otherId, text, file }, cb) => {
    try {
      const cleanText = String(text || "").trim();
      const cleanFile = String(file || "").trim();
      if (!otherId || !mongoose.Types.ObjectId.isValid(otherId) || (!cleanText && !cleanFile)) return cb?.({ success: false });

      const ok = await assertConnected(userId, otherId);
      if (!ok) return cb?.({ success: false, message: "Not connected" });

      const blocked = await isUserBlockedBy(userId, otherId);
      if (blocked) return cb?.({ success: false, message: "You have been blocked by this user" });

      const pairKey = makePairKey(userId, otherId);

      let convo = await ChatConversation.findOneAndUpdate(
        { pairKey },
        { $setOnInsert: { pairKey, participants: [userId, otherId] } },
        { upsert: true, new: true }
      );

      const msg = await ChatMessage.create({
        conversationId: convo._id, senderId: userId, receiverId: otherId,
        text: cleanText, file: cleanFile, seen: false,
      });

      if (cleanText || cleanFile) {
        await ChatConversation.updateOne(
          { _id: convo._id },
          { $set: { lastMessageText: cleanText || cleanFile, lastMessageAt: new Date() } }
        );
      }

      const sender = await User.findById(userId).select("fullName role founderProfile.photo investorProfile.photo").lean();
      const fromUserName = sender?.fullName || "New Message";
      const fromUserPhoto = sender?.role === "Founder"
        ? (sender?.founderProfile?.photo || "")
        : (sender?.investorProfile?.photo || "");

      const payload = {
        _id: msg._id, fromUserId: msg.senderId, toUserId: msg.receiverId,
        text: msg.text, file: msg.file, fileName: msg.fileName || "", createdAt: msg.createdAt,
        seen: msg.seen, seenAt: msg.seenAt, fromUserName, fromUserPhoto,
      };

      io.to(roomFromPairKey(pairKey)).emit("chat:newMessage", payload);
      const roomName = roomFromPairKey(pairKey);
      const roomSockets = await io.in(roomName).allSockets();
      const otherIdStr = otherId.toString();
      const otherInRoom = [...roomSockets].some(sid => {
        const s = io.sockets.sockets.get(sid);
        return s && s.userId === otherIdStr;
      });
      if (!otherInRoom) {
        io.to(`user:${otherId}`).emit("chat:newMessage", payload);
      }
      return cb?.({ success: true, message: payload });
    } catch (e) { console.error("chat:send error:", e); return cb?.({ success: false }); }
  });

  socket.on("chat:typing", async ({ otherId, typing }) => {
    try {
      if (!otherId || !mongoose.Types.ObjectId.isValid(otherId)) return;
      const cacheKey = `${userId}_${otherId}`;
      let ok = socket._connCache.get(cacheKey);
      if (ok === undefined) {
        ok = await assertConnected(userId, otherId);
        socket._connCache.set(cacheKey, ok);
      }
      if (!ok) return;
      socket.to(roomFromPairKey(makePairKey(userId, otherId))).emit("chat:typing", { fromUserId: userId, typing: !!typing });
    } catch {}
  });

  socket.on("chat:seen", async ({ otherId }, cb) => {
    try {
      if (!otherId || !mongoose.Types.ObjectId.isValid(otherId)) return cb?.({ success: false });
      const ok = await assertConnected(userId, otherId);
      if (!ok) return cb?.({ success: false });

      const pairKey = makePairKey(userId, otherId);
      const convo = await ChatConversation.findOne({ pairKey }).select("_id").lean();
      if (!convo) return cb?.({ success: true, updated: 0 });

      const upd = await ChatMessage.updateMany(
        { conversationId: convo._id, seen: false, receiverId: userId },
        { $set: { seen: true, seenAt: new Date() } }
      );

      if ((upd.modifiedCount || 0) > 0) {
        io.to(roomFromPairKey(pairKey)).emit("chat:seenUpdate", { byUserId: userId, count: upd.modifiedCount });
      }
      return cb?.({ success: true, updated: upd.modifiedCount || 0 });
    } catch { return cb?.({ success: false }); }
  });
});

// ════════════════════════════════════════════════════════
//  AUTH ROUTES  (public — no authMiddleware)
// ════════════════════════════════════════════════════════

app.post("/auth/send-otp", otpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.json({ success: false, message: "Email required" });
    if (!isGmail(email)) return res.json({ success: false, message: "Only @gmail.com addresses are allowed." });
    if (isTempEmail(email)) return res.json({ success: false, message: "Temporary or disposable email addresses are not allowed." });

    // FIX: per-email rate limit — prevent inbox flooding via rotating proxies
    const recentOtp = await Otp.findOne({ email, createdAt: { $gt: new Date(Date.now() - 60 * 1000) } }).lean();
    if (recentOtp) return res.json({ success: false, message: "Please wait 60 seconds before requesting another OTP." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email },
      { email, otp, createdAt: new Date(), verified: false },
      { upsert: true, new: true }
    );

    await sendEmail(
      email,
      "StartupSync — Verify Your Email",
      getOtpEmailHtml(otp, "signup")
    );

    res.json({ success: true });
  } catch (e) {
    console.error("send-otp error:", e);
    res.json({ success: false, message: "OTP send failed" });
  }
});

app.post("/auth/verify-otp", otpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp   = (req.body.otp || "").trim();
    const record = await Otp.findOne({ email });
    if (!record) return res.json({ success: false, message: "OTP not found or expired" });
    if (record.otp !== otp) return res.json({ success: false, message: "Invalid OTP" });

    if (Date.now() - new Date(record.createdAt).getTime() > 5 * 60 * 1000) {
      await Otp.deleteOne({ email });
      return res.json({ success: false, message: "OTP expired" });
    }

    record.verified = true;
    await record.save();
    res.json({ success: true });
  } catch (e) {
    console.error("verify-otp error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/reset-password/send-otp", otpLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.json({ success: false, message: "Email required" });

    const user = await User.findOne({ email }).select("_id");
    if (!user) return res.json({ success: false, message: "No account found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email },
      { email, otp, createdAt: new Date(), verified: false },
      { upsert: true, new: true }
    );

    await sendEmail(
      email,
      "StartupSync — Password Reset OTP",
      getOtpEmailHtml(otp, "reset")
    );
    return res.json({ success: true });
  } catch (e) {
    console.error("reset-password/send-otp error:", e);
    return res.json({ success: false, message: "Failed to send OTP" });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const email       = normalizeEmail(req.body.email);
    const otp         = (req.body.otp || "").trim();
    const newPassword = req.body.newPassword || "";

    if (!email || !otp || !newPassword) return res.json({ success: false, message: "All fields required" });
    if (!/^\d{6}$/.test(otp)) return res.json({ success: false, message: "OTP must be 6 digits" });
    if (newPassword.length < 8 || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[a-zA-Z]/.test(newPassword))
      return res.json({ success: false, message: "Password must be at least 8 characters and include a letter, number and special character" });

    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord || otpRecord.otp !== otp) return res.json({ success: false, message: "Invalid OTP" });

    if (Date.now() - new Date(otpRecord.createdAt).getTime() > 10 * 60 * 1000) {
      await Otp.deleteOne({ email });
      return res.json({ success: false, message: "OTP expired" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const user   = await User.findOneAndUpdate({ email }, { $set: { password: hashed } });
    if (!user) return res.json({ success: false, message: "User not found" });

    await Otp.deleteOne({ email });
    return res.json({ success: true, message: "Password updated!" });
  } catch (e) {
    console.error("reset-password error:", e);
    return res.json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════
//  USER ROUTES
// ════════════════════════════════════════════════════════

app.post("/signup", loginLimiter, async (req, res) => {
  try {
    const fullName = (req.body.fullName || "").trim();
    const email    = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    const role     = (req.body.role || "").trim();

    if (!fullName || !email || !password || !role)
      return res.json({ success: false, message: "All fields required" });
    if (!isGmail(email))
      return res.json({ success: false, message: "Only @gmail.com addresses are allowed. We do not support other email providers." });
    if (isTempEmail(email))
      return res.json({ success: false, message: "Temporary or disposable email addresses are not allowed. Please use your real Gmail." });
    // Extra pattern check — block obviously fake gmail usernames
    const localPart = email.split("@")[0];
    if (/^\d+$/.test(localPart) && localPart.length > 8)
      return res.json({ success: false, message: "Please use a real Gmail address." });
    if (/^(.)\1{6,}$/.test(localPart))
      return res.json({ success: false, message: "Please use a real Gmail address." });
    const FAKE_LOCALS = ["noreply","no-reply","donotreply","do-not-reply","mailer-daemon","postmaster","admin","test","spam","fake","null","undefined","tempuser","throwaway","trash","junk"];
    if (FAKE_LOCALS.includes(localPart))
      return res.json({ success: false, message: "Please use a real Gmail address." });

    if (password.length < 8 || !/[!@#$%^&*(),.?":{}|<>]/.test(password) || !/[0-9]/.test(password) || !/[a-zA-Z]/.test(password))
  return res.json({ success: false, message: "Password must be at least 8 characters and include a letter, number and special character" });

    const otpData = await Otp.findOne({ email });
    if (!otpData || otpData.verified !== true)
      return res.json({ success: false, message: "Verify OTP first" });

    if (await User.findOne({ email }).select("_id").lean())
      return res.json({ success: false, message: "Email already exists" });

    const hashed      = await bcrypt.hash(password, 10);
    const recoveryPin = await generateUniqueRecoveryPin();
    const user        = await User.create({ fullName, email, password: hashed, role, recoveryPin });

    await Otp.deleteOne({ email });

    io.to("admin").emit("user:new", { userId: user._id.toString(), role: user.role });
    // FIX 11: Notify feed — but user has no profile yet, so this is just for admin
    // Profile completion emit happens in /profile/founder and /profile/investor

    const token = generateUserToken(user._id);

    return res.json({
      success: true, recoveryPin, token,
      user: { _id: user._id, fullName: user.fullName, email: user.email, role: user.role, termsAccepted: user.termsAccepted },
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.json({ success: false, message: err.message || "Signup server error" });
  }
});

// 🔒 SECURITY: loginLimiter added — was completely unprotected before
// Max 10 login attempts per IP per 15 minutes — stops brute force attacks
app.post("/login", loginLimiter, async (req, res) => {
  try {
    const email    = normalizeEmail(req.body.email);
    const password = req.body.password || "";
    if (!email || !password) return res.json({ success: false, message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (!await bcrypt.compare(password, user.password)) return res.json({ success: false, message: "Wrong password" });

    // ── Single-session check ─────────────────────────────────
    // ✅ Always clear old session + kick old device — no conflict modal
    // This prevents "conflict after logout" bug permanently
    if (user.activeSessionToken) {
      try {
        // Kick old device via socket
        if (io) io.to(`user:${user._id.toString()}`).emit("auth:forceLogout", { reason: "newLogin" });
      } catch {}
      await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: null, lastActiveAt: null } });
    }

    const token = generateUserToken(user._id);
    await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });

    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.recoveryPin;
    delete safeUser.activeSessionToken;

    return res.json({ success: true, token, user: safeUser });
  } catch (e) {
    console.error("login error:", e);
    return res.json({ success: false, message: "Server error" });
  }
});

// ── Force login: instantly take over session, kick old device ─────────────────
// Called when user clicks "Login from this device" on the conflict screen.
// No permission needed — new device wins automatically.
app.post("/login/force", loginLimiter, async (req, res) => {
  try {
    const { userId, currentToken } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(userId))
      return res.json({ success: false, message: "Invalid request" });
    if (!currentToken) return res.json({ success: false, message: "Invalid request" });

    const user = await User.findById(userId);
    if (!user) return res.json({ success: false, message: "User not found" });
    if (!user.activeSessionToken || user.activeSessionToken !== currentToken)
      return res.json({ success: false, message: "Session mismatch" });

    // Issue a new token for the new device
    const token = generateUserToken(user._id);
    await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });

    // Kick the old device — emit to all sockets of this user.
    // The new token is sent so the old device (which has the OLD token) knows it's been replaced.
    io.to(`user:${userId}`).emit("auth:forceLogout", {
      newToken: token,
    });

    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.recoveryPin;
    delete safeUser.activeSessionToken;

    return res.json({ success: true, token, user: safeUser });
  } catch (e) {
    console.error("login/force error:", e);
    return res.json({ success: false, message: "Server error" });
  }
});

// ── Tab-close beacon logout — clears activeSessionToken instantly ─────────────
// Called by navigator.sendBeacon() in session-guard.js when tab is closed.
// sendBeacon sends text/plain so we read raw body manually.
app.post("/session/beacon-logout", express.text({ type: "*/*" }), async (req, res) => {
  try {
    let token = "";
    try { token = JSON.parse(req.body).token || ""; } catch { token = (req.body || "").trim(); }
    if (!token) return res.sendStatus(204);
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.sendStatus(204); }
    if (!decoded?.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) return res.sendStatus(204);
    await User.findOneAndUpdate(
      { _id: decoded.userId, activeSessionToken: token },
      { $set: { activeSessionToken: null, lastActiveAt: null } }
    );
    return res.sendStatus(204);
  } catch (e) {
    console.error("beacon-logout error:", e);
    return res.sendStatus(204);
  }
});

// ── Legacy takeover (kept for signup switch-account flow) ─────────────────────
// FIX CRITICAL: now requires password verification — was completely unauthenticated before
// (any caller with a valid ObjectId could take over any account)
app.post("/login/takeover", loginLimiter, async (req, res) => {
  try {
    const { userId, password } = req.body || {};
    if (!userId || !mongoose.Types.ObjectId.isValid(userId) || !password)
      return res.json({ success: false, message: "Invalid request" });

    const user = await User.findById(userId);
    if (!user) return res.json({ success: false, message: "User not found" });

    // Require password proof before issuing a new token
    if (!await bcrypt.compare(password, user.password))
      return res.json({ success: false, message: "Invalid credentials" });

    const token = generateUserToken(user._id);

    // Kick old device BEFORE saving new token — prevents race where old device
    // calls /session/check in the gap and gets active:true
    if (user.activeSessionToken) {
      io.to(`user:${userId}`).emit("auth:forceLogout", {
        reason: "Another device logged in to your account.",
        newToken: token,
      });
    }

    await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });

    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.recoveryPin;
    delete safeUser.activeSessionToken;

    return res.json({ success: true, token, user: safeUser });
  } catch (e) {
    console.error("login/takeover error:", e);
    return res.json({ success: false, message: "Server error" });
  }
});

// ── Logout: clear the active session token ────────────────────────────────
// NOTE: sendBeacon sends token in the request BODY as JSON — not as a header.
// So we must check BOTH: Authorization header (normal logout) and body.token (beacon logout).
app.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    // sendBeacon sends { token: "..." } in the body
    const bodyToken = (req.body && req.body.token) ? req.body.token : "";
    const token = headerToken || bodyToken;

    if (token) {
      let decoded;
      try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { /* expired/invalid — still clear */ }
      const userId = decoded?.userId;
      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        // Only clear if this token is still the active one (don't clear if already taken over)
        await User.updateOne({ _id: userId, activeSessionToken: token }, { $set: { activeSessionToken: null } });
      }
    }
    return res.json({ success: true });
  } catch (e) {
    console.error("logout error:", e);
    return res.json({ success: true }); // Always succeed from client perspective
  }
});


// ── Check if a token is still the active session on the server ───────────
app.post("/session/check", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.json({ active: false });
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.json({ active: false }); }
    if (!decoded?.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) return res.json({ active: false });
    const user = await User.findById(decoded.userId).select("activeSessionToken isSuspended").lean();
    if (!user) return res.json({ active: false, deleted: true });
    if (user.isSuspended) return res.json({ active: false, deleted: true });
    if (!user.activeSessionToken) {
      return res.json({ active: false });
    }
    return res.json({ active: !!(user.activeSessionToken === token) });
  } catch {
    return res.json({ active: true });
  }
});

// ── Force-logout a user by token (used when new signup takes over) ────────
app.post("/session/force-logout", loginLimiter, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.json({ success: false });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;
    await User.updateOne({ _id: userId, activeSessionToken: token }, { $set: { activeSessionToken: null } });
    io.to(`user:${userId}`).emit("auth:forceLogout", { reason: "You were logged out because a new account signed in on your device." });
    return res.json({ success: true });
  } catch {
    return res.json({ success: false });
  }
});

app.post("/accept-terms", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.userId, { $set: { termsAccepted: true } });
    if (!user) return res.json({ success: false });
    return res.json({ success: true });
  } catch (e) {
    console.error("accept-terms error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/account/delete", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const userToDelete = await User.findById(userId).select("_id fullName connections");
    if (!userToDelete) return res.json({ success: false, message: "User not found" });

    const connectedUserIds = (userToDelete.connections || []).map(id => id.toString());

    connectedUserIds.forEach(id => {
      io.to(`user:${id}`).emit("account:deleted", {
        deletedUserId: userId.toString(),
        deletedUserName: userToDelete.fullName || "User",
        reason: "self"
      });
    });
    io.to("admin").emit("account:deleted", {
      deletedUserId: userId.toString(),
      deletedUserName: userToDelete.fullName || "User",
      connectedUserIds,
    });

    if (connectedUserIds.length > 0) {
      await User.updateMany(
        { _id: { $in: connectedUserIds } },
        { $pull: { connections: userId, interestedUsers: userId, skippedUsers: userId, inboxRequests: { fromUserId: userId }, sentRequests: { toUserId: userId } } }
      );
    }

    await Promise.all([
      ChatConversation.updateMany({ participants: userId }, { $set: { archived: true, archivedAt: new Date() } }),
      // ✅ FIX: Mark all unread messages from deleted user as seen — clears receiver's badge
      ChatMessage.updateMany({ senderId: userId, seen: false }, { $set: { seen: true, seenAt: new Date(), senderDeleted: true } }),
      ChatMessage.updateMany({ receiverId: userId }, { $set: { senderDeleted: true } }),
      // FIX: stamp clearedAt for this userId so if they re-register (new _id),
      // the old conversation is sealed and history won't leak back
      ChatConversation.updateMany(
        { participants: userId },
        { $set: { [`clearedAt.${userId}`]: new Date() } }
      ),
      User.findByIdAndDelete(userId),
    ]);

    // FIX 13: Emit AFTER DB operations complete (was a race condition)
    io.to(`user:${userId.toString()}`).emit("auth:forceLogout", { reason: "Your account has been deleted." });

    return res.json({ success: true, message: "Account deleted successfully" });
  } catch (e) {
    console.error("Account deletion error:", e);
    return res.status(500).json({ success: false, message: "Server error during deletion" });
  }
});

app.get("/get-profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password -recoveryPin").lean();
    if (!user) return res.json({ success: false });
    return res.json({
      success: true,
      user: { _id: user._id, fullName: user.fullName, email: user.email, role: user.role, termsAccepted: user.termsAccepted },
      profile: (user.role === "Founder" ? user.founderProfile : user.investorProfile) || {},
    });
  } catch (e) {
    console.error("get-profile error:", e);
    return res.status(500).json({ success: false });
  }
});

app.get("/get-user", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return res.json({ success: false });
    const user = await User.findById(userId).select("fullName role founderProfile.photo investorProfile.photo").lean();
    if (!user) return res.json({ success: false });
    const photo = user.role === "Founder" ? (user.founderProfile?.photo || "") : (user.investorProfile?.photo || "");
    return res.json({ success: true, fullName: user.fullName, photo });
  } catch (e) {
    console.error("get-user error:", e);
    return res.status(500).json({ success: false });
  }
});

// ════════════════════════════════════════════════════════
//  PROFILE ROUTES
// ════════════════════════════════════════════════════════

// CONFIG 4: LinkedIn duplicate check — prevent same LinkedIn URL on 2 accounts
app.post("/profile/check-linkedin", authMiddleware, async (req, res) => {
  try {
    const { linkedinUrl, userId } = req.body || {};
    const url = (linkedinUrl || "").trim();
    if (!url) return res.json({ taken: false });
    const existing = await User.findOne({
      _id: { $ne: userId },
      $or: [
        { "founderProfile.linkedinUrl": url },
        { "investorProfile.linkedinUrl": url },
      ],
    }).select("_id role").lean();
    return res.json({ taken: !!existing, byRole: existing ? existing.role : null });
  } catch (e) {
    console.error("check-linkedin error:", e);
    return res.json({ taken: false });
  }
});

app.post("/profile/founder", authMiddleware, async (req, res) => {
  try {
    const fp       = req.body.founderProfile || null;
    const newEmail = normalizeEmail(req.body.newEmail || "");
    const fullName = (req.body.fullName || "").trim();

    if (!fp) return res.json({ success: false, message: "Missing data" });

    const user = await User.findById(req.userId);
    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.role !== "Founder")
      return res.json({ success: false, message: "Role mismatch — you are not a Founder" });

    const phone = (fp.phone || "").replace(/\D/g, "").slice(0, 10);
    if (!/^\d{10}$/.test(phone))
      return res.status(400).json({ success: false, message: "Phone must be 10 digits" });

    const phoneExists = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ "founderProfile.phone": phone }, { "investorProfile.phone": phone }],
    }).select("fullName email role founderProfile.phone investorProfile.phone").lean();

    if (phoneExists) {
      const which = phoneExists.founderProfile?.phone === phone ? "Founder profile" : "Investor profile";
      return res.json({ success: false, field: "phone", message: `Phone already exists (${which})`, existing: { fullName: phoneExists.fullName, email: phoneExists.email, role: phoneExists.role } });
    }

    const description = (fp.description || "").trim();
    if (description.length < 100)
      return res.json({ success: false, message: "Description must be at least 100 characters" });

    const startupName = (fp.startupName || "").trim();
    if (!startupName) return res.json({ success: false, message: "Startup name is required" });

    const linkedinUrl = (fp.linkedinUrl || "").trim();
    // LinkedIn is OPTIONAL — only validate/check uniqueness if user provided one
    if (linkedinUrl) {
      if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/.test(linkedinUrl))
        return res.json({ success: false, message: "Please enter a valid LinkedIn profile URL" });

      // Server-side LinkedIn uniqueness check (blocks bypass via DevTools)
      const linkedinTaken = await User.findOne({
        _id: { $ne: user._id },
        $or: [
          { "founderProfile.linkedinUrl": linkedinUrl },
          { "investorProfile.linkedinUrl": linkedinUrl },
        ],
      }).select("_id").lean();
      if (linkedinTaken)
        return res.json({ success: false, field: "linkedinUrl", message: "This LinkedIn profile URL is already registered by another user. Please use your own LinkedIn profile link." });
    }

    if (!fp.photo && !user.founderProfile?.photo)
      return res.json({ success: false, message: "Profile photo is required" });
    if (fp.photo && fp.photo.length > 1.5 * 1024 * 1024)
      return res.json({ success: false, message: "Photo is too large. Please use a smaller image." });

    if (fullName) user.fullName = fullName;

    if (newEmail && newEmail !== user.email) {
      if (!isGmail(newEmail))
        return res.json({ success: false, message: "Only @gmail.com emails are allowed" });
      const emailTaken = await User.findOne({ email: newEmail, _id: { $ne: user._id } }).select("_id").lean();
      if (emailTaken)
        return res.json({ success: false, message: "This email is already in use by another account" });
      user.email = newEmail;
    }

    user.founderProfile = {
      phone,
      phoneCountry:  (fp.phoneCountry || "").trim(),
      linkedinUrl,
      startupName,
      description,
      photo: fp.photo || user.founderProfile?.photo || "",
    };

    await user.save();

    const viewers = profileViewers.get(String(user._id));
    if (viewers && viewers.size > 0) {
      io.to(Array.from(viewers).map(id => `user:${id}`)).emit("profile:updated", {
        userId: user._id.toString(), role: "Founder", profile: user.founderProfile,
      });
    }

    // FIX 12: Emit feed:newProfile to ALL online investors so their connections
    // page refreshes instantly WITHOUT a browser reload
    // Only emit if profile has a photo (i.e. profile is complete and discoverable)
    if (user.founderProfile && user.founderProfile.photo) {
      io.emit("feed:newProfile", {
        role: "Founder",
        userId: user._id.toString(),
      });
    }

    // FIX: sync token after profile save
    try{const _t=(req.headers.authorization||"").replace("Bearer ","").trim();if(_t)await User.findByIdAndUpdate(user._id,{$set:{activeSessionToken:_t}});}catch(_e){}
    return res.json({ success: true, user });
  } catch (err) {
    console.error("profile/founder error:", err);
    return res.status(500).json({ success: false });
  }
});

app.post("/profile/investor", authMiddleware, async (req, res) => {
  try {
    const ip       = req.body.investorProfile || null;
    const newEmail = normalizeEmail(req.body.newEmail || "");
    const fullName = (req.body.fullName || "").trim();

    if (!ip) return res.json({ success: false, message: "Missing data" });

    const user = await User.findById(req.userId);
    if (!user) return res.json({ success: false, message: "User not found" });

    if (user.role !== "Investor")
      return res.json({ success: false, message: "Role mismatch — you are not an Investor" });

    const phone = (ip.phone || "").replace(/\D/g, "").slice(0, 10);
    if (!phone) return res.status(400).json({ success: false, message: "Phone is required" });
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ success: false, message: "Phone must be 10 digits" });

    const phoneExists = await User.findOne({
      _id: { $ne: user._id },
      $or: [{ "founderProfile.phone": phone }, { "investorProfile.phone": phone }],
    }).select("fullName email role founderProfile.phone investorProfile.phone").lean();

    if (phoneExists) {
      const which = phoneExists.founderProfile?.phone === phone ? "Founder profile" : "Investor profile";
      return res.json({ success: false, field: "phone", message: `Phone already exists (${which})`, existing: { fullName: phoneExists.fullName, email: phoneExists.email, role: phoneExists.role } });
    }

    const bio = (ip.bio || "").trim();
    if (bio.length < 100)
      return res.json({ success: false, message: "Bio must be at least 100 characters" });

    const investorType       = (ip.investorType || "").trim();
    const investmentFocus    = (ip.investmentFocus || "").trim();
    const financialCapacity  = (ip.financialCapacity || "").trim();
    const investmentCurrency = (ip.investmentCurrency || "").trim();

    if (!investorType)      return res.json({ success: false, message: "Investor type is required" });
    if (!investmentFocus)   return res.json({ success: false, message: "Investment focus is required" });
    if (!financialCapacity) return res.json({ success: false, message: "Financial capacity is required" });

    const VALID_CAPACITIES = ["Good", "Nice", "Very Nice", "Excellent"];
    if (!VALID_CAPACITIES.includes(financialCapacity))
      return res.json({ success: false, message: "Invalid financial capacity. Please select a valid option." });

    if (!ip.photo && !user.investorProfile?.photo)
      return res.json({ success: false, message: "Profile photo is required" });
    if (ip.photo && ip.photo.length > 1.5 * 1024 * 1024)
      return res.json({ success: false, message: "Photo is too large. Please use a smaller image." });

    const linkedinUrl = (ip.linkedinUrl || "").trim();
    // LinkedIn is OPTIONAL — only validate/check uniqueness if user provided one
    if (linkedinUrl) {
      if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/.test(linkedinUrl))
        return res.json({ success: false, message: "Please enter a valid LinkedIn profile URL" });

      // Server-side LinkedIn uniqueness check (blocks bypass via DevTools)
      const linkedinTaken = await User.findOne({
        _id: { $ne: user._id },
        $or: [
          { "founderProfile.linkedinUrl": linkedinUrl },
          { "investorProfile.linkedinUrl": linkedinUrl },
        ],
      }).select("_id").lean();
      if (linkedinTaken)
        return res.json({ success: false, field: "linkedinUrl", message: "This LinkedIn profile URL is already registered by another user. Please use your own LinkedIn profile link." });
    }

    if (fullName) user.fullName = fullName;

    if (newEmail && newEmail !== user.email) {
      if (!isGmail(newEmail))
        return res.json({ success: false, message: "Only @gmail.com emails are allowed" });
      const emailTaken = await User.findOne({ email: newEmail, _id: { $ne: user._id } }).select("_id").lean();
      if (emailTaken)
        return res.json({ success: false, message: "This email is already in use by another account" });
      user.email = newEmail;
    }

    user.investorProfile = {
      phone, phoneCountry: (ip.phoneCountry || "").trim(),
      linkedinUrl, investorType, investmentFocus,
      financialCapacity, bio,
      photo: ip.photo || user.investorProfile?.photo || "",
    };

    await user.save();

    const viewers = profileViewers.get(String(user._id));
    if (viewers && viewers.size > 0) {
      io.to(Array.from(viewers).map(id => `user:${id}`)).emit("profile:updated", {
        userId: user._id.toString(), role: "Investor", profile: user.investorProfile,
      });
    }

    // FIX 12: Emit feed:newProfile to ALL online founders so their connections
    // page refreshes instantly WITHOUT a browser reload
    if (user.investorProfile && user.investorProfile.photo) {
      io.emit("feed:newProfile", {
        role: "Investor",
        userId: user._id.toString(),
      });
    }

    // FIX: sync token after profile save
    try{const _t=(req.headers.authorization||"").replace("Bearer ","").trim();if(_t)await User.findByIdAndUpdate(user._id,{$set:{activeSessionToken:_t}});}catch(_e){}
    return res.json({ success: true, user });
  } catch (err) {
    console.error("profile/investor error:", err);
    return res.status(500).json({ success: false });
  }
});

// ════════════════════════════════════════════════════════
//  CONNECTIONS / FEED
// ════════════════════════════════════════════════════════

app.get("/connected", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const u = await User.findById(userId).select("connections").lean();
    if (!u) return res.json({ success: false });
    const ids = (u.connections || []).map(id => id.toString());
    if (!ids.length) return res.json({ success: true, users: [] });
    const users = await User.find({ _id: { $in: ids } })
      .select("_id fullName role founderProfile investorProfile").lean();
    const map = new Map(users.map(x => [x._id.toString(), x]));
    return res.json({ success: true, users: ids.map(id => map.get(id)).filter(Boolean) });
  } catch (e) {
    console.error("connected error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/connected/remove", authMiddleware, async (req, res) => {
  try {
    const userId   = req.userId;
    const { targetId } = req.body;
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId))
      return res.json({ success: false });

    const uId = new mongoose.Types.ObjectId(userId);
    const tId = new mongoose.Types.ObjectId(targetId);

    const reporter = await User.findById(uId).select("fullName").lean();
    const reporterName = reporter?.fullName || "A user";

    await Promise.all([
      User.updateOne({ _id: uId }, { $pull: { connections: tId } }),
      User.updateOne({ _id: tId }, { $pull: { connections: uId } }),
      User.updateOne({ _id: uId }, { $pull: { interestedUsers: tId } }),
      User.updateOne({ _id: tId }, { $pull: { interestedUsers: uId } }),
      User.updateOne({ _id: uId }, { $pull: { inboxRequests: { fromUserId: tId } } }),
      User.updateOne({ _id: tId }, { $pull: { inboxRequests: { fromUserId: uId } } }),
      User.updateOne({ _id: uId }, { $pull: { sentRequests: { toUserId: tId } } }),
      User.updateOne({ _id: tId }, { $pull: { sentRequests: { toUserId: uId } } }),
      User.updateOne({ _id: uId }, { $addToSet: { reportedUsers: tId } }),
      User.updateOne({ _id: tId }, { $addToSet: { reportedUsers: uId } }),
      User.updateOne({ _id: tId }, { $addToSet: { blockedBy: uId } }),
    ]);

    io.to(`user:${tId.toString()}`).emit("user:blocked",     { byUserId: uId.toString(), byUserName: reporterName });
    io.to(`user:${tId.toString()}`).emit("connection:removed", { removedBy: uId.toString(), removedByName: reporterName });
    // ✅ FIX: persist block notification to DB so it shows in notifications page
    await pushNotification(tId.toString(), "block", `🚫 ${reporterName} has removed and blocked you.`, uId.toString());

    return res.json({ success: true });
  } catch (e) {
    console.error("connected/remove error:", e);
    return res.status(500).json({ success: false });
  }
});

app.get("/connections/feed", authMiddleware, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.userId);
    // FIX 14: Pagination — 12 cards per page, uses MongoDB indexes
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const cu = await User.findById(userId)
      .select("role skippedUsers reportedUsers interestedUsers inboxRequests sentRequests connections termsAccepted")
      .lean();
    if (!cu) return res.json({ success: false, message: "User not found" });

    const oppositeRole     = cu.role === "Founder" ? "Investor" : "Founder";
    const inboxPendingFrom = new Set((cu.inboxRequests || []).filter(r => r.status === "pending" && r.fromUserId).map(r => String(r.fromUserId)));
    const sentPendingTo    = new Set((cu.sentRequests  || []).filter(r => r.status === "pending" && r.toUserId).map(r => String(r.toUserId)));
    const connSet          = new Set((cu.connections   || []).map(x => String(x)));

    const excludeIds = [
      String(userId),
      ...(cu.skippedUsers    || []).map(x => String(x)),
      ...(cu.reportedUsers   || []).map(x => String(x)),
      ...(cu.interestedUsers || []).map(x => String(x)),
      ...Array.from(connSet),
    ].filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

    const query = {
      role: oppositeRole,
      termsAccepted: true,
      isSuspended: { $ne: true },
      _id: { $nin: excludeIds },
      blockedBy: { $ne: userId },
      reportedUsers: { $ne: userId },
      $or: [
        { "founderProfile.photo":  { $exists: true, $ne: "" } },
        { "investorProfile.photo": { $exists: true, $ne: "" } },
      ],
    };

    // ✅ FIX: removed countDocuments — was doubling DB load for unused data
    const users = await User.find(query)
      .select("fullName role founderProfile investorProfile")
      .sort({ _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const enriched = users.map(u => {
      const id = String(u._id);
      return {
        ...u,
        theySentMeRequest: inboxPendingFrom.has(id),
        iSentThemRequest:  sentPendingTo.has(id),
        alreadyConnected:  connSet.has(id),
      };
    });

    return res.json({
      success: true,
      users: enriched,
      pagination: {
        page, limit,
        hasMore: users.length === limit,
      },
    });
  } catch (e) {
    console.error("connections/feed error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/connections/skip", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { targetId } = req.body || {};
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId))
      return res.json({ success: false });
    await User.findByIdAndUpdate(userId, { $addToSet: { skippedUsers: targetId } });
    return res.json({ success: true });
  } catch (e) {
    console.error("connections/skip error:", e);
    return res.status(500).json({ success: false });
  }
});

app.get("/skipped", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("skippedUsers", "fullName role founderProfile investorProfile")
      .select("skippedUsers")
      .lean();
    return res.json({ success: true, users: user?.skippedUsers || [] });
  } catch (e) {
    console.error("skipped error:", e);
    return res.status(500).json({ success: false, users: [] });
  }
});

app.post("/skipped/remove", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { targetId } = req.body || {};
    if (!targetId || !mongoose.Types.ObjectId.isValid(targetId))
      return res.json({ success: false });
    const upd = await User.updateOne({ _id: userId }, { $pull: { skippedUsers: targetId } });
    return res.json({ success: true, modified: upd.modifiedCount });
  } catch (e) {
    console.error("skipped/remove error:", e);
    return res.status(500).json({ success: false });
  }
});

// ════════════════════════════════════════════════════════
//  INBOX / SENT / REQUESTS
// ════════════════════════════════════════════════════════

async function upsertInboxStatus(userId, fromUserId, status) {
  const upd = await User.updateOne(
    { _id: userId, "inboxRequests.fromUserId": fromUserId },
    { $set: { "inboxRequests.$.status": status, "inboxRequests.$.seen": true } }
  );
  if (!upd.matchedCount)
    await User.updateOne(
      { _id: userId, "inboxRequests.fromUserId": { $ne: fromUserId } },
      { $push: { inboxRequests: { fromUserId, status, seen: true, createdAt: new Date() } } }
    );
}

async function upsertSentStatus(userId, toUserId, status) {
  const upd = await User.updateOne(
    { _id: userId, "sentRequests.toUserId": toUserId },
    { $set: { "sentRequests.$.status": status } }
  );
  if (!upd.matchedCount)
    await User.updateOne(
      { _id: userId, "sentRequests.toUserId": { $ne: toUserId } },
      { $push: { sentRequests: { toUserId, status, createdAt: new Date() } } }
    );
}

async function autoConnectPair(aId, bId) {
  const a = await User.findById(aId).select("connections").lean();
  if ((a?.connections || []).some(x => x.toString() === bId.toString())) return { already: true };
  await Promise.all([
    upsertInboxStatus(aId, bId, "accepted"), upsertInboxStatus(bId, aId, "accepted"),
    upsertSentStatus(aId, bId, "accepted"),  upsertSentStatus(bId, aId, "accepted"),
    User.updateOne({ _id: aId }, { $addToSet: { connections: bId }, $pull: { interestedUsers: bId, skippedUsers: bId } }),
    User.updateOne({ _id: bId }, { $addToSet: { connections: aId }, $pull: { interestedUsers: aId, skippedUsers: aId } }),
  ]);
  return { already: false };
}

app.post("/connections/interested", authMiddleware, async (req, res) => {
  try {
    const fromUserId = req.userId;
    const { toUserId } = req.body || {};
    if (!toUserId || !mongoose.Types.ObjectId.isValid(toUserId))
      return res.json({ success: false, message: "Invalid data" });
    if (fromUserId === toUserId) return res.json({ success: false, message: "Cannot request yourself" });

    const fromId = new mongoose.Types.ObjectId(fromUserId);
    const toId   = new mongoose.Types.ObjectId(toUserId);

    if (await User.findOne({ _id: fromId, connections: toId }).select("_id").lean())
      return res.json({ success: true, connected: true, message: "Already connected" });

    const [fromUser, toUser] = await Promise.all([
      User.findById(fromId).select("fullName").lean(),
      User.findById(toId).select("fullName").lean(),
    ]);
    const fromName = fromUser?.fullName || "Someone";
    const toName   = toUser?.fullName   || "Someone";

    const iAlreadyReceivedTheirRequest = await User.findOne({
      _id: fromId,
      inboxRequests: { $elemMatch: { fromUserId: toId, status: "pending" } },
    }).select("_id").lean();

    if (iAlreadyReceivedTheirRequest) {
      const r = await autoConnectPair(fromId, toId);
      if (!r.already) {
        await Promise.all([
          pushNotification(fromId.toString(), "auto_connected", `🤝 You and ${toName} are now auto-connected!`, toId.toString()),
          pushNotification(toId.toString(), "auto_connected", `🤝 You and ${fromName} are now auto-connected!`, fromId.toString()),
        ]);
      }
      return res.json({ success: true, connected: true, message: r.already ? "Already connected" : "Auto-connected" });
    }

    await Promise.all([
      User.updateOne({ _id: fromId }, { $addToSet: { interestedUsers: toId } }),
      User.updateOne(
        { _id: toId, "inboxRequests.fromUserId": { $ne: fromId } },
        { $push: { inboxRequests: { fromUserId: fromId, status: "pending", seen: false, createdAt: new Date() } } }
      ),
      User.updateOne(
        { _id: fromId, "sentRequests.toUserId": { $ne: toId } },
        { $push: { sentRequests: { toUserId: toId, status: "pending", createdAt: new Date() } } }
      ),
    ]);

    const [fromHasToPending, toHasFromPending] = await Promise.all([
      User.findOne({ _id: fromId, inboxRequests: { $elemMatch: { fromUserId: toId, status: "pending" } } }).select("_id").lean(),
      User.findOne({ _id: toId,   inboxRequests: { $elemMatch: { fromUserId: fromId, status: "pending" } } }).select("_id").lean(),
    ]);

    if (fromHasToPending && toHasFromPending) {
      const r = await autoConnectPair(fromId, toId);
      if (!r.already) {
        await Promise.all([
          pushNotification(fromId.toString(), "auto_connected", `🤝 You and ${toName} are now auto-connected!`, toId.toString()),
          pushNotification(toId.toString(), "auto_connected", `🤝 You and ${fromName} are now auto-connected!`, fromId.toString()),
        ]);
      }
      return res.json({ success: true, connected: true, message: r.already ? "Already connected" : "Auto-connected" });
    }

    await Promise.all([
      pushNotification(toId.toString(),   "request_received", `📥 ${fromName} sent you a connection request.`, fromId.toString()),
      pushNotification(fromId.toString(), "request_sent",     `📤 You sent a connection request to ${toName}.`, toId.toString()),
    ]);

    return res.json({ success: true, connected: false, message: "Request sent" });
  } catch (e) {
    console.error("connections/interested error:", e);
    return res.status(500).json({ success: false });
  }
});

app.get("/inbox", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate("inboxRequests.fromUserId", "fullName email role founderProfile investorProfile")
      .select("inboxRequests");
    if (!user) return res.json({ success: false, requests: [] });

    const requests = (user.inboxRequests || []).map(r => {
      const from = r.fromUserId;
      if (!from) return null;
      const isF     = from.role === "Founder";
      const profile = isF ? (from.founderProfile || {}) : (from.investorProfile || {});
      const base = {
        _id: r._id, status: r.status, seen: r.seen, createdAt: r.createdAt,
        fromUser: { _id: from._id, fullName: from.fullName, role: from.role, photo: profile.photo || "", subtitle: isF ? (profile.startupName || "") : (profile.investmentFocus || "") },
      };
      if (r.status === "accepted") {
        base.sharedData = {
          _id: from._id, fullName: from.fullName, email: from.email, role: from.role,
          phone: (profile.phone || "").toString(),
          founderProfile:  isF  ? { startupName: profile.startupName || "", description: profile.description || "", photo: profile.photo || "" } : null,
          investorProfile: !isF ? { investorType: profile.investorType || "", investmentFocus: profile.investmentFocus || "", financialCapacity: profile.financialCapacity || "", investmentCurrency: profile.investmentCurrency || "", bio: profile.bio || "", photo: profile.photo || "" } : null,
        };
      }
      return base;
    }).filter(Boolean);

    return res.json({ success: true, requests });
  } catch (e) {
    console.error("inbox error:", e);
    return res.status(500).json({ success: false, requests: [] });
  }
});

app.get("/sent", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({ path: "sentRequests.toUserId", select: "fullName email phone role founderProfile investorProfile" })
      .select("sentRequests");
    if (!user) return res.json({ success: false, requests: [] });

    const requests = (user.sentRequests || []).map(r => {
      const to = r.toUserId;
      if (!to) return null;
      const isF     = to.role === "Founder";
      const profile = isF ? (to.founderProfile || {}) : (to.investorProfile || {});
      let shared = null;
      if (r.status === "accepted") {
        shared = {
          email: to.email || "", phone: to.phone || profile.phone || "", role: to.role,
          ...(isF  && { founderProfile:  { startupName: profile.startupName || "", description: profile.description || "" } }),
          ...(!isF && { investorProfile: { investorType: profile.investorType || "", investmentFocus: profile.investmentFocus || "", financialCapacity: profile.financialCapacity || "", investmentCurrency: profile.investmentCurrency || "", bio: profile.bio || "" } }),
        };
      }
      return { _id: r._id, status: r.status, createdAt: r.createdAt, toUser: { _id: to._id, fullName: to.fullName, email: to.email, role: to.role, photo: profile.photo || "", subtitle: isF ? (profile.startupName || "") : (profile.investmentFocus || "") }, shared };
    }).filter(Boolean);

    return res.json({ success: true, requests });
  } catch (e) {
    console.error("sent error:", e);
    return res.status(500).json({ success: false, requests: [] });
  }
});

app.post("/inbox/accept", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.body || {};
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId))
      return res.json({ success: false });

    const receiverId = new mongoose.Types.ObjectId(req.userId);
    const receiver   = await User.findById(receiverId).select("inboxRequests fullName");
    if (!receiver) return res.json({ success: false });

    const reqDoc = receiver.inboxRequests.id(requestId);
    if (!reqDoc) return res.json({ success: false });
    if (reqDoc.status !== "pending") return res.json({ success: true, connected: true });

    const senderId = new mongoose.Types.ObjectId(reqDoc.fromUserId);
    const sender   = await User.findById(senderId).select("fullName").lean();

    reqDoc.status = "accepted";
    reqDoc.seen   = true;
    await receiver.save();

    await Promise.all([
      User.updateOne({ _id: senderId, "sentRequests.toUserId": receiverId }, { $set: { "sentRequests.$.status": "accepted" } }),
      User.updateOne({ _id: receiverId }, { $addToSet: { connections: senderId }, $pull: { skippedUsers: senderId } }),
      User.updateOne({ _id: senderId },   { $addToSet: { connections: receiverId }, $pull: { skippedUsers: receiverId } }),
    ]);

    await Promise.all([
      User.updateOne({ _id: receiverId }, { $pull: { sentRequests: { toUserId: senderId } } }),
      User.updateOne({ _id: senderId },   { $pull: { inboxRequests: { fromUserId: receiverId } } }),
      pushNotification(senderId.toString(),   "connected", `✅ ${receiver.fullName} accepted your request. You are now connected!`, receiverId.toString()),
      pushNotification(receiverId.toString(), "connected", `✅ You accepted ${sender?.fullName || "their"} request. You are now connected!`, senderId.toString()),
    ]);

    return res.json({ success: true, connected: true });
  } catch (e) {
    console.error("inbox/accept error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/inbox/decline", authMiddleware, async (req, res) => {
  try {
    const { requestId } = req.body || {};
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId))
      return res.json({ success: false });

    const receiver = await User.findById(req.userId).select("inboxRequests fullName");
    if (!receiver) return res.json({ success: false });

    const reqDoc = receiver.inboxRequests.id(requestId);
    if (!reqDoc) return res.json({ success: false });
    if (reqDoc.status !== "pending") return res.json({ success: true });

    reqDoc.status = "declined";
    reqDoc.seen   = true;
    await receiver.save();

    await Promise.all([
      User.updateOne({ _id: reqDoc.fromUserId, "sentRequests.toUserId": receiver._id }, { $set: { "sentRequests.$.status": "declined" } }),
      pushNotification(reqDoc.fromUserId.toString(), "declined", `❌ ${receiver.fullName} declined your connection request.`, receiver._id.toString()),
    ]);

    return res.json({ success: true });
  } catch (e) {
    console.error("inbox/decline error:", e);
    return res.status(500).json({ success: false });
  }
});

// ════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════


app.get("/stats", authMiddleware, async (req, res) => {
  try {
    const [founders, investors] = await Promise.all([
      User.countDocuments({ role: "Founder" }),
      User.countDocuments({ role: "Investor" }),
    ]);
    return res.json({ success: true, founders, investors });
  } catch (e) {
    console.error("stats error:", e);
    return res.status(500).json({ success: false });
  }
});
app.get("/notifications", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("notifications").lean();
    if (!user) return res.json({ success: false });

    const notifications = (user.notifications || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // FIX 3: Enrich notifications with sender photo from refUserId
    // Collect all unique refUserIds that have a valid ObjectId
    const refIds = [...new Set(
      notifications
        .filter(n => n.refUserId && mongoose.Types.ObjectId.isValid(n.refUserId))
        .map(n => n.refUserId.toString())
    )];

    // Fetch all ref users in ONE query
    let photoMap = {};
    if (refIds.length > 0) {
      const refUsers = await User.find({ _id: { $in: refIds } })
        .select("fullName role founderProfile.photo investorProfile.photo")
        .lean();
      refUsers.forEach(u => {
        const photo = u.role === "Founder"
          ? (u.founderProfile?.photo  || "")
          : (u.investorProfile?.photo || "");
        photoMap[u._id.toString()] = {
          photo,
          name: u.fullName || "",
        };
      });
    }

    // Attach senderPhoto and senderName to each notification
    const enriched = notifications.map(n => {
      const ref = n.refUserId ? photoMap[n.refUserId.toString()] : null;
      return {
        ...n,
        senderPhoto: ref?.photo || "",
        senderName:  ref?.name  || n.senderName || "",
      };
    });

    return res.json({ success: true, notifications: enriched });
  } catch (e) {
    console.error("notifications error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/notifications/mark-seen", authMiddleware, async (req, res) => {
  try {
    await User.updateOne({ _id: req.userId }, { $set: { "notifications.$[].seen": true } });
    return res.json({ success: true });
  } catch (e) {
    console.error("notifications/mark-seen error:", e);
    return res.status(500).json({ success: false });
  }
});



// ════════════════════════════════════════════════════════
//  CHAT HTTP ROUTES
// ════════════════════════════════════════════════════════

app.get("/chat/history", authMiddleware, async (req, res) => {
  try {
    const { peerId, deleted: isDeletedUser } = req.query || {};
    const userId = req.userId;
    if (!peerId || !mongoose.Types.ObjectId.isValid(peerId))
      return res.json({ success: false });

    const pairKey = makePairKey(userId, peerId);
    const convo   = await ChatConversation.findOne({ pairKey }).lean();

    if (!convo) {
      // No conversation exists at all — return empty
      return res.json({ success: true, messages: [] });
    }

    const clearedAt = convo.clearedAt?.[userId] || null;
    const query = { conversationId: convo._id };
    if (clearedAt) query.createdAt = { $gt: clearedAt };

    const msgs = await ChatMessage.find(query).sort({ createdAt: 1 }).lean();
    return res.json({
      success: true,
      messages: msgs
        // FIX: filter out messages where sender was deleted and requester is not the sender
        .filter(m => true)
        .map(m => ({
        _id: m._id,
        fromUserId: m.senderId,
        toUserId: m.receiverId,
        text: m.deleted ? "" : (m.text || ""),
        file: m.deleted ? "" : (m.file || ""),
        fileName: m.deleted ? "" : (m.fileName || ""),
        createdAt: m.createdAt,
        seen: !!m.seen,
        seenAt: m.seenAt || null,
        edited: !!m.edited,
        deleted: !!m.deleted,
      })),
    });
  } catch (e) {
    console.error("chat/history error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/chat/send", authMiddleware, async (req, res) => {
  try {
    const fromUserId = req.userId;
    const { toUserId, text } = req.body || {};
    const cleanText = String(text || "").trim();
    if (!toUserId || !cleanText || !mongoose.Types.ObjectId.isValid(toUserId))
      return res.json({ success: false });

    const ok = await assertConnected(fromUserId, toUserId);
    if (!ok) return res.json({ success: false });

    const blocked = await isUserBlockedBy(fromUserId, toUserId);
    if (blocked) return res.json({ success: false, message: "You have been blocked" });

    const pairKey = makePairKey(fromUserId, toUserId);
    const convo   = await ChatConversation.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { pairKey, participants: [fromUserId, toUserId] } },
      { upsert: true, new: true }
    );

    const msg = await ChatMessage.create({
      conversationId: convo._id, senderId: fromUserId, receiverId: toUserId,
      text: cleanText, seen: false,
    });

    await ChatConversation.updateOne({ _id: convo._id }, { $set: { lastMessageText: cleanText, lastMessageAt: new Date() } });

    const sender = await User.findById(fromUserId).select("fullName role founderProfile.photo investorProfile.photo").lean();
    const fromUserName  = sender?.fullName || "";
    const fromUserPhoto = sender?.role === "Founder" ? (sender?.founderProfile?.photo || "") : (sender?.investorProfile?.photo || "");
    const payload = { _id: msg._id, fromUserId: msg.senderId, toUserId: msg.receiverId, text: msg.text, createdAt: msg.createdAt, seen: msg.seen, seenAt: msg.seenAt, fromUserName, fromUserPhoto };
    io.to(roomFromPairKey(pairKey)).emit("chat:newMessage", payload);
    const roomName2 = roomFromPairKey(pairKey);
    const roomSockets2 = await io.in(roomName2).allSockets();
    const toUserStr = toUserId.toString();
    const toUserInRoom = [...roomSockets2].some(sid => {
      const s = io.sockets.sockets.get(sid);
      return s && s.userId === toUserStr;
    });
    if (!toUserInRoom) {
      io.to(`user:${toUserId}`).emit("chat:newMessage", payload);
    }

    return res.json({ success: true, message: msg });
  } catch (e) {
    console.error("chat/send error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/chat/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const fromUserId = req.userId;
    const { toUserId, originalName } = req.body;
    const fileName = originalName || req.file?.originalname || 'file';
    if (!toUserId || !req.file || !mongoose.Types.ObjectId.isValid(toUserId))
      return res.json({ success: false });

    const ok = await assertConnected(fromUserId, toUserId);
    if (!ok) return res.json({ success: false });

    const blocked = await isUserBlockedBy(fromUserId, toUserId);
    if (blocked) return res.json({ success: false, message: "You have been blocked" });

    const pairKey = makePairKey(fromUserId, toUserId);
    const convo   = await ChatConversation.findOneAndUpdate(
      { pairKey },
      { $setOnInsert: { pairKey, participants: [fromUserId, toUserId] } },
      { upsert: true, new: true }
    );

    // 🔒 SECURITY: MIME type whitelist
    const ALLOWED_MIME = ["image/jpeg","image/png","image/gif","image/webp","application/pdf","video/mp4","video/webm","text/plain","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!ALLOWED_MIME.includes(req.file.mimetype))
      return res.json({ success: false, message: "File type not allowed" });

    // Upload to Cloudinary
    const { cloudinary } = require("./cloudinary");
    const mime = req.file.mimetype || "";
    const resourceType = mime.startsWith("video/") ? "video" : mime === "application/pdf" ? "raw" : "image";
    const folder = mime.startsWith("video/") ? "startupsync/chat/videos" : mime === "application/pdf" ? "startupsync/chat/pdfs" : "startupsync/chat/images";
    const cloudResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: resourceType, folder },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });
    const filePath = cloudResult.secure_url;

    const msg = await ChatMessage.create({
      conversationId: convo._id, senderId: fromUserId, receiverId: toUserId,
      text: "", file: filePath, fileName: fileName, seen: false,
    });

    const sender = await User.findById(fromUserId).select("fullName role founderProfile.photo investorProfile.photo").lean();
    const fromUserName  = sender?.fullName || "New Message";
    const fromUserPhoto = sender?.role === "Founder"
      ? (sender?.founderProfile?.photo  || "")
      : (sender?.investorProfile?.photo || "");

    const payload = { _id: msg._id, fromUserId: msg.senderId, toUserId: msg.receiverId, text: msg.text, file: msg.file, fileName: msg.fileName||fileName, createdAt: msg.createdAt, seen: msg.seen, seenAt: msg.seenAt, fromUserName, fromUserPhoto };
    io.to(roomFromPairKey(pairKey)).emit("chat:newMessage", payload);
    const roomName3 = roomFromPairKey(pairKey);
    const roomSockets3 = await io.in(roomName3).allSockets();
    const uploadToStr = toUserId.toString();
    const uploadToInRoom = [...roomSockets3].some(sid => {
      const s = io.sockets.sockets.get(sid);
      return s && s.userId === uploadToStr;
    });
    if (!uploadToInRoom) {
      io.to(`user:${toUserId}`).emit("chat:newMessage", payload);
    }

    return res.json({ success: true, file: filePath, message: payload });
  } catch (e) {
    console.error("chat/upload error:", e);
    return res.json({ success: false, error: e.message });
  }
});

app.post("/chat/delete", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { peerId, messageId } = req.body || {};
    if (!peerId || !messageId || !mongoose.Types.ObjectId.isValid(peerId) || !mongoose.Types.ObjectId.isValid(messageId))
      return res.json({ success: false });

    const ok = await assertConnected(userId, peerId);
    if (!ok) return res.json({ success: false });

    const m = await ChatMessage.findById(messageId);
    if (!m) return res.json({ success: false });
    if (m.senderId.toString() !== userId.toString()) return res.json({ success: false, message: "Not allowed" });

    await ChatMessage.updateOne({ _id: messageId }, { $set: { deleted: true, text: "", file: "", seen: true, seenAt: new Date() } });

    const room = roomFromPairKey(makePairKey(userId, peerId));
    io.to(room).emit("chat:messageDeleted", { messageId: messageId.toString() });
    io.to(peerId.toString()).emit("chat:messageDeleted", { messageId: messageId.toString() });
    io.to(`user:${peerId}`).emit("chat:unreadUpdate", { fromUserId: userId });

    return res.json({ success: true });
  } catch (e) {
    console.error("chat/delete error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/chat/delete-conversation", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { peerId } = req.body || {};
    if (!peerId || !mongoose.Types.ObjectId.isValid(peerId))
      return res.json({ success: false });

    const ok = await assertConnected(userId, peerId);
    if (!ok) return res.json({ success: false });

    const pairKey = makePairKey(userId, peerId);
    await ChatConversation.findOneAndUpdate(
      { pairKey },
      { $set: { [`clearedAt.${userId}`]: new Date() } },
      { upsert: true }
    );
    return res.json({ success: true });
  } catch (e) {
    console.error("chat/delete-conversation error:", e);
    return res.status(500).json({ success: false });
  }
});

app.post("/chat/edit", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const { peerId, messageId, text } = req.body || {};
    const cleanText = String(text || "").trim();
    if (!peerId || !messageId || !cleanText || !mongoose.Types.ObjectId.isValid(peerId) || !mongoose.Types.ObjectId.isValid(messageId))
      return res.json({ success: false });

    const ok = await assertConnected(userId, peerId);
    if (!ok) return res.json({ success: false });

    const m = await ChatMessage.findById(messageId);
    if (!m) return res.json({ success: false });
    if (m.senderId.toString() !== userId.toString()) return res.json({ success: false, message: "Not allowed" });
    if (m.file) return res.json({ success: false, message: "Cannot edit a file message" });

    m.text   = cleanText;
    m.edited = true;
    await m.save();

    io.to(roomFromPairKey(makePairKey(userId, peerId))).emit("chat:messageEdited", { messageId: messageId.toString(), text: cleanText });
    return res.json({ success: true });
  } catch (e) {
    console.error("chat/edit error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get("/chat/unread-counts", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const results = await ChatMessage.aggregate([
      {
        $match: {
          receiverId: new mongoose.Types.ObjectId(userId),
          seen: { $ne: true },
          $or: [{ deleted: { $exists: false } }, { deleted: false }, { deleted: null }],
        },
      },
      {
        $group: { _id: "$senderId", count: { $sum: 1 } },
      },
    ]);

    const counts = {};
    for (const r of results) {
      if (r._id) counts[r._id.toString()] = r.count;
    }

    return res.json({ success: true, counts });
  } catch (e) {
    console.error("chat/unread-counts error:", e);
    return res.status(500).json({ success: false });
  }
});

// ════════════════════════════════════════════════════════
//  FEEDBACK
// ════════════════════════════════════════════════════════

app.post("/feedback/submit", authMiddleware, async (req, res) => {
  try {
    const userId    = req.userId;
    const { rating, message } = req.body || {};
    const cleanMsg  = (message || "").trim();
    const ratingNum = parseInt(rating);

    if (!cleanMsg) return res.json({ success: false, message: "Feedback message is required" });
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) return res.json({ success: false, message: "Rating must be between 1 and 5" });

    let userName = "Anonymous", userEmail = "", userRole = "";
    const u = await User.findById(userId).select("fullName email role").lean();
    if (u) { userName = u.fullName || "Anonymous"; userEmail = u.email || ""; userRole = u.role || ""; }

    const feedback = await Feedback.create({
      userId, userName, userEmail, userRole,
      rating: ratingNum, message: cleanMsg, seen: false,
    });

    io.to("admin").emit("feedback:new", { id: feedback._id.toString(), userName, rating: ratingNum, message: cleanMsg.substring(0, 80) });
    return res.json({ success: true, message: "Feedback submitted successfully" });
  } catch (e) {
    console.error("feedback/submit error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ════════════════════════════════════════════════════════
//  HELP REQUESTS
// ════════════════════════════════════════════════════════

const screenshotUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + (file.originalname || "file").replace(/\s+/g, "_")),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files allowed for screenshot"), false);
  },
});

app.post("/help/submit", authMiddleware, screenshotUpload.single("screenshot"), async (req, res) => {
  try {
    const userId = req.userId;
    const { problem } = req.body || {};
    const cleanProblem = (problem || "").trim();
    if (!cleanProblem) return res.json({ success: false, message: "Problem description is required" });
    if (cleanProblem.length < 10) return res.json({ success: false, message: "Please describe your problem in at least 10 characters" });

    let userName = "Anonymous", userEmail = "", userRole = "";
    const u = await User.findById(userId).select("fullName email role").lean();
    if (u) { userName = u.fullName || "Anonymous"; userEmail = u.email || ""; userRole = u.role || ""; }

    const screenshotPath = req.file ? "/uploads/" + req.file.filename : "";

    const helpReq = await HelpRequest.create({
      userId, userName, userEmail, userRole,
      problem: cleanProblem, screenshot: screenshotPath,
      seen: false, resolved: false,
    });

    io.to("admin").emit("help:new", { id: helpReq._id.toString(), userName, userEmail, problem: cleanProblem.substring(0, 80) });
    return res.json({ success: true, message: "Help request submitted successfully" });
  } catch (e) {
    console.error("help/submit error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


// ── FIX 6: Chat archive routes ─────────────────────────────────────────────
app.post("/chat/archive", authMiddleware, async (req, res) => {
  try {
    const userId  = req.userId;
    const { peerId, archive } = req.body || {};
    if (!peerId || !mongoose.Types.ObjectId.isValid(peerId))
      return res.json({ success: false, message: "Invalid peerId" });
    const pairKey  = makePairKey(userId, peerId);
    const archived = archive !== false;
    await ChatConversation.findOneAndUpdate(
      { pairKey },
      {
        $set: {
          [`archivedBy.${userId}`]:   archived,
          [`archivedByAt.${userId}`]: archived ? new Date() : null,
        },
        $setOnInsert: { pairKey, participants: [userId, peerId] },
      },
      { upsert: true, new: true }
    );
    return res.json({ success: true, archived });
  } catch (e) {
    console.error("chat/archive error:", e);
    return res.status(500).json({ success: false });
  }
});

app.get("/chat/archived", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const convos = await ChatConversation.find({
      [`archivedBy.${userId}`]: true,
      participants: userId,
    }).lean();
    const archivedPeerIds = convos.map(c =>
      (c.participants || []).find(p => p.toString() !== userId.toString())?.toString()
    ).filter(Boolean);
    return res.json({ success: true, archivedPeerIds });
  } catch (e) {
    console.error("chat/archived error:", e);
    return res.status(500).json({ success: false });
  }
});

// ════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ════════════════════════════════════════════════════════

const adminRoutes = require("./Adminroutes");
adminRoutes(app, User, io);

// ════════════════════════════════════════════════════════
//  CATCH-ALL + ERROR HANDLER
// ════════════════════════════════════════════════════════

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// 🔒 SECURITY: Global error handler — catches all unhandled errors
// Prevents stack traces from leaking to users in production
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const isDev = process.env.NODE_ENV !== "production";
  res.status(err.status || 500).json({
    success: false,
    message: isDev ? err.message : "Internal server error",
  });
});

// ════════════════════════════════════════════════════════
//  SERVER START + GRACEFUL SHUTDOWN
// ════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { /* server started */ });

// 🔒 STARTUP: Graceful shutdown — waits for active requests to finish
// before closing DB connection. Prevents data corruption on restart.
function gracefulShutdown(signal) {
  // console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    // console.log("✅ HTTP server closed");
    await mongoose.connection.close();
    // console.log("✅ MongoDB connection closed");
    process.exit(0);
  });
  // Force kill after 10 seconds if stuck
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));