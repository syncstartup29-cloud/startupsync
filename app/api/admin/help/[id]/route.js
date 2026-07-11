import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import HelpRequest from "@/models/Helprequest";
import { verifyAdminAuth } from "@/lib/auth";

export async function DELETE(request, { params }) {
  await dbConnect();
  const { id } = await params;

  try {
    await verifyAdminAuth(request);

    if (!mongoose.Types.ObjectId.isValid(id))
      return NextResponse.json({ success: false, message: "Invalid ID" });

    await HelpRequest.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
