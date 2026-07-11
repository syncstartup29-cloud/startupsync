import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { verifyAuth } from "@/lib/auth";

export async function GET(request, { params }) {
  await dbConnect();
  const { action } = await params;

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "list": {
        // GET /api/notifications/list (previously GET /notifications)
        const user = await User.findById(auth.userId).select("notifications").lean();
        if (!user) return NextResponse.json({ success: false });

        const notifications = (user.notifications || [])
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const refIds = [...new Set(
          notifications
            .filter(n => n.refUserId && mongoose.Types.ObjectId.isValid(n.refUserId))
            .map(n => n.refUserId.toString())
        )];

        let photoMap = {};
        if (refIds.length > 0) {
          const refUsers = await User.find({ _id: { $in: refIds } })
            .select("fullName role founderProfile.photo investorProfile.photo")
            .lean();
          refUsers.forEach(u => {
            const photo = u.role === "Founder"
              ? (u.founderProfile?.photo || "")
              : (u.investorProfile?.photo || "");
            photoMap[u._id.toString()] = {
              photo,
              name: u.fullName || "",
            };
          });
        }

        const enriched = notifications.map(n => {
          const ref = n.refUserId ? photoMap[n.refUserId.toString()] : null;
          return {
            ...n,
            senderPhoto: ref?.photo || "",
            senderName: ref?.name || n.senderName || "",
          };
        });

        return NextResponse.json({ success: true, notifications: enriched });
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
      case "mark-seen": {
        await User.updateOne({ _id: auth.userId }, { $set: { "notifications.$[].seen": true } });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
