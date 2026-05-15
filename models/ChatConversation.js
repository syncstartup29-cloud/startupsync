const mongoose = require("mongoose");

const chatConversationSchema = new mongoose.Schema({
  participants:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  pairKey:         { type: String, unique: true, required: true },
  lastMessageText: String,
  lastMessageAt:   Date,
  clearedAt:       { type: Map, of: Date,    default: {} },

  // Legacy global archive flag (kept for backward compat)
  archived:   { type: Boolean, default: false },
  archivedAt: { type: Date,    default: null  },

  // FIX 6: Per-user archive state — persists across sessions & devices
  archivedBy:   { type: Map, of: Boolean, default: {} },
  archivedByAt: { type: Map, of: Date,    default: {} },
}, { timestamps: true });

chatConversationSchema.index({ participants: 1 });
// pairKey index defined inline above (unique:true) — no duplicate needed

module.exports = mongoose.model("ChatConversation", chatConversationSchema);