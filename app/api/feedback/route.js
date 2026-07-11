import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Feedback from "@/models/Feedback";
import User from "@/models/User";
import { verifyAuth } from "@/lib/auth";
import { emitSocketEvent } from "@/lib/socket";

export async function POST(request) {
  await dbConnect();

  try {
    const auth = await verifyAuth(request);
    const body = await request.json().catch(() => ({}));
    const { rating, message } = body;
    const cleanMsg = (message || "").trim();
    const ratingNum = parseInt(rating);

    if (!cleanMsg) return NextResponse.json({ success: false, message: "Feedback message is required" });
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) return NextResponse.json({ success: false, message: "Rating must be between 1 and 5" });

    let userName = "Anonymous", userEmail = "", userRole = "";
    const u = await User.findById(auth.userId).select("fullName email role").lean();
    if (u) {
      userName = u.fullName || "Anonymous";
      userEmail = u.email || "";
      userRole = u.role || "";
    }

    const feedback = await Feedback.create({
      userId: auth.userId,
      userName,
      userEmail,
      userRole,
      rating: ratingNum,
      message: cleanMsg,
      seen: false,
    });

    await emitSocketEvent("admin", "feedback:new", {
      id: feedback._id.toString(),
      userName,
      rating: ratingNum,
      message: cleanMsg.substring(0, 80)
    });

    return NextResponse.json({ success: true, message: "Feedback submitted successfully" });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
