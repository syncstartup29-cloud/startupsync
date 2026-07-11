import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import dbConnect from "@/lib/dbConnect";
import HelpRequest from "@/models/Helprequest";
import User from "@/models/User";
import { verifyAuth } from "@/lib/auth";
import { emitSocketEvent } from "@/lib/socket";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request) {
  await dbConnect();

  try {
    const auth = await verifyAuth(request);
    const formData = await request.formData();
    const problem = formData.get("problem");
    const screenshot = formData.get("screenshot");

    const cleanProblem = (problem || "").trim();
    if (!cleanProblem) return NextResponse.json({ success: false, message: "Problem description is required" });
    if (cleanProblem.length < 10) return NextResponse.json({ success: false, message: "Please describe your problem in at least 10 characters" });

    let userName = "Anonymous", userEmail = "", userRole = "";
    const u = await User.findById(auth.userId).select("fullName email role").lean();
    if (u) {
      userName = u.fullName || "Anonymous";
      userEmail = u.email || "";
      userRole = u.role || "";
    }

    let screenshotPath = "";
    if (screenshot && screenshot.size > 0) {
      // Validate type
      const allowed = /jpeg|jpg|png|gif|webp/;
      if (!allowed.test(screenshot.type)) {
        return NextResponse.json({ success: false, message: "Only image files allowed for screenshot" });
      }
      if (screenshot.size > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, message: "Screenshot must be less than 5MB" });
      }

      const buffer = Buffer.from(await screenshot.arrayBuffer());
      const cloudResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "startupsync/help" },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(buffer);
      });
      screenshotPath = cloudResult.secure_url;
    }

    const helpReq = await HelpRequest.create({
      userId: auth.userId,
      userName,
      userEmail,
      userRole,
      problem: cleanProblem,
      screenshot: screenshotPath,
      seen: false,
      resolved: false,
    });

    await emitSocketEvent("admin", "help:new", {
      id: helpReq._id.toString(),
      userName,
      userEmail,
      problem: cleanProblem.substring(0, 80),
    });

    return NextResponse.json({ success: true, message: "Help request submitted successfully" });
  } catch (e) {
    console.error("Help submission error:", e);
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
