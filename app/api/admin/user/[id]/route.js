import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import ChatConversation from "@/models/ChatConversation";
import ChatMessage from "@/models/ChatMessage";
import { verifyAdminAuth } from "@/lib/auth";
import { emitSocketEvent } from "@/lib/socket";

export async function GET(request, { params }) {
  await dbConnect();
  const { id } = await params;

  try {
    await verifyAdminAuth(request);

    if (!mongoose.Types.ObjectId.isValid(id))
      return NextResponse.json({ success: false, message: "Invalid user ID" });

    const user = await User.findById(id).select("-password -recoveryPin").lean();
    if (!user) return NextResponse.json({ success: false, message: "User not found" });

    return NextResponse.json({ success: true, user });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}

export async function DELETE(request, { params }) {
  await dbConnect();
  const { id } = await params;

  try {
    await verifyAdminAuth(request);

    if (!mongoose.Types.ObjectId.isValid(id))
      return NextResponse.json({ success: false, message: "Invalid user ID" });

    const user = await User.findById(id).select("_id connections");
    if (!user) return NextResponse.json({ success: false, message: "User not found" });

    // Mark as suspended & notify via Socket.IO instantly
    await User.findByIdAndUpdate(id, { isSuspended: true });
    await emitSocketEvent(`user:${id.toString()}`, "user:suspended", { userId: id.toString() });

    const connIds = (user.connections || []).map(x => x.toString());
    if (connIds.length > 0) {
      await User.updateMany(
        { _id: { $in: connIds } },
        {
          $pull: {
            connections: id,
            interestedUsers: id,
            skippedUsers: id,
            inboxRequests: { fromUserId: id },
            sentRequests: { toUserId: id },
          },
        }
      );
    }

    await ChatConversation.updateMany({ participants: id }, { $set: { archived: true, archivedAt: new Date() } });
    await ChatMessage.updateMany({ $or: [{ senderId: id }, { receiverId: id }] }, { $set: { senderDeleted: true } });

    if (connIds && connIds.length > 0) {
      for (const connId of connIds) {
        await emitSocketEvent(`user:${connId}`, "account:deleted", { deletedUserId: id.toString(), reason: "violation" });
      }
    }

    await User.findByIdAndDelete(id);
    await emitSocketEvent("admin", "admin:userDeleted", { userId: id.toString() });

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (e) {
    console.error("admin/delete user error:", e);
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
