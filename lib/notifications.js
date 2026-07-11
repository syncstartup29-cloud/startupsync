import mongoose from "mongoose";
import User from "../models/User";
import { emitSocketEvent } from "./socket";

export async function pushNotification(userId, type, message, refUserId = null) {
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return;
    const notif = {
      type,
      message,
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
    // Emit real-time to user on their socket room
    await emitSocketEvent(`user:${userId}`, "notification:new", notif);
  } catch (e) {
    console.error("pushNotification error:", e);
  }
}
