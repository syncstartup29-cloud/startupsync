import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { verifyAuth } from "@/lib/auth";

export async function GET(request) {
  await dbConnect();

  try {
    await verifyAuth(request);

    const [founders, investors] = await Promise.all([
      User.countDocuments({ role: "Founder" }),
      User.countDocuments({ role: "Investor" }),
    ]);

    return NextResponse.json({ success: true, founders, investors });
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
