const mongoose = require("mongoose");

/* ---------- Founder Profile ---------- */
const founderProfileSchema = new mongoose.Schema(
  {
    phone:          { type: String, trim: true, match: [/^\d{10}$/, "Phone must be exactly 10 digits"] },
    phoneCountry:   { type: String, trim: true, default: "+91" },
    linkedinUrl:    { type: String, trim: true },
    linkedinLocked: { type: Boolean, default: false },
    tagline:        { type: String, trim: true, maxlength: 120 },
    taglineLocked:  { type: Boolean, default: false },
    startupName:    { type: String, trim: true },
    description:    { type: String, trim: true },
    photo:          { type: String, default: "" },
  },
  { _id: false }
);

/* ---------- Investor Profile ---------- */
const investorProfileSchema = new mongoose.Schema(
  {
    phone:              { type: String, trim: true, match: [/^\d{10}$/, "Phone must be exactly 10 digits"] },
    phoneCountry:       { type: String, trim: true, default: "+91" },
    linkedinUrl:        { type: String, trim: true },
    linkedinLocked:     { type: Boolean, default: false },
    tagline:            { type: String, trim: true, maxlength: 120 },
    taglineLocked:      { type: Boolean, default: false },
    investorType:       { type: String, trim: true },
    investmentFocus:    { type: String, trim: true },
    financialCapacity:  { type: String, trim: true },
    investmentCurrency: { type: String, trim: true, default: "INR" },
    bio:                { type: String, trim: true },
    photo:              { type: String, default: "" },
  },
  { _id: false }
);

/* ---------- Inbox Request ---------- */
const inboxRequestSchema = new mongoose.Schema(
  {
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status:     { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    seen:       { type: Boolean, default: false },
    createdAt:  { type: Date, default: Date.now },
  },
  { _id: true }
);

/* ---------- Sent Request ---------- */
const sentRequestSchema = new mongoose.Schema(
  {
    toUserId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status:    { type: String, enum: ["pending", "accepted", "declined"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/* ---------- Notification ---------- */
const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["request_received", "request_sent", "auto_connected", "connected", "declined", "skip", "unskip"],
      required: true,
    },
    message:   { type: String, required: true, trim: true },
    refUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    seen:      { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

/* ---------- User ---------- */
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role:     { type: String, enum: ["Founder", "Investor"], required: true },

    recoveryPin: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      immutable: true,
      default: undefined,
    },

    termsAccepted:   { type: Boolean, default: false },
    founderProfile:  { type: founderProfileSchema,  default: () => ({}) },
    investorProfile: { type: investorProfileSchema, default: () => ({}) },

    skippedUsers:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    connections:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    interestedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    inboxRequests:  { type: [inboxRequestSchema], default: [] },
    sentRequests:   { type: [sentRequestSchema],  default: [] },

    // FIX 4: Notifications capped at 100 at schema level — prevents unbounded array growth
    notifications: {
      type: [notificationSchema],
      default: [],
      validate: {
        validator: function(v) { return v.length <= 100; },
        message: "Notifications array cannot exceed 100 items",
      },
    },

    blockedBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reportedUsers:[{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Single-session enforcement
    activeSessionToken: { type: String, default: null },
    lastActiveAt:       { type: Date,   default: null },

    // Suspension flag — set by admin
    isSuspended: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── FIX 2 & 3: All indexes for frequent query patterns ─────────────────────
// Compound index covering the entire /connections/feed filter in ONE scan
userSchema.index({ role: 1, termsAccepted: 1, isSuspended: 1 });

// FIX 2: activeSessionToken — used in EVERY auth request via authMiddleware
userSchema.index({ activeSessionToken: 1 });

// Phone uniqueness checks on profile save
userSchema.index({ "founderProfile.phone": 1 });
userSchema.index({ "investorProfile.phone": 1 });

// assertConnected + /connected page
userSchema.index({ connections: 1 });

// /connections/feed filters
userSchema.index({ blockedBy: 1 });
userSchema.index({ reportedUsers: 1 });

// Photo existence check in feed (sparse — only indexes users who have a photo)
userSchema.index({ "founderProfile.photo": 1 },  { sparse: true });
userSchema.index({ "investorProfile.photo": 1 }, { sparse: true });

// ── Pre-save hook ──────────────────────────────────────────────────────────
userSchema.pre("save", async function () {
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.recoveryPin === "") this.recoveryPin = undefined;

  if (!Array.isArray(this.skippedUsers))    this.skippedUsers    = [];
  if (!Array.isArray(this.connections))     this.connections     = [];
  if (!Array.isArray(this.interestedUsers)) this.interestedUsers = [];
  if (!Array.isArray(this.blockedBy))       this.blockedBy       = [];
  if (!Array.isArray(this.reportedUsers))   this.reportedUsers   = [];

  // FIX 4: Trim notifications to last 100 on every save
  if (Array.isArray(this.notifications) && this.notifications.length > 100) {
    this.notifications = this.notifications.slice(-100);
  }
});

module.exports = mongoose.model("User", userSchema);