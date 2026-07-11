import jwt from "jsonwebtoken";
import dbConnect from "./dbConnect";
import User from "../models/User";

export async function verifyAuth(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }

  await dbConnect();
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    const err = new Error("Invalid or expired token. Please log in again.");
    err.status = 401;
    throw err;
  }

  if (!decoded.userId) {
    const err = new Error("Invalid token payload");
    err.status = 401;
    throw err;
  }

  const user = await User.findById(decoded.userId)
    .select("isSuspended activeSessionToken lastActiveAt")
    .lean();

  if (!user) {
    const err = new Error("Account not found. Please log in again.");
    err.status = 401;
    throw err;
  }

  if (user.isSuspended) {
    const err = new Error("Your account has been suspended.");
    err.status = 403;
    err.suspended = true;
    throw err;
  }

  if (user.activeSessionToken && user.activeSessionToken !== token) {
    const err = new Error("Session expired. Please log in again.");
    err.status = 401;
    throw err;
  }

  // Update lastActiveAt (throttled to once per 2 minutes)
  const TWO_MINS = 2 * 60 * 1000;
  const last = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
  if (Date.now() - last > TWO_MINS) {
    User.updateOne(
      { _id: decoded.userId, activeSessionToken: token },
      { $set: { lastActiveAt: new Date() } }
    ).catch(() => {});
  }

  return { userId: decoded.userId, user };
}

export async function verifyAdminAuth(request) {
  const tokenHeader = request.headers.get("x-admin-token") || "";
  if (!tokenHeader) {
    const err = new Error("Unauthorized: No admin token provided");
    err.status = 401;
    throw err;
  }

  try {
    const decoded = jwt.verify(tokenHeader, process.env.JWT_SECRET);
    if (!decoded.admin) {
      const err = new Error("Unauthorized: Not admin");
      err.status = 401;
      throw err;
    }
    return decoded;
  } catch (e) {
    const err = new Error("Unauthorized: Invalid or expired admin token");
    err.status = 401;
    throw err;
  }
}
