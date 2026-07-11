import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Feedback from "@/models/Feedback";
import { verifyAdminAuth } from "@/lib/auth";

export async function PATCH(request, { params }) {
  await dbConnect();
  const { id, status } = await params;

  try {
    await verifyAdminAuth(request);

    if (!mongoose.Types.ObjectId.isValid(id))
      return NextResponse.json({ success: false, message: "Invalid ID" });

    if (status === "seen") {
      await Feedback.findByIdAndUpdate(id, { seen: true });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, message: "Invalid status action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
