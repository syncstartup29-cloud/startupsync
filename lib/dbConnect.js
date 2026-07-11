import mongoose from "mongoose";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (process.env.IS_BUILD_PHASE === "true") {
    return mongoose;
  }

  if (!process.env.FIREBASE_PROJECT_ID) {
    throw new Error("Please define the FIREBASE_PROJECT_ID environment variable inside .env");
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(FIREBASE_PROJECT_ID).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
