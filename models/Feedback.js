const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    userName:  { type: String, default: "Anonymous", trim: true },
    userEmail: { type: String, default: "", trim: true },
    userRole:  { type: String, default: "" },
    rating:    { type: Number, min: 1, max: 5, required: true },
    message:   { type: String, required: true, trim: true },
    seen:      { type: Boolean, default: false },
  },
  { timestamps: true }
);

// FIX 8: Index on seen — admin queries all unseen feedback frequently
feedbackSchema.index({ seen: 1, createdAt: -1 });

module.exports = mongoose.model("Feedback", feedbackSchema);