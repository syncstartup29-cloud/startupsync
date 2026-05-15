const jwt = require("jsonwebtoken");

// ── Auth Middleware ────────────────────────────────────────────────────────
// FIX 5: Single DB hit — reads isSuspended + lastActiveAt + activeSessionToken
// FIX A: Block deleted users (user === null now returns 401)
// FIX B: Validate activeSessionToken against incoming token

async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.userId) throw new Error("Invalid token payload");
    req.userId = decoded.userId;

    // ── SINGLE DB hit: fetch isSuspended + lastActiveAt + activeSessionToken ──
    try {
      const User = require("./User");
      const user = await User.findById(decoded.userId)
        .select("isSuspended lastActiveAt activeSessionToken")
        .lean();

      // FIX A: Block deleted users — user not found means account is gone
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Account not found. Please log in again.",
        });
      }

      // Suspension check — kick out immediately
      if (user.isSuspended) {
        return res.status(403).json({
          success: false,
          suspended: true,
          message: "Your account has been suspended.",
        });
      }

      // FIX B: Validate activeSessionToken — prevents stolen/old tokens from working
      if (user.activeSessionToken && user.activeSessionToken !== token) {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please log in again.",
        });
      }

      // Update lastActiveAt — throttled to once per 2 minutes (fire & forget)
      if (user.activeSessionToken === token) {
        const TWO_MINS = 2 * 60 * 1000;
        const last = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
        if (Date.now() - last > TWO_MINS) {
          User.updateOne(
            { _id: decoded.userId, activeSessionToken: token },
            { $set: { lastActiveAt: new Date() } }
          ).catch(() => {});
        }
      }
    } catch (dbErr) {
      // Non-fatal — don't block the request if DB check fails
      console.error("authMiddleware DB check error:", dbErr);
    }

    next();
  } catch (e) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token. Please log in again.",
    });
  }
}

module.exports = authMiddleware;