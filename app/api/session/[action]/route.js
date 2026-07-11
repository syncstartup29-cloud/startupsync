import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { emitSocketEvent } from "@/lib/socket";
import { verifyAuth } from "@/lib/auth";

export async function POST(request, { params }) {
  await dbConnect();
  const { action } = await params;

  try {
    switch (action) {
      case "check": {
        const body = await request.json().catch(() => ({}));
        const { token } = body;
        if (!token) return NextResponse.json({ active: false });

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          return NextResponse.json({ active: false });
        }

        if (!decoded?.userId) return NextResponse.json({ active: false });

        const user = await User.findById(decoded.userId).select("activeSessionToken isSuspended").lean();
        if (!user) return NextResponse.json({ active: false, deleted: true });
        if (user.isSuspended) return NextResponse.json({ active: false, deleted: true, suspended: true, success: false });
        if (!user.activeSessionToken) return NextResponse.json({ active: false });

        return NextResponse.json({ active: user.activeSessionToken === token });
      }

      case "beacon-logout": {
        // beacon sends text, try to read text or JSON
        const textBody = await request.text().catch(() => "");
        let token = "";
        try {
          token = JSON.parse(textBody).token || "";
        } catch {
          token = textBody.trim();
        }

        if (!token) return new Response(null, { status: 204 });

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          return new Response(null, { status: 204 });
        }

        if (decoded?.userId) {
          await User.findOneAndUpdate(
            { _id: decoded.userId, activeSessionToken: token },
            { $set: { activeSessionToken: null, lastActiveAt: null } }
          );
        }
        return new Response(null, { status: 204 });
      }

      case "force-logout": {
        const body = await request.json().catch(() => ({}));
        const { token } = body;
        if (!token) return NextResponse.json({ success: false });

        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.userId;
          await User.updateOne({ _id: userId, activeSessionToken: token }, { $set: { activeSessionToken: null } });
          await emitSocketEvent(`user:${userId}`, "auth:forceLogout", {
            reason: "You were logged out because a new account signed in on your device."
          });
          return NextResponse.json({ success: true });
        } catch {
          return NextResponse.json({ success: false });
        }
      }

      case "accept-terms": {
        try {
          const auth = await verifyAuth(request);
          const user = await User.findByIdAndUpdate(auth.userId, { $set: { termsAccepted: true } });
          if (!user) return NextResponse.json({ success: false });
          return NextResponse.json({ success: true });
        } catch (e) {
          return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
        }
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error(`Session API error for action ${action}:`, err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
