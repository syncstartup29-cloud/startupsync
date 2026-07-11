import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import HelpRequest from "@/models/Helprequest";
import Feedback from "@/models/Feedback";
import { verifyAdminAuth } from "@/lib/auth";

export async function GET(request, { params }) {
  await dbConnect();
  const { action } = await params;

  try {
    const admin = await verifyAdminAuth(request);

    switch (action) {
      case "stats": {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const [total, founders, investors, newThisWeek, totalConnections] = await Promise.all([
          User.countDocuments(),
          User.countDocuments({ role: "Founder" }),
          User.countDocuments({ role: "Investor" }),
          User.countDocuments({ createdAt: { $gte: weekAgo } }),
          User.aggregate([
            { $project: { count: { $size: { $ifNull: ["$connections", []] } } } },
            { $group: { _id: null, total: { $sum: "$count" } } },
          ]),
        ]);

        const totalConn = totalConnections[0]?.total || 0;
        return NextResponse.json({
          success: true,
          stats: {
            total,
            founders,
            investors,
            newThisWeek,
            totalConnections: Math.floor(totalConn / 2),
          },
        });
      }

      case "founders": {
        const founders = await User.find({ role: "Founder" })
          .select("fullName email role founderProfile connections termsAccepted createdAt skippedUsers reportedUsers")
          .sort({ createdAt: -1 })
          .lean();

        const enriched = founders.map((u) => ({
          _id: u._id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          termsAccepted: u.termsAccepted || false,
          connectionsCount: (u.connections || []).length,
          skippedCount: (u.skippedUsers || []).length,
          reportedCount: (u.reportedUsers || []).length,
          joinedAt: u.createdAt,
          profile: u.founderProfile || {},
        }));

        return NextResponse.json({ success: true, founders: enriched });
      }

      case "investors": {
        const investors = await User.find({ role: "Investor" })
          .select("fullName email role investorProfile connections termsAccepted createdAt skippedUsers reportedUsers")
          .sort({ createdAt: -1 })
          .lean();

        const enriched = investors.map((u) => ({
          _id: u._id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          termsAccepted: u.termsAccepted || false,
          connectionsCount: (u.connections || []).length,
          skippedCount: (u.skippedUsers || []).length,
          reportedCount: (u.reportedUsers || []).length,
          joinedAt: u.createdAt,
          profile: u.investorProfile || {},
        }));

        return NextResponse.json({ success: true, investors: enriched });
      }

      case "help-unread-count": {
        const count = await HelpRequest.countDocuments({ seen: false });
        return NextResponse.json({ success: true, count });
      }

      case "help-list": {
        const requests = await HelpRequest.find().sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, requests });
      }

      case "feedback-unread-count": {
        const count = await Feedback.countDocuments({ seen: false });
        return NextResponse.json({ success: true, count });
      }

      case "feedback-list": {
        const feedbacks = await Feedback.find().sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, feedbacks });
      }

      case "clean-old-notifications": {
        const result = await User.updateMany(
          {},
          { $pull: { notifications: { type: { $in: ["request_sent", "request_received", "skip", "unskip"] } } } }
        );
        return NextResponse.json({ success: true, usersUpdated: result.modifiedCount });
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
    switch (action) {
      case "login": {
        const body = await request.json().catch(() => ({}));
        const { password } = body;

        const ADMIN_SECRET = process.env.ADMIN_SECRET;
        const JWT_SECRET = process.env.JWT_SECRET;

        if (!ADMIN_SECRET || !JWT_SECRET) {
          return NextResponse.json({ success: false, message: "Server configuration error" }, { status: 500 });
        }

        if (password !== ADMIN_SECRET) {
          return NextResponse.json({ success: false, message: "Invalid admin password" }, { status: 401 });
        }

        const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "8h" });
        return NextResponse.json({ success: true, message: "Login successful", token });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: 500 });
  }
}
