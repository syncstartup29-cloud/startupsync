const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatConversation", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  text: { type: String, default: "" },
  file: { type: String, default: "" },
  fileName: { type: String, default: "" },
  seen: { type: Boolean, default: false },
  seenAt: Date,
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  senderDeleted: { type: Boolean, default: false },
}, { timestamps: true });

chatMessageSchema.index({ conversationId: 1, createdAt: 1 });
chatMessageSchema.index({ receiverId: 1, seen: 1, deleted: 1 });
chatMessageSchema.index({ conversationId: 1, receiverId: 1, seen: 1 });

module.exports = mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatMessageSchema);