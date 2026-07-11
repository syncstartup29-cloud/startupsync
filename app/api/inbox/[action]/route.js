import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { verifyAuth } from "@/lib/auth";
import { pushNotification } from "@/lib/notifications";

export async function GET(request, { params }) {
  await dbConnect();
  const { action } = await params;

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "list": {
        // populated inboxRequests list (previously /inbox)
        const user = await User.findById(auth.userId)
          .populate("inboxRequests.fromUserId", "fullName email role founderProfile investorProfile")
          .select("inboxRequests");
        if (!user) return NextResponse.json({ success: false, requests: [] });

        const requests = (user.inboxRequests || []).map(r => {
          const from = r.fromUserId;
          if (!from) return null;
          const isF = from.role === "Founder";
          const profile = isF ? (from.founderProfile || {}) : (from.investorProfile || {});
          const base = {
            _id: r._id, status: r.status, seen: r.seen, createdAt: r.createdAt,
            fromUser: { _id: from._id, fullName: from.fullName, role: from.role, photo: profile.photo || "", subtitle: isF ? (profile.startupName || "") : (profile.investmentFocus || "") },
          };
          if (r.status === "accepted") {
            base.sharedData = {
              _id: from._id, fullName: from.fullName, email: from.email, role: from.role,
              phone: (profile.phone || "").toString(),
              founderProfile: isF ? { startupName: profile.startupName || "", description: profile.description || "", photo: profile.photo || "" } : null,
              investorProfile: !isF ? { investorType: profile.investorType || "", investmentFocus: profile.investmentFocus || "", financialCapacity: profile.financialCapacity || "", investmentCurrency: profile.investmentCurrency || "", bio: profile.bio || "", photo: profile.photo || "" } : null,
            };
          }
          return base;
        }).filter(Boolean);

        return NextResponse.json({ success: true, requests });
      }

      case "sent": {
        const user = await User.findById(auth.userId)
          .populate({ path: "sentRequests.toUserId", select: "fullName email phone role founderProfile investorProfile" })
          .select("sentRequests");
        if (!user) return NextResponse.json({ success: false, requests: [] });

        const requests = (user.sentRequests || []).map(r => {
          const to = r.toUserId;
          if (!to) return null;
          const isF = to.role === "Founder";
          const profile = isF ? (to.founderProfile || {}) : (to.investorProfile || {});
          let shared = null;
          if (r.status === "accepted") {
            shared = {
              email: to.email || "", phone: to.phone || profile.phone || "", role: to.role,
              ...(isF && { founderProfile: { startupName: profile.startupName || "", description: profile.description || "" } }),
              ...(!isF && { investorProfile: { investorType: profile.investorType || "", investmentFocus: profile.investmentFocus || "", financialCapacity: profile.financialCapacity || "", investmentCurrency: profile.investmentCurrency || "", bio: profile.bio || "" } }),
            };
          }
          return { _id: r._id, status: r.status, createdAt: r.createdAt, toUser: { _id: to._id, fullName: to.fullName, email: to.email, role: to.role, photo: profile.photo || "", subtitle: isF ? (profile.startupName || "") : (profile.investmentFocus || "") }, shared };
        }).filter(Boolean);

        return NextResponse.json({ success: true, requests });
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
      case "accept": {
        const { requestId } = body;
        if (!requestId || !mongoose.Types.ObjectId.isValid(requestId))
          return NextResponse.json({ success: false });

        const receiverId = new mongoose.Types.ObjectId(auth.userId);
        const receiver = await User.findById(receiverId).select("inboxRequests fullName");
        if (!receiver) return NextResponse.json({ success: false });

        const reqDoc = receiver.inboxRequests.id(requestId);
        if (!reqDoc) return NextResponse.json({ success: false });
        if (reqDoc.status !== "pending") return NextResponse.json({ success: true, connected: true });

        const senderId = new mongoose.Types.ObjectId(reqDoc.fromUserId);
        const sender = await User.findById(senderId).select("fullName").lean();

        reqDoc.status = "accepted";
        reqDoc.seen = true;
        await receiver.save();

        await Promise.all([
          User.updateOne({ _id: senderId, "sentRequests.toUserId": receiverId }, { $set: { "sentRequests.$.status": "accepted" } }),
          User.updateOne({ _id: receiverId }, { $addToSet: { connections: senderId }, $pull: { skippedUsers: senderId } }),
          User.updateOne({ _id: senderId }, { $addToSet: { connections: receiverId }, $pull: { skippedUsers: receiverId } }),
        ]);

        await Promise.all([
          User.updateOne({ _id: receiverId }, { $pull: { sentRequests: { toUserId: senderId } } }),
          User.updateOne({ _id: senderId }, { $pull: { inboxRequests: { fromUserId: receiverId } } }),
          pushNotification(senderId.toString(), "connected", `✅ ${receiver.fullName} accepted your request. You are now connected!`, receiverId.toString()),
          pushNotification(receiverId.toString(), "connected", `✅ You accepted ${sender?.fullName || "their"} request. You are now connected!`, senderId.toString()),
        ]);

        return NextResponse.json({ success: true, connected: true });
      }

      case "decline": {
        const { requestId } = body;
        if (!requestId || !mongoose.Types.ObjectId.isValid(requestId))
          return NextResponse.json({ success: false });

        const receiver = await User.findById(auth.userId).select("inboxRequests fullName");
        if (!receiver) return NextResponse.json({ success: false });

        const reqDoc = receiver.inboxRequests.id(requestId);
        if (!reqDoc) return NextResponse.json({ success: false });
        if (reqDoc.status !== "pending") return NextResponse.json({ success: true });

        reqDoc.status = "declined";
        reqDoc.seen = true;
        await receiver.save();

        await Promise.all([
          User.updateOne({ _id: reqDoc.fromUserId, "sentRequests.toUserId": receiver._id }, { $set: { "sentRequests.$.status": "declined" } }),
          pushNotification(reqDoc.fromUserId.toString(), "declined", `❌ ${receiver.fullName} declined your connection request.`, receiver._id.toString()),
        ]);

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
