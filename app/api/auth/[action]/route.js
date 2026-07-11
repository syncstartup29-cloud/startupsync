import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Otp from "@/models/Otp";
import { normalizeEmail, isGmail, isTempEmail, generateUniqueRecoveryPin, generateUserToken } from "@/lib/utils";
import { sendEmail, getOtpEmailHtml } from "@/lib/email";
import { emitSocketEvent } from "@/lib/socket";

export async function POST(request, { params }) {
  await dbConnect();
  const { action } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    switch (action) {
      case "send-otp": {
        const email = normalizeEmail(body.email);
        if (!email) return NextResponse.json({ success: false, message: "Email required" });
        if (!isGmail(email)) return NextResponse.json({ success: false, message: "Only @gmail.com addresses are allowed." });
        if (isTempEmail(email)) return NextResponse.json({ success: false, message: "Temporary or disposable email addresses are not allowed." });

        // Per-email rate limit
        const recentOtp = await Otp.findOne({ email, createdAt: { $gt: new Date(Date.now() - 60 * 1000) } }).lean();
        if (recentOtp) return NextResponse.json({ success: false, message: "Please wait 60 seconds before requesting another OTP." });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await Otp.findOneAndUpdate(
          { email },
          { email, otp, createdAt: new Date(), verified: false },
          { upsert: true, new: true }
        );

        await sendEmail(email, "StartupSync — Verify Your Email", getOtpEmailHtml(otp, "signup"));
        return NextResponse.json({ success: true });
      }

      case "verify-otp": {
        const email = normalizeEmail(body.email);
        const otp = (body.otp || "").trim();
        const record = await Otp.findOne({ email });
        if (!record) return NextResponse.json({ success: false, message: "OTP not found or expired" });
        if (record.otp !== otp) return NextResponse.json({ success: false, message: "Invalid OTP" });

        if (Date.now() - new Date(record.createdAt).getTime() > 5 * 60 * 1000) {
          await Otp.deleteOne({ email });
          return NextResponse.json({ success: false, message: "OTP expired" });
        }

        record.verified = true;
        await record.save();
        return NextResponse.json({ success: true });
      }

      case "signup": {
        const fullName = (body.fullName || "").trim();
        const email = normalizeEmail(body.email);
        const password = body.password || "";
        const role = (body.role || "").trim();

        if (!fullName || !email || !password || !role)
          return NextResponse.json({ success: false, message: "All fields required" });
        if (!isGmail(email))
          return NextResponse.json({ success: false, message: "Only @gmail.com addresses are allowed." });
        if (isTempEmail(email))
          return NextResponse.json({ success: false, message: "Temporary email addresses are not allowed." });

        const localPart = email.split("@")[0];
        if (/^\d+$/.test(localPart) && localPart.length > 8)
          return NextResponse.json({ success: false, message: "Please use a real Gmail address." });
        if (/^(.)\1{6,}$/.test(localPart))
          return NextResponse.json({ success: false, message: "Please use a real Gmail address." });

        if (password.length < 8 || !/[!@#$%^&*(),.?":{}|<>]/.test(password) || !/[0-9]/.test(password) || !/[a-zA-Z]/.test(password))
          return NextResponse.json({ success: false, message: "Password must be at least 8 characters and include a letter, number and special character" });

        const otpData = await Otp.findOne({ email });
        if (!otpData || otpData.verified !== true)
          return NextResponse.json({ success: false, message: "Verify OTP first" });

        if (await User.findOne({ email }).select("_id").lean())
          return NextResponse.json({ success: false, message: "Email already exists" });

        const hashed = await bcrypt.hash(password, 10);
        const recoveryPin = await generateUniqueRecoveryPin();
        const user = await User.create({ fullName, email, password: hashed, role, recoveryPin });

        await Otp.deleteOne({ email });

        // Emit real-time to admin
        await emitSocketEvent("admin", "user:new", { userId: user._id.toString(), role: user.role });

        const token = generateUserToken(user._id);

        return NextResponse.json({
          success: true,
          recoveryPin,
          token,
          user: { _id: user._id, fullName: user.fullName, email: user.email, role: user.role, termsAccepted: user.termsAccepted },
        });
      }

      case "login": {
        const email = normalizeEmail(body.email);
        const password = body.password || "";
        if (!email || !password) return NextResponse.json({ success: false, message: "Email and password required" });

        const user = await User.findOne({ email });
        if (!user) return NextResponse.json({ success: false, message: "Invalid email or password" });
        if (!await bcrypt.compare(password, user.password)) return NextResponse.json({ success: false, message: "Invalid email or password" });

        if (user.activeSessionToken) {
          // Kick old device via socket
          await emitSocketEvent(`user:${user._id.toString()}`, "auth:forceLogout", { reason: "newLogin" });
          await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: null, lastActiveAt: null } });
        }

        const token = generateUserToken(user._id);
        await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });

        const safeUser = user.toObject();
        delete safeUser.password;
        delete safeUser.recoveryPin;
        delete safeUser.activeSessionToken;

        return NextResponse.json({ success: true, token, user: safeUser });
      }

      case "login-force": {
        const { userId, currentToken } = body;
        if (!userId || !currentToken) return NextResponse.json({ success: false, message: "Invalid request" });

        const user = await User.findById(userId);
        if (!user) return NextResponse.json({ success: false, message: "User not found" });
        if (!user.activeSessionToken || user.activeSessionToken !== currentToken)
          return NextResponse.json({ success: false, message: "Session mismatch" });

        const token = generateUserToken(user._id);
        await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });

        // Kick the old device
        await emitSocketEvent(`user:${userId}`, "auth:forceLogout", { newToken: token });

        const safeUser = user.toObject();
        delete safeUser.password;
        delete safeUser.recoveryPin;
        delete safeUser.activeSessionToken;

        return NextResponse.json({ success: true, token, user: safeUser });
      }

      case "login-takeover": {
        const { userId, password } = body;
        if (!userId || !password) return NextResponse.json({ success: false, message: "Invalid request" });

        const user = await User.findById(userId);
        if (!user) return NextResponse.json({ success: false, message: "User not found" });

        if (!await bcrypt.compare(password, user.password))
          return NextResponse.json({ success: false, message: "Invalid credentials" });

        const token = generateUserToken(user._id);

        if (user.activeSessionToken) {
          await emitSocketEvent(`user:${userId}`, "auth:forceLogout", {
            reason: "Another device logged in to your account.",
            newToken: token,
          });
        }

        await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });

        const safeUser = user.toObject();
        delete safeUser.password;
        delete safeUser.recoveryPin;
        delete safeUser.activeSessionToken;

        return NextResponse.json({ success: true, token, user: safeUser });
      }

      case "logout": {
        const authHeader = request.headers.get("authorization") || "";
        const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const bodyToken = body.token || "";
        const token = headerToken || bodyToken;

        if (token) {
          try {
            const jwt = require("jsonwebtoken");
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded?.userId;
            if (userId) {
              await User.updateOne({ _id: userId, activeSessionToken: token }, { $set: { activeSessionToken: null } });
            }
          } catch {}
        }
        return NextResponse.json({ success: true });
      }

      case "reset-otp": {
        const email = normalizeEmail(body.email);
        if (!email) return NextResponse.json({ success: false, message: "Email required" });

        const user = await User.findOne({ email }).select("_id");
        if (!user) return NextResponse.json({ success: false, message: "No account found" });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        await Otp.findOneAndUpdate(
          { email },
          { email, otp, createdAt: new Date(), verified: false },
          { upsert: true, new: true }
        );

        await sendEmail(email, "StartupSync — Password Reset OTP", getOtpEmailHtml(otp, "reset"));
        return NextResponse.json({ success: true });
      }

      case "reset-password": {
        const email = normalizeEmail(body.email);
        const otp = (body.otp || "").trim();
        const newPassword = body.newPassword || "";

        if (!email || !otp || !newPassword) return NextResponse.json({ success: false, message: "All fields required" });
        if (!/^\d{6}$/.test(otp)) return NextResponse.json({ success: false, message: "OTP must be 6 digits" });

        if (newPassword.length < 8 || !/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[a-zA-Z]/.test(newPassword))
          return NextResponse.json({ success: false, message: "Password must be at least 8 characters and include a letter, number and special character" });

        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) return NextResponse.json({ success: false, message: "Invalid OTP" });

        if (Date.now() - new Date(otpRecord.createdAt).getTime() > 10 * 60 * 1000) {
          await Otp.deleteOne({ email });
          return NextResponse.json({ success: false, message: "OTP expired" });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        const user = await User.findOneAndUpdate({ email }, { $set: { password: hashed } });
        if (!user) return NextResponse.json({ success: false, message: "User not found" });

        await Otp.deleteOne({ email });
        return NextResponse.json({ success: true, message: "Password updated!" });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error(`Auth API error for action ${action}:`, err);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
