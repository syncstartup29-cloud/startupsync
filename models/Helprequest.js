const mongoose = require("mongoose");

const helpRequestSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userName:   { type: String, default: "Anonymous", trim: true },
    userEmail:  { type: String, default: "", trim: true },
    userRole:   { type: String, default: "" },
    problem:    { type: String, required: true, trim: true },
    screenshot: { type: String, default: "" },
    seen:       { type: Boolean, default: false },
    resolved:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

// FIX 9: Indexes for admin queries — unseen + unresolved are the most common filters
helpRequestSchema.index({ seen: 1, resolved: 1, createdAt: -1 });

module.exports = mongoose.model("HelpRequest", helpRequestSchema);