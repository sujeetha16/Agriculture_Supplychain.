// Path: backend/routes/auth.js
const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { ethers } = require("ethers");
const User = require("../models/User");
const { authenticate, optionalAuth, JWT_SECRET } = require("../middleware/auth");

const router = express.Router();

// Role configuration mapping
const ROLE_CONFIG = {
  1: { roleName: "Farmer", avatar: "👨‍🌾", badgeColor: "success" },
  2: { roleName: "Distributor", avatar: "🚚", badgeColor: "warning" },
  3: { roleName: "Retailer", avatar: "🏪", badgeColor: "info" },
  4: { roleName: "Consumer", avatar: "👤", badgeColor: "secondary" }
};

// Rate limiting for auth endpoints (anti-brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests from this IP. Please try again after 15 minutes."
  }
});

// Helper to issue standard cryptographic JWT
function issueToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      roleName: user.roleName,
      walletAddress: user.walletAddress
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

// GET /api/auth/stakeholders - public list of stakeholders (passwords stripped)
router.get("/stakeholders", async (req, res) => {
  const users = await User.find({});
  res.json({
    success: true,
    stakeholders: users.map((u) => (typeof u.toJSON === "function" ? u.toJSON() : u))
  });
});

// GET /api/auth/me - inspect currently authenticated token
router.get("/me", authenticate, async (req, res) => {
  const user = await User.findOne({ username: req.user.username });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }
  res.json({
    success: true,
    user: typeof user.toJSON === "function" ? user.toJSON() : user
  });
});

// POST /api/auth/login - authenticate stakeholder
router.post("/login", authLimiter, async (req, res) => {
  const { username, password, role } = req.body;
  const isProduction = process.env.NODE_ENV === "production";

  // 1. Quick 1-click role login (restricted to non-production demo environments)
  if (role) {
    if (isProduction) {
      return res.status(403).json({
        success: false,
        message: "1-Click Role Login is strictly disabled in production. Please authenticate with username and password."
      });
    }

    const targetRole = Number(role);
    const user = await User.findOne({ role: targetRole });
    if (user) {
      const safeUser = typeof user.toJSON === "function" ? user.toJSON() : user;
      const token = issueToken(safeUser);
      return res.json({
        success: true,
        message: `[Demo Mode] Authenticated as ${safeUser.name} (${safeUser.roleName})`,
        token,
        user: safeUser
      });
    }
  }

  // 2. Standard credential authentication
  const identifier = (username || "").toLowerCase().trim();
  const cleanPassword = (password || "").trim();

  if (!identifier || !cleanPassword) {
    return res.status(400).json({
      success: false,
      message: "Both username/email and password are required."
    });
  }

  const user = await User.findOne({
    $or: [{ username: identifier }, { email: identifier }]
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid username or password."
    });
  }

  // Cryptographic bcrypt password check
  let passwordMatch = false;
  if (typeof user.comparePassword === "function") {
    passwordMatch = await user.comparePassword(cleanPassword);
  }

  // Fallback demo password check if legacy seed not yet hashed in dev
  if (!passwordMatch && !isProduction) {
    passwordMatch =
      cleanPassword === "Pass@1234" ||
      cleanPassword === "demo123" ||
      cleanPassword === `${user.username}123` ||
      (cleanPassword === "Farmer@123" && user.role === 1);
  }

  if (!passwordMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid username or password."
    });
  }

  const safeUser = typeof user.toJSON === "function" ? user.toJSON() : user;
  const token = issueToken(safeUser);

  return res.json({
    success: true,
    message: `Welcome back, ${safeUser.name}!`,
    token,
    user: safeUser
  });
});

// POST /api/auth/register - Register new stakeholder with comprehensive field validation & hashing
router.post("/register", authLimiter, async (req, res) => {
  const {
    name,
    username,
    email,
    password,
    role,
    organization,
    location,
    phone,
    walletAddress
  } = req.body;

  const errors = {};

  // 1. Name validation
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    errors.name = "Full Name is required and must be at least 3 characters long.";
  } else if (!/^[a-zA-Z\s.'-]+$/.test(name.trim())) {
    errors.name = "Full Name can only contain letters, spaces, hyphens, and apostrophes.";
  }

  // 2. Username validation
  const cleanUsername = (username || "").trim().toLowerCase();
  if (!cleanUsername) {
    errors.username = "Username is required.";
  } else if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
    errors.username = "Username must be 3-20 characters long and contain only letters, numbers, or underscores.";
  }

  // 3. Email validation
  const cleanEmail = (email || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail) {
    errors.email = "Email address is required.";
  } else if (!emailRegex.test(cleanEmail)) {
    errors.email = "Please enter a valid email address (e.g. name@domain.com).";
  }

  // 4. Role validation
  const numRole = Number(role);
  if (!numRole || ![1, 2, 3, 4].includes(numRole)) {
    errors.role = "Please select a valid role (1: Farmer, 2: Distributor, 3: Retailer, 4: Consumer).";
  }

  // 5. Organization validation
  if (!organization || typeof organization !== "string" || organization.trim().length < 2) {
    errors.organization = "Organization / Farm / Business name must be at least 2 characters long.";
  }

  // 6. Location validation
  if (!location || typeof location !== "string" || location.trim().length < 2) {
    errors.location = "Facility location or city/state must be at least 2 characters long.";
  }

  // 7. Password validation
  if (!password || typeof password !== "string" || password.length < 6) {
    errors.password = "Password must be at least 6 characters long.";
  }

  // Check unique username & email
  if (!errors.username) {
    const existingUser = await User.findOne({ username: cleanUsername });
    if (existingUser) {
      errors.username = `Username '@${cleanUsername}' is already taken. Please choose another.`;
    }
  }

  if (!errors.email) {
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      errors.email = "This email is already registered with another account.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Please correct the errors in the registration form.",
      errors
    });
  }

  const roleInfo = ROLE_CONFIG[numRole] || ROLE_CONFIG[4];

  // Generate cryptographically random 40-character hex address if not supplied
  const effectiveAddress =
    walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
      ? walletAddress.toLowerCase()
      : `0x${crypto.randomBytes(20).toString("hex")}`;

  const createdUser = await User.create({
    name: name.trim(),
    username: cleanUsername,
    email: cleanEmail,
    password, // will be hashed by User model
    role: numRole,
    roleName: roleInfo.roleName,
    organization: organization.trim(),
    location: location.trim(),
    phone: (phone || "").trim(),
    walletAddress: effectiveAddress,
    avatar: roleInfo.avatar,
    badgeColor: roleInfo.badgeColor,
    verifiedCertifications: ["Self-Declared Stakeholder"]
  });

  const safeUser = typeof createdUser.toJSON === "function" ? createdUser.toJSON() : createdUser;
  const token = issueToken(safeUser);

  return res.status(201).json({
    success: true,
    message: `Account created successfully! Welcome to AgriChain, ${safeUser.name}.`,
    token,
    user: safeUser
  });
});

// --- Cryptographic Wallet Ownership Verification (SIWE Challenge-Response Flow) ---
const walletChallenges = new Map();

function cleanExpiredChallenges() {
  const now = Date.now();
  for (const [wallet, challenge] of walletChallenges.entries()) {
    if (challenge.expiresAt < now) {
      walletChallenges.delete(wallet);
    }
  }
}

// POST /api/auth/wallet/nonce - Request single-use challenge nonce for wallet signature
router.post("/wallet/nonce", (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return res.status(400).json({
      success: false,
      message: "A valid 40-character hexadecimal Ethereum wallet address is required."
    });
  }

  cleanExpiredChallenges();

  const normalized = walletAddress.toLowerCase();
  const nonce = crypto.randomBytes(16).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minute validity window
  const issuedAt = new Date().toISOString();

  const message = [
    "AgriChain Supply Chain Traceability Platform",
    "Sign this challenge message to verify ownership of your Ethereum wallet address.",
    `Wallet Address: ${normalized}`,
    `Session Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    "Note: This signature verification does not execute an on-chain transaction or incur any gas fees."
  ].join("\n");

  walletChallenges.set(normalized, {
    nonce,
    message,
    expiresAt,
    used: false
  });

  return res.json({
    success: true,
    walletAddress: normalized,
    nonce,
    message,
    expiresInSeconds: 300
  });
});

// POST /api/auth/wallet/verify - Verify ECDSA cryptographic signature and bind verified wallet
router.post("/wallet/verify", optionalAuth, async (req, res) => {
  const { walletAddress, signature, nonce } = req.body;

  if (!walletAddress || !signature) {
    return res.status(400).json({
      success: false,
      message: "walletAddress and signature are required."
    });
  }

  cleanExpiredChallenges();

  const normalized = walletAddress.toLowerCase();
  const challenge = walletChallenges.get(normalized);

  if (!challenge || challenge.used || challenge.expiresAt < Date.now()) {
    return res.status(400).json({
      success: false,
      message: "Challenge nonce is expired, invalid, or already consumed. Please request a new nonce."
    });
  }

  if (nonce && challenge.nonce !== nonce) {
    return res.status(400).json({
      success: false,
      message: "Nonce mismatch. Challenge is invalid."
    });
  }

  try {
    const recoveredAddress = ethers.verifyMessage(challenge.message, signature);

    if (recoveredAddress.toLowerCase() !== normalized) {
      return res.status(401).json({
        success: false,
        verified: false,
        message: `Cryptographic signature mismatch: Signer address (${recoveredAddress.toLowerCase()}) does not match supplied wallet (${normalized}).`
      });
    }

    // Mark challenge as consumed (anti-replay guard)
    challenge.used = true;
    walletChallenges.delete(normalized);

    // If an authenticated session exists, bind verified wallet to stakeholder profile
    let updatedUser = null;
    if (req.user && req.user.username) {
      const userDoc = await User.findOne({ username: req.user.username });
      if (userDoc) {
        userDoc.walletAddress = normalized;
        userDoc.walletVerified = true;
        if (typeof userDoc.save === "function") {
          await userDoc.save();
        }
        updatedUser = typeof userDoc.toJSON === "function" ? userDoc.toJSON() : userDoc;
      }
    }

    return res.json({
      success: true,
      verified: true,
      walletAddress: normalized,
      user: updatedUser,
      message: "Wallet ownership cryptographically verified via ECDSA signature."
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      verified: false,
      message: `Signature verification error: ${err.message}`
    });
  }
});

module.exports = { router, ROLE_CONFIG };
