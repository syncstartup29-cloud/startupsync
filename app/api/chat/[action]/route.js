import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import dbConnect from "@/lib/dbConnect";
import ChatConversation from "@/models/ChatConversation";
import ChatMessage from "@/models/ChatMessage";
import User from "@/models/User";
import { verifyAuth } from "@/lib/auth";
import { makePairKey, roomFromPairKey, assertConnected, isUserBlockedBy } from "@/lib/utils";
import { emitSocketEvent } from "@/lib/socket";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function GET(request, { params }) {
  await dbConnect();
  const { action } = await params;

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "history": {
        const { searchParams } = new URL(request.url);
        const peerId = searchParams.get("peerId");
        if (!peerId || !mongoose.Types.ObjectId.isValid(peerId))
          return NextResponse.json({ success: false });

        const pairKey = makePairKey(auth.userId, peerId);
        const convo = await ChatConversation.findOne({ pairKey }).lean();

        if (!convo) {
          return NextResponse.json({ success: true, messages: [] });
        }

        const clearedAt = convo.clearedAt?.[auth.userId] || null;
        const query = { conversationId: convo._id };
        if (clearedAt) query.createdAt = { $gt: clearedAt };

        const msgs = await ChatMessage.find(query).sort({ createdAt: 1 }).lean();
        return NextResponse.json({
          success: true,
          messages: msgs.map(m => ({
            _id: m._id,
            fromUserId: m.senderId,
            toUserId: m.receiverId,
            text: m.deleted ? "" : (m.text || ""),
            file: m.deleted ? "" : (m.file || ""),
            fileName: m.deleted ? "" : (m.fileName || ""),
            createdAt: m.createdAt,
            seen: !!m.seen,
            seenAt: m.seenAt || null,
            edited: !!m.edited,
            deleted: !!m.deleted,
          })),
        });
      }

      case "unread-counts": {
        const results = await ChatMessage.aggregate([
          {
            $match: {
              receiverId: new mongoose.Types.ObjectId(auth.userId),
              seen: { $ne: true },
              $or: [{ deleted: { $exists: false } }, { deleted: false }, { deleted: null }],
            },
          },
          {
            $group: { _id: "$senderId", count: { $sum: 1 } },
          },
        ]);

        const counts = {};
        for (const r of results) {
          if (r._id) counts[r._id.toString()] = r.count;
        }

        return NextResponse.json({ success: true, counts });
      }

      case "archived": {
        const convos = await ChatConversation.find({
          [`archivedBy.${auth.userId}`]: true,
          participants: auth.userId,
        }).lean();
        const archivedPeerIds = convos.map(c =>
          (c.participants || []).find(p => p.toString() !== auth.userId.toString())?.toString()
        ).filter(Boolean);
        return NextResponse.json({ success: true, archivedPeerIds });
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

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "send": {
        const body = await request.json().catch(() => ({}));
        const { toUserId, text } = body;
        const cleanText = String(text || "").trim();
        if (!toUserId || !cleanText || !mongoose.Types.ObjectId.isValid(toUserId))
          return NextResponse.json({ success: false });

        const connected = await assertConnected(auth.userId, toUserId);
        if (!connected) return NextResponse.json({ success: false, message: "You are not connected with this user" });
        const blocked = await isUserBlockedBy(auth.userId, toUserId);
        if (blocked) return NextResponse.json({ success: false, message: "You have been blocked" });

        const pairKey = makePairKey(auth.userId, toUserId);
        const convo = await ChatConversation.findOneAndUpdate(
          { pairKey },
          { $setOnInsert: { pairKey, participants: [auth.userId, toUserId] } },
          { upsert: true, new: true }
        );

        const msg = await ChatMessage.create({
          conversationId: convo._id, senderId: auth.userId, receiverId: toUserId,
          text: cleanText, seen: false,
        });

        await ChatConversation.updateOne({ _id: convo._id }, { $set: { lastMessageText: cleanText, lastMessageAt: new Date() } });

        const sender = await User.findById(auth.userId).select("fullName role founderProfile.photo investorProfile.photo").lean();
        const fromUserName = sender?.fullName || "";
        const fromUserPhoto = sender?.role === "Founder" ? (sender?.founderProfile?.photo || "") : (sender?.investorProfile?.photo || "");
        const payload = { _id: msg._id, fromUserId: msg.senderId, toUserId: msg.receiverId, text: msg.text, createdAt: msg.createdAt, seen: msg.seen, seenAt: msg.seenAt, fromUserName, fromUserPhoto };

        // Emit new message via internal event emitter to Socket.IO server
        const socketServerUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3000";
        await fetch(`${socketServerUrl}/internal/emit-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.ADMIN_SECRET,
            pairKey,
            toUserId,
            payload,
          }),
        }).catch(() => {});

        return NextResponse.json({ success: true, message: msg });
      }

      case "upload": {
        const formData = await request.formData();
        const file = formData.get("file");
        const toUserId = formData.get("toUserId");
        const originalName = formData.get("originalName") || file?.name || "file";

        if (!toUserId || !file || !mongoose.Types.ObjectId.isValid(toUserId))
          return NextResponse.json({ success: false, message: "Missing params" });

        const connected = await assertConnected(auth.userId, toUserId);
        if (!connected) return NextResponse.json({ success: false, message: "You are not connected with this user" });
        const blocked = await isUserBlockedBy(auth.userId, toUserId);
        if (blocked) return NextResponse.json({ success: false, message: "You have been blocked" });

        const pairKey = makePairKey(auth.userId, toUserId);
        const convo = await ChatConversation.findOneAndUpdate(
          { pairKey },
          { $setOnInsert: { pairKey, participants: [auth.userId, toUserId] } },
          { upsert: true, new: true }
        );

        // MIME type whitelist
        const ALLOWED_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "video/mp4", "video/webm", "text/plain", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
        if (!ALLOWED_MIME.includes(file.type))
          return NextResponse.json({ success: false, message: "File type not allowed" });

        const buffer = Buffer.from(await file.arrayBuffer());

        const mime = file.type || "";
        const resourceType = mime.startsWith("video/") ? "video" : mime === "application/pdf" ? "raw" : "image";
        const folder = mime.startsWith("video/") ? "startupsync/chat/videos" : mime === "application/pdf" ? "startupsync/chat/pdfs" : "startupsync/chat/images";

        const cloudResult = await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Cloudinary upload timeout")), 60000);
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType, folder, timeout: 60000 },
            (error, result) => { clearTimeout(timer); error ? reject(error) : resolve(result); }
          );
          stream.end(buffer);
        });

        const filePath = cloudResult.secure_url;

        const msg = await ChatMessage.create({
          conversationId: convo._id, senderId: auth.userId, receiverId: toUserId,
          text: "", file: filePath, fileName: originalName, seen: false,
        });

        const sender = await User.findById(auth.userId).select("fullName role founderProfile.photo investorProfile.photo").lean();
        const fromUserName = sender?.fullName || "New Message";
        const fromUserPhoto = sender?.role === "Founder" ? (sender?.founderProfile?.photo || "") : (sender?.investorProfile?.photo || "");

        const payload = { _id: msg._id, fromUserId: msg.senderId, toUserId: msg.receiverId, text: msg.text, file: msg.file, fileName: msg.fileName || originalName, createdAt: msg.createdAt, seen: msg.seen, seenAt: msg.seenAt, fromUserName, fromUserPhoto };

        // Emit new message to Socket.IO server
        const socketServerUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3000";
        await fetch(`${socketServerUrl}/internal/emit-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.ADMIN_SECRET,
            pairKey,
            toUserId,
            payload,
          }),
        }).catch(() => {});

        return NextResponse.json({ success: true, file: filePath, message: payload });
      }

      case "delete": {
        const body = await request.json().catch(() => ({}));
        const { peerId, messageId } = body;
        if (!peerId || !messageId || !mongoose.Types.ObjectId.isValid(peerId) || !mongoose.Types.ObjectId.isValid(messageId))
          return NextResponse.json({ success: false });

        const ok = await assertConnected(auth.userId, peerId);
        if (!ok) return NextResponse.json({ success: false });

        const m = await ChatMessage.findById(messageId);
        if (!m) return NextResponse.json({ success: false });
        if (m.senderId.toString() !== auth.userId.toString()) return NextResponse.json({ success: false, message: "Not allowed" });

        await ChatMessage.updateOne({ _id: messageId }, { $set: { deleted: true, text: "", file: "", seen: true, seenAt: new Date() } });

        const pairKey = makePairKey(auth.userId, peerId);
        const room = roomFromPairKey(pairKey);
        await emitSocketEvent(room, "chat:messageDeleted", { messageId: messageId.toString() });
        await emitSocketEvent(peerId.toString(), "chat:messageDeleted", { messageId: messageId.toString() });
        await emitSocketEvent(`user:${peerId}`, "chat:unreadUpdate", { fromUserId: auth.userId });

        return NextResponse.json({ success: true });
      }

      case "delete-conversation": {
        const body = await request.json().catch(() => ({}));
        const { peerId } = body;
        if (!peerId || !mongoose.Types.ObjectId.isValid(peerId))
          return NextResponse.json({ success: false });

        const ok = await assertConnected(auth.userId, peerId);
        if (!ok) return NextResponse.json({ success: false });

        const pairKey = makePairKey(auth.userId, peerId);
        await ChatConversation.findOneAndUpdate(
          { pairKey },
          { $set: { [`clearedAt.${auth.userId}`]: new Date() } },
          { upsert: true }
        );
        return NextResponse.json({ success: true });
      }

      case "edit": {
        const body = await request.json().catch(() => ({}));
        const { peerId, messageId, text } = body;
        const cleanText = String(text || "").trim();
        if (!peerId || !messageId || !cleanText || !mongoose.Types.ObjectId.isValid(peerId) || !mongoose.Types.ObjectId.isValid(messageId))
          return NextResponse.json({ success: false });

        const ok = await assertConnected(auth.userId, peerId);
        if (!ok) return NextResponse.json({ success: false });

        const m = await ChatMessage.findById(messageId);
        if (!m) return NextResponse.json({ success: false });
        if (m.senderId.toString() !== auth.userId.toString()) return NextResponse.json({ success: false, message: "Not allowed" });
        if (m.file) return NextResponse.json({ success: false, message: "Cannot edit a file message" });

        m.text = cleanText;
        m.edited = true;
        await m.save();

        const pairKey = makePairKey(auth.userId, peerId);
        await emitSocketEvent(roomFromPairKey(pairKey), "chat:messageEdited", { messageId: messageId.toString(), text: cleanText });
        return NextResponse.json({ success: true });
      }

      case "archive": {
        const body = await request.json().catch(() => ({}));
        const { peerId, archive } = body;
        if (!peerId || !mongoose.Types.ObjectId.isValid(peerId))
          return NextResponse.json({ success: false, message: "Invalid peerId" });
        const pairKey = makePairKey(auth.userId, peerId);
        const archived = archive !== false;
        await ChatConversation.findOneAndUpdate(
          { pairKey },
          {
            $set: {
              [`archivedBy.${auth.userId}`]: archived,
              [`archivedByAt.${auth.userId}`]: archived ? new Date() : null,
            },
            $setOnInsert: { pairKey, participants: [auth.userId, peerId] },
          },
          { upsert: true, new: true }
        );
        return NextResponse.json({ success: true, archived });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    console.error(`Chat API error for action ${action}:`, e);
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
