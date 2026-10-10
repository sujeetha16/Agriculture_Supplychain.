// Path: backend/config/db.js
const mongoose = require("mongoose");

let isMongo = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  const isProduction = process.env.NODE_ENV === "production";

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });
      isMongo = true;
      console.log("[Database] Successfully connected to MongoDB / AWS DocumentDB instance.");
      return true;
    } catch (err) {
      const sanitizedUri = uri.replace(/\/\/[^@]*@/, "//***:***@");
      console.error(`[Database] Connection failure to "${sanitizedUri}": ${err.message}`);

      if (isProduction) {
        throw new Error(
          `[CRITICAL] Production database connection failed to ${sanitizedUri}. ` +
          `Local filesystem fallback is disabled in production to guarantee data persistence and prevent ephemeral container data loss.`
        );
      }
    }
  } else if (isProduction) {
    throw new Error(
      `[CRITICAL] MONGODB_URI environment variable is required in production mode. ` +
      `Local JSON datastore cannot be used as production source of truth.`
    );
  }

  isMongo = false;
  console.log("[Database] Development / Demo Local Agriculture Datastore active (educational sandbox mode).");
  return false;
}

function isMongoConnected() {
  return isMongo;
}

module.exports = { connectDB, isMongoConnected };
