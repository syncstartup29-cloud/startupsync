// Adminroutes.js
const mongoose = require("mongoose");
const jwt      = require("jsonwebtoken");

module.exports = function (app, User, io) {

  // ── Models (relative to this file's location)
  const HelpRequest      = require("./models/Helprequest");
  const Feedback         = require("./models/Feedback");
  const ChatConversation = require("./models/ChatConversation");
  const ChatMessage      = require("./models/ChatMessage");

  const ADMIN_SECRET = process.env.ADMIN_SECRET;
  const JWT_SECRET   = process.env.JWT_SECRET;

  if (!ADMIN_SECRET) console.error("❌ ERROR: ADMIN_SECRET is not defined in .env");
  if (!JWT_SECRET)   console.error("❌ ERROR: JWT_SECRET is not defined in .env");

  // ── Admin Auth Middleware ──────────────────────────────
  // FIX: now verifies a short-lived JWT instead of comparing
  // the raw ADMIN_SECRET string. Even if the token leaks, it
  // expires in 8 hours and does not expose the password.
  function adminAuth(req, res, next) {
    const tokenHeader = req.headers["x-admin-token"] || "";
    if (!tokenHeader) {
      return res.status(401).json({ success: false, message: "Unauthorized: No admin token provided" });
    }
    try {
      const decoded = jwt.verify(tokenHeader, JWT_SECRET);
      if (!decoded.admin) throw new Error("Not admin");
      next();
    } catch (e) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired admin token" });
    }
  }

  // ── Admin Login ────────────────────────────────────────
  // FIX: returns a JWT (expires in 8h) instead of the raw secret.
  // The frontend stores this token and sends it as x-admin-token.
  app.post("/admin/login", (req, res) => {
    const { password } = req.body || {};

    if (!ADMIN_SECRET || !JWT_SECRET) {
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }

    if (password !== ADMIN_SECRET) {
      return res.status(401).json({ success: false, message: "Invalid admin password" });
    }

    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "8h" });
    return res.json({ success: true, message: "Login successful", token });
  });

  // ── Dashboard Stats ────────────────────────────────────
  app.get("/admin/stats", adminAuth, async (req, res) => {
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [total, founders, investors, newThisWeek, totalConnections] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "Founder" }),
        User.countDocuments({ role: "Investor" }),
        User.countDocuments({ createdAt: { $gte: weekAgo } }),
        User.aggregate([
          { $project: { count: { $size: { $ifNull: ["$connections", []] } } } },
          { $group: { _id: null, total: { $sum: "$count" } } },
        ]),
      ]);

      const totalConn = totalConnections[0]?.total || 0;
      return res.json({
        success: true,
        stats: {
          total, founders, investors, newThisWeek,
          totalConnections: Math.floor(totalConn / 2),
        },
      });
    } catch (e) {
      console.error("admin/stats error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── All Founders ───────────────────────────────────────
  app.get("/admin/founders", adminAuth, async (req, res) => {
    try {
      const founders = await User.find({ role: "Founder" })
        .select("fullName email role founderProfile connections termsAccepted createdAt skippedUsers reportedUsers")
        .sort({ createdAt: -1 })
        .lean();

      const enriched = founders.map((u) => ({
        _id: u._id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        termsAccepted: u.termsAccepted || false,
        connectionsCount: (u.connections || []).length,
        skippedCount: (u.skippedUsers || []).length,
        reportedCount: (u.reportedUsers || []).length,
        joinedAt: u.createdAt,
        profile: u.founderProfile || {},
      }));

      return res.json({ success: true, founders: enriched });
    } catch (e) {
      console.error("admin/founders error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── All Investors ──────────────────────────────────────
  app.get("/admin/investors", adminAuth, async (req, res) => {
    try {
      const investors = await User.find({ role: "Investor" })
        .select("fullName email role investorProfile connections termsAccepted createdAt skippedUsers reportedUsers")
        .sort({ createdAt: -1 })
        .lean();

      const enriched = investors.map((u) => ({
        _id: u._id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        termsAccepted: u.termsAccepted || false,
        connectionsCount: (u.connections || []).length,
        skippedCount: (u.skippedUsers || []).length,
        reportedCount: (u.reportedUsers || []).length,
        joinedAt: u.createdAt,
        profile: u.investorProfile || {},
      }));

      return res.json({ success: true, investors: enriched });
    } catch (e) {
      console.error("admin/investors error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Single User Full Data ──────────────────────────────
  app.get("/admin/user/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.json({ success: false, message: "Invalid user ID" });

      const user = await User.findById(id).select("-password -recoveryPin").lean();
      if (!user) return res.json({ success: false, message: "User not found" });

      return res.json({ success: true, user });
    } catch (e) {
      console.error("admin/user error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Delete User ────────────────────────────────────────
  app.delete("/admin/user/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id))
        return res.json({ success: false, message: "Invalid user ID" });

      const user = await User.findById(id).select("_id connections");
      if (!user) return res.json({ success: false, message: "User not found" });

      // ── Step 1: Mark as suspended & notify via Socket.IO ──
      // This lets the user's active browser session show the
      // "Terms Violated" screen instantly, before deletion completes.
      await User.findByIdAndUpdate(id, { isSuspended: true });
      // FIX: was io.emit (broadcast to ALL clients — leaked userId to everyone)
      // Now scoped to the target user's room only
      if (io) io.to(`user:${id.toString()}`).emit("user:suspended", { userId: id.toString() });

      const connIds = (user.connections || []).map(x => x.toString());
      if (connIds.length > 0) {
        await User.updateMany(
          { _id: { $in: connIds } },
          {
            $pull: {
              connections:   id,
              interestedUsers: id,
              skippedUsers:  id,
              inboxRequests: { fromUserId: id },
              sentRequests:  { toUserId: id },
            },
          }
        );
      }

      await ChatConversation.updateMany({ participants: id }, { $set: { archived: true, archivedAt: new Date() } });
      await ChatMessage.updateMany({ $or: [{ senderId: id }, { receiverId: id }] }, { $set: { senderDeleted: true } });

      if (io && connIds && connIds.length > 0) {
        connIds.forEach(connId => {
          io.to(`user:${connId}`).emit("account:deleted", { deletedUserId: id.toString(), reason: "violation" });
        });
      }

      await User.findByIdAndDelete(id);
      if (io) io.to("admin").emit("admin:userDeleted", { userId: id.toString() });

      return res.json({ success: true, message: "User deleted successfully" });
    } catch (e) {
      console.error("admin/delete user error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Help Requests ──────────────────────────────────────
  app.get("/admin/help/unread-count", adminAuth, async (req, res) => {
    try {
      const count = await HelpRequest.countDocuments({ seen: false });
      return res.json({ success: true, count });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/admin/help", adminAuth, async (req, res) => {
    try {
      const requests = await HelpRequest.find().sort({ createdAt: -1 }).lean();
      return res.json({ success: true, requests });
    } catch (e) {
      console.error("admin/help error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.patch("/admin/help/:id/seen", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID" });
      await HelpRequest.findByIdAndUpdate(id, { seen: true });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.patch("/admin/help/:id/resolved", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID" });
      await HelpRequest.findByIdAndUpdate(id, { seen: true, resolved: true });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/admin/help/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID" });
      await HelpRequest.findByIdAndDelete(id);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Feedback ───────────────────────────────────────────
  app.get("/admin/feedback/unread-count", adminAuth, async (req, res) => {
    try {
      const count = await Feedback.countDocuments({ seen: false });
      return res.json({ success: true, count });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/admin/feedback", adminAuth, async (req, res) => {
    try {
      const feedbacks = await Feedback.find().sort({ createdAt: -1 }).lean();
      return res.json({ success: true, feedbacks });
    } catch (e) {
      console.error("admin/feedback error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.patch("/admin/feedback/:id/seen", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID" });
      await Feedback.findByIdAndUpdate(id, { seen: true });
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.delete("/admin/feedback/:id", adminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) return res.json({ success: false, message: "Invalid ID" });
      await Feedback.findByIdAndDelete(id);
      return res.json({ success: true });
    } catch (e) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // ── Clean Old Notifications ────────────────────────────
  app.get("/admin/clean-old-notifications", adminAuth, async (req, res) => {
    try {
      const result = await User.updateMany(
        {},
        { $pull: { notifications: { type: { $in: ["request_sent", "request_received", "skip", "unskip"] } } } }
      );
      return res.json({ success: true, usersUpdated: result.modifiedCount });
    } catch (e) {
      const isDev = process.env.NODE_ENV !== "production";
      return res.status(500).json({ success: false, message: isDev ? e.message : "Server error" });
    }
  });
};