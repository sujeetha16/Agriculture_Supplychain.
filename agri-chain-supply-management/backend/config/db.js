// Path: backend/config/db.js
const mongoose = require("mongoose");

let isMongo = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 2500
      });
      isMongo = true;
      console.log("[Database] Successfully connected to MongoDB / AWS DocumentDB instance.");
      return true;
    } catch (err) {
      console.warn(`[Database] MongoDB connection to "${uri.replace(/\/\/[^@]*@/, "//***:***@")}" failed: ${err.message}`);
    }
  }

  isMongo = false;
  console.log("[Database] Resilient Local Agriculture Datastore activated (zero-config university demo mode).");
  return false;
}

function isMongoConnected() {
  return isMongo;
}

module.exports = { connectDB, isMongoConnected };
