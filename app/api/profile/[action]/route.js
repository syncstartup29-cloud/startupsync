import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import ChatConversation from "@/models/ChatConversation";
import ChatMessage from "@/models/ChatMessage";
import { verifyAuth } from "@/lib/auth";
import { normalizeEmail, isGmail } from "@/lib/utils";
import { emitSocketEvent } from "@/lib/socket";

export async function GET(request, { params }) {
  await dbConnect();
  const { action } = await params;

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "check": {
        const user = await User.findById(auth.userId).select("role founderProfile investorProfile").lean();
        if (!user) return NextResponse.json({ success: false, profileComplete: false });
        let profileComplete = false;
        if (user.role === "Founder") {
          const p = user.founderProfile || {};
          profileComplete = !!(p.photo && p.startupName && p.description && p.phone);
        } else {
          const p = user.investorProfile || {};
          profileComplete = !!(p.photo && p.investorType && p.bio && p.phone);
        }
        return NextResponse.json({ success: true, profileComplete });
      }

      case "get-profile": {
        const user = await User.findById(auth.userId).select("-password -recoveryPin").lean();
        if (!user) return NextResponse.json({ success: false });
        return NextResponse.json({
          success: true,
          user: { _id: user._id, fullName: user.fullName, email: user.email, role: user.role, termsAccepted: user.termsAccepted },
          profile: (user.role === "Founder" ? user.founderProfile : user.investorProfile) || {},
        });
      }

      case "get-user": {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return NextResponse.json({ success: false });

        const user = await User.findById(userId).select("fullName role founderProfile.photo investorProfile.photo").lean();
        if (!user) return NextResponse.json({ success: false });

        const photo = user.role === "Founder" ? (user.founderProfile?.photo || "") : (user.investorProfile?.photo || "");
        return NextResponse.json({ success: true, fullName: user.fullName, photo });
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
  const body = await request.json().catch(() => ({}));

  try {
    const auth = await verifyAuth(request);

    switch (action) {
      case "check-linkedin": {
        const url = (body.linkedinUrl || "").trim();
        if (!url) return NextResponse.json({ taken: false });
        const existing = await User.findOne({
          _id: { $ne: auth.userId },
          $or: [
            { "founderProfile.linkedinUrl": url },
            { "investorProfile.linkedinUrl": url },
          ],
        }).select("_id role").lean();
        return NextResponse.json({ taken: !!existing, byRole: existing ? existing.role : null });
      }

      case "check-phone": {
        const cleaned = (body.phone || "").replace(/\D/g, "").slice(-10);
        if (!cleaned || cleaned.length !== 10) return NextResponse.json({ taken: false });
        const existing = await User.findOne({
          _id: { $ne: auth.userId },
          $or: [
            { "founderProfile.phone": cleaned },
            { "investorProfile.phone": cleaned },
          ],
        }).select("_id role fullName").lean();
        return NextResponse.json({ taken: !!existing, byRole: existing ? existing.role : null });
      }

      case "founder": {
        const fp = body.founderProfile || null;
        const newEmail = normalizeEmail(body.newEmail || "");
        const fullName = (body.fullName || "").trim();

        if (!fp) return NextResponse.json({ success: false, message: "Missing data" });

        const user = await User.findById(auth.userId);
        if (!user) return NextResponse.json({ success: false, message: "User not found" });

        if (user.role !== "Founder")
          return NextResponse.json({ success: false, message: "Role mismatch — you are not a Founder" });

        const phone = (fp.phone || "").replace(/\D/g, "").slice(0, 10);
        if (!/^\d{10}$/.test(phone))
          return NextResponse.json({ success: false, message: "Phone must be 10 digits" }, { status: 400 });

        const phoneExists = await User.findOne({
          _id: { $ne: user._id },
          $or: [{ "founderProfile.phone": phone }, { "investorProfile.phone": phone }],
        }).select("fullName email role founderProfile.phone investorProfile.phone").lean();

        if (phoneExists) {
          const which = phoneExists.founderProfile?.phone === phone ? "Founder profile" : "Investor profile";
          return NextResponse.json({
            success: false,
            field: "phone",
            message: `Phone already exists (${which})`,
            existing: { fullName: phoneExists.fullName, email: phoneExists.email, role: phoneExists.role }
          });
        }

        const description = (fp.description || "").trim();
        if (description.length < 100)
          return NextResponse.json({ success: false, message: "Description must be at least 100 characters" });

        const startupName = (fp.startupName || "").trim();
        if (!startupName) return NextResponse.json({ success: false, message: "Startup name is required" });

        const linkedinUrl = (fp.linkedinUrl || "").trim();
        if (linkedinUrl) {
          if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/.test(linkedinUrl))
            return NextResponse.json({ success: false, message: "Please enter a valid LinkedIn profile URL" });

          const linkedinTaken = await User.findOne({
            _id: { $ne: user._id },
            $or: [
              { "founderProfile.linkedinUrl": linkedinUrl },
              { "investorProfile.linkedinUrl": linkedinUrl },
            ],
          }).select("_id").lean();
          if (linkedinTaken)
            return NextResponse.json({ success: false, field: "linkedinUrl", message: "This LinkedIn profile URL is already registered by another user." });
        }

        if (!fp.photo && !user.founderProfile?.photo)
          return NextResponse.json({ success: false, message: "Profile photo is required" });
        if (fp.photo && fp.photo.length > 1.5 * 1024 * 1024)
          return NextResponse.json({ success: false, message: "Photo is too large. Please use a smaller image." });

        if (fullName) user.fullName = fullName;

        if (newEmail && newEmail !== user.email) {
          if (!isGmail(newEmail))
            return NextResponse.json({ success: false, message: "Only @gmail.com emails are allowed" });
          const emailTaken = await User.findOne({ email: newEmail, _id: { $ne: user._id } }).select("_id").lean();
          if (emailTaken)
            return NextResponse.json({ success: false, message: "This email is already in use by another account" });
          user.email = newEmail;
        }

        user.founderProfile = {
          phone,
          phoneCountry: (fp.phoneCountry || "").trim(),
          linkedinUrl,
          startupName,
          description,
          industry: (fp.industry || "").trim(),
          fundingStage: (fp.fundingStage || "").trim(),
          photo: fp.photo || user.founderProfile?.photo || "",
        };

        await user.save();

        // Emit profile:updated to active viewers
        const socketServerUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3000";
        await fetch(`${socketServerUrl}/internal/profile-updated`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.ADMIN_SECRET,
            userId: user._id.toString(),
            role: "Founder",
            profile: user.founderProfile,
          }),
        }).catch(() => {});

        if (user.founderProfile && user.founderProfile.photo) {
          await emitSocketEvent(null, "feed:newProfile", {
            role: "Founder",
            userId: user._id.toString(),
          });
        }

        const authHeader = request.headers.get("authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (token) {
          await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });
        }

        return NextResponse.json({ success: true, user });
      }

      case "investor": {
        const ip = body.investorProfile || null;
        const newEmail = normalizeEmail(body.newEmail || "");
        const fullName = (body.fullName || "").trim();

        if (!ip) return NextResponse.json({ success: false, message: "Missing data" });

        const user = await User.findById(auth.userId);
        if (!user) return NextResponse.json({ success: false, message: "User not found" });

        if (user.role !== "Investor")
          return NextResponse.json({ success: false, message: "Role mismatch — you are not an Investor" });

        const phone = (ip.phone || "").replace(/\D/g, "").slice(0, 10);
        if (!phone) return NextResponse.json({ success: false, message: "Phone is required" }, { status: 400 });
        if (!/^\d{10}$/.test(phone)) return NextResponse.json({ success: false, message: "Phone must be 10 digits" }, { status: 400 });

        const phoneExists = await User.findOne({
          _id: { $ne: user._id },
          $or: [{ "founderProfile.phone": phone }, { "investorProfile.phone": phone }],
        }).select("fullName email role founderProfile.phone investorProfile.phone").lean();

        if (phoneExists) {
          const which = phoneExists.founderProfile?.phone === phone ? "Founder profile" : "Investor profile";
          return NextResponse.json({
            success: false,
            field: "phone",
            message: `Phone already exists (${which})`,
            existing: { fullName: phoneExists.fullName, email: phoneExists.email, role: phoneExists.role }
          });
        }

        const bio = (ip.bio || "").trim();
        if (bio.length < 100)
          return NextResponse.json({ success: false, message: "Bio must be at least 100 characters" });

        const investorType = (ip.investorType || "").trim();
        const investmentFocus = (ip.investmentFocus || "").trim();
        const financialCapacity = (ip.financialCapacity || "").trim();

        if (!investorType) return NextResponse.json({ success: false, message: "Investor type is required" });
        if (!investmentFocus) return NextResponse.json({ success: false, message: "Investment focus is required" });
        if (!financialCapacity) return NextResponse.json({ success: false, message: "Financial capacity is required" });

        const VALID_CAPACITIES = ["Good", "Nice", "Very Nice", "Excellent"];
        if (!VALID_CAPACITIES.includes(financialCapacity))
          return NextResponse.json({ success: false, message: "Invalid financial capacity." });

        if (!ip.photo && !user.investorProfile?.photo)
          return NextResponse.json({ success: false, message: "Profile photo is required" });
        if (ip.photo && ip.photo.length > 1.5 * 1024 * 1024)
          return NextResponse.json({ success: false, message: "Photo is too large. Please use a smaller image." });

        const linkedinUrl = (ip.linkedinUrl || "").trim();
        if (linkedinUrl) {
          if (!/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/.test(linkedinUrl))
            return NextResponse.json({ success: false, message: "Please enter a valid LinkedIn profile URL" });

          const linkedinTaken = await User.findOne({
            _id: { $ne: user._id },
            $or: [
              { "founderProfile.linkedinUrl": linkedinUrl },
              { "investorProfile.linkedinUrl": linkedinUrl },
            ],
          }).select("_id").lean();
          if (linkedinTaken)
            return NextResponse.json({ success: false, field: "linkedinUrl", message: "This LinkedIn profile URL is already registered." });
        }

        if (fullName) user.fullName = fullName;

        if (newEmail && newEmail !== user.email) {
          if (!isGmail(newEmail))
            return NextResponse.json({ success: false, message: "Only @gmail.com emails are allowed" });
          const emailTaken = await User.findOne({ email: newEmail, _id: { $ne: user._id } }).select("_id").lean();
          if (emailTaken)
            return NextResponse.json({ success: false, message: "This email is already in use by another account" });
          user.email = newEmail;
        }

        user.investorProfile = {
          phone,
          phoneCountry: (ip.phoneCountry || "").trim(),
          linkedinUrl,
          investorType,
          investmentFocus,
          financialCapacity,
          investmentCurrency: (ip.investmentCurrency || "").trim(),
          preferredStage: (ip.preferredStage || "").trim(),
          ticketSize: (ip.ticketSize || "").trim(),
          bio,
          photo: ip.photo || user.investorProfile?.photo || "",
        };

        await user.save();

        // Emit profile:updated to active viewers
        const socketServerUrl = process.env.SOCKET_SERVER_URL || "http://localhost:3000";
        await fetch(`${socketServerUrl}/internal/profile-updated`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: process.env.ADMIN_SECRET,
            userId: user._id.toString(),
            role: "Investor",
            profile: user.investorProfile,
          }),
        }).catch(() => {});

        if (user.investorProfile && user.investorProfile.photo) {
          await emitSocketEvent(null, "feed:newProfile", {
            role: "Investor",
            userId: user._id.toString(),
          });
        }

        const authHeader = request.headers.get("authorization") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
        if (token) {
          await User.findByIdAndUpdate(user._id, { $set: { activeSessionToken: token } });
        }

        return NextResponse.json({ success: true, user });
      }

      case "delete-account": {
        const userToDelete = await User.findById(auth.userId).select("_id fullName connections");
        if (!userToDelete) return NextResponse.json({ success: false, message: "User not found" });

        const connectedUserIds = (userToDelete.connections || []).map(id => id.toString());

        for (const id of connectedUserIds) {
          await emitSocketEvent(`user:${id}`, "account:deleted", {
            deletedUserId: auth.userId,
            deletedUserName: userToDelete.fullName || "User",
            reason: "self"
          });
        }

        await emitSocketEvent(null, "account:deleted", {
          deletedUserId: auth.userId,
          deletedUserName: userToDelete.fullName || "User",
          reason: "self"
        });

        await emitSocketEvent("admin", "account:deleted", {
          deletedUserId: auth.userId,
          deletedUserName: userToDelete.fullName || "User",
          connectedUserIds,
        });

        if (connectedUserIds.length > 0) {
          await User.updateMany(
            { _id: { $in: connectedUserIds } },
            { $pull: { connections: auth.userId, interestedUsers: auth.userId, skippedUsers: auth.userId, inboxRequests: { fromUserId: auth.userId }, sentRequests: { toUserId: auth.userId } } }
          );
        }

        await Promise.all([
          ChatConversation.updateMany({ participants: auth.userId }, { $set: { archived: true, archivedAt: new Date() } }),
          ChatMessage.updateMany({ senderId: auth.userId, seen: false }, { $set: { seen: true, seenAt: new Date(), senderDeleted: true } }),
          ChatMessage.updateMany({ receiverId: auth.userId }, { $set: { senderDeleted: true } }),
          ChatConversation.updateMany(
            { participants: auth.userId },
            { $set: { [`clearedAt.${auth.userId}`]: new Date() } }
          ),
          User.findByIdAndDelete(auth.userId),
        ]);

        await emitSocketEvent(`user:${auth.userId}`, "auth:forceLogout", { reason: "Your account has been deleted." });

        return NextResponse.json({ success: true, message: "Account deleted successfully" });
      }

      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: e.message }, { status: e.status || 500 });
  }
}
