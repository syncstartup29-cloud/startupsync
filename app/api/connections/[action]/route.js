import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { verifyAuth } from "@/lib/auth";
import { emitSocketEvent } from "@/lib/socket";
import { pushNotification } from "@/lib/notifications";

// Helper methods from server.js
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

export async function GET(request, { params }) {
  await dbConnect();
  const { action } = await params;

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "feed": {
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
        const limit = Math.min(20, parseInt(searchParams.get("limit")) || 20);
        const skip = (page - 1) * limit;

        const cu = await User.findById(auth.userId)
          .select("role skippedUsers reportedUsers interestedUsers inboxRequests sentRequests connections termsAccepted")
          .lean();
        if (!cu) return NextResponse.json({ success: false, message: "User not found" });

        const oppositeRole = cu.role === "Founder" ? "Investor" : "Founder";
        const inboxPendingFrom = new Set((cu.inboxRequests || []).filter(r => r.status === "pending" && r.fromUserId).map(r => String(r.fromUserId)));
        const sentPendingTo = new Set((cu.sentRequests || []).filter(r => r.status === "pending" && r.toUserId).map(r => String(r.toUserId)));
        const connSet = new Set((cu.connections || []).map(x => String(x)));

        const excludeIds = [
          String(auth.userId),
          ...(cu.skippedUsers || []).map(x => String(x)),
          ...(cu.reportedUsers || []).map(x => String(x)),
          ...(cu.interestedUsers || []).map(x => String(x)),
          ...Array.from(connSet),
        ].filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

        const query = {
          role: oppositeRole,
          termsAccepted: true,
          isSuspended: { $ne: true },
          _id: { $nin: excludeIds },
          blockedBy: { $ne: auth.userId },
          reportedUsers: { $ne: auth.userId },
          $or: [
            { "founderProfile.photo": { $exists: true, $ne: "" } },
            { "investorProfile.photo": { $exists: true, $ne: "" } },
          ],
        };

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
            iSentThemRequest: sentPendingTo.has(id),
            alreadyConnected: connSet.has(id),
          };
        });

        return NextResponse.json({
          success: true,
          users: enriched,
          pagination: {
            page,
            limit,
            hasMore: users.length === limit,
          },
        });
      }

      case "connected": {
        const u = await User.findById(auth.userId).select("connections").lean();
        if (!u) return NextResponse.json({ success: false });
        const ids = (u.connections || []).map(id => id.toString());
        if (!ids.length) return NextResponse.json({ success: true, users: [] });

        const users = await User.find({ _id: { $in: ids } })
          .select("_id fullName role founderProfile investorProfile").lean();
        const map = new Map(users.map(x => [x._id.toString(), x]));

        return NextResponse.json({ success: true, users: ids.map(id => map.get(id)).filter(Boolean) });
      }

      case "skipped": {
        const user = await User.findById(auth.userId)
          .populate("skippedUsers", "fullName role founderProfile investorProfile")
          .select("skippedUsers")
          .lean();
        return NextResponse.json({ success: true, users: user?.skippedUsers || [] });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}

export async function POST(request, { params }) {
  await dbConnect();
  const { action } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "remove": {
        const { targetId } = body;
        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId))
          return NextResponse.json({ success: false });

        const uId = new mongoose.Types.ObjectId(auth.userId);
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

        await emitSocketEvent(`user:${tId.toString()}`, "user:blocked", { byUserId: auth.userId, byUserName: reporterName });
        await emitSocketEvent(`user:${tId.toString()}`, "connection:removed", { removedBy: auth.userId, removedByName: reporterName });
        await pushNotification(tId.toString(), "block", `🚫 ${reporterName} has removed and blocked you.`, auth.userId);

        return NextResponse.json({ success: true });
      }

      case "skip": {
        const { targetId } = body;
        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId))
          return NextResponse.json({ success: false });
        await User.findByIdAndUpdate(auth.userId, { $addToSet: { skippedUsers: targetId } });
        return NextResponse.json({ success: true });
      }

      case "skipped-remove": {
        const { targetId } = body;
        if (!targetId || !mongoose.Types.ObjectId.isValid(targetId))
          return NextResponse.json({ success: false });
        const upd = await User.updateOne({ _id: auth.userId }, { $pull: { skippedUsers: targetId } });
        return NextResponse.json({ success: true, modified: upd.modifiedCount });
      }

      case "interested": {
        const { toUserId } = body;
        if (!toUserId || !mongoose.Types.ObjectId.isValid(toUserId))
          return NextResponse.json({ success: false, message: "Invalid data" });
        if (auth.userId === toUserId) return NextResponse.json({ success: false, message: "Cannot request yourself" });

        const fromId = new mongoose.Types.ObjectId(auth.userId);
        const toId = new mongoose.Types.ObjectId(toUserId);

        if (await User.findOne({ _id: fromId, connections: toId }).select("_id").lean())
          return NextResponse.json({ success: true, connected: true, message: "Already connected" });

        const [fromUser, toUser] = await Promise.all([
          User.findById(fromId).select("fullName").lean(),
          User.findById(toId).select("fullName").lean(),
        ]);
        const fromName = fromUser?.fullName || "Someone";
        const toName = toUser?.fullName || "Someone";

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
          return NextResponse.json({ success: true, connected: true, message: r.already ? "Already connected" : "Auto-connected" });
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
          User.findOne({ _id: toId, inboxRequests: { $elemMatch: { fromUserId: fromId, status: "pending" } } }).select("_id").lean(),
        ]);

        if (fromHasToPending && toHasFromPending) {
          const r = await autoConnectPair(fromId, toId);
          if (!r.already) {
            await Promise.all([
              pushNotification(fromId.toString(), "auto_connected", `🤝 You and ${toName} are now auto-connected!`, toId.toString()),
              pushNotification(toId.toString(), "auto_connected", `🤝 You and ${fromName} are now auto-connected!`, fromId.toString()),
            ]);
          }
          return NextResponse.json({ success: true, connected: true, message: r.already ? "Already connected" : "Auto-connected" });
        }

        await Promise.all([
          pushNotification(toId.toString(), "request_received", `📥 ${fromName} sent you a connection request.`, fromId.toString()),
          pushNotification(fromId.toString(), "request_sent", `📤 You sent a connection request to ${toName}.`, toId.toString()),
        ]);

        return NextResponse.json({ success: true, connected: false, message: "Request sent" });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
