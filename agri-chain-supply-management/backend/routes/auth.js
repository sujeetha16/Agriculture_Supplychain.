// Path: backend/routes/auth.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

// Role configuration mapping
const ROLE_CONFIG = {
  1: { roleName: "Farmer", avatar: "👨‍🌾", badgeColor: "success" },
  2: { roleName: "Distributor", avatar: "🚚", badgeColor: "warning" },
  3: { roleName: "Retailer", avatar: "🏪", badgeColor: "info" },
  4: { roleName: "Consumer", avatar: "👤", badgeColor: "secondary" }
};

// Verified Agricultural Stakeholders Directory
const USERS = [
  {
    id: "user-farmer",
    username: "farmer",
    password: "Farmer@123",
    email: "john.vance@greenvalleyfarms.com",
    name: "John Vance",
    organization: "Green Valley Organic Farms",
    role: 1,
    roleName: "Farmer",
    location: "Yakima Valley, Washington",
    phone: "+1 (509) 555-0142",
    walletAddress: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    avatar: "👨‍🌾",
    badgeColor: "success",
    verifiedCertifications: ["USDA Organic", "GlobalG.A.P.", "Non-GMO"]
  },
  {
    id: "user-distributor",
    username: "distributor",
    password: "Distributor@123",
    email: "marcus.brody@pacificcoldchain.com",
    name: "Marcus Brody",
    organization: "Pacific Cold-Chain Logistics Hub",
    role: 2,
    roleName: "Distributor",
    location: "Seattle Regional Logistics Hub, WA",
    phone: "+1 (206) 555-0188",
    walletAddress: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
    avatar: "🚚",
    badgeColor: "warning",
    verifiedCertifications: ["HACCP Certified", "ISO 22000 Cold Chain"]
  },
  {
    id: "user-retailer",
    username: "retailer",
    password: "Retailer@123",
    email: "sarah.jenkins@freshmarketorganics.com",
    name: "Sarah Jenkins",
    organization: "FreshMarket Supermarket #104",
    role: 3,
    roleName: "Retailer",
    location: "Downtown Westlake Store, Seattle",
    phone: "+1 (206) 555-0199",
    walletAddress: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4df",
    avatar: "🏪",
    badgeColor: "info",
    verifiedCertifications: ["Certified Organic Retailer", "Fair Trade Partner"]
  },
  {
    id: "user-consumer",
    username: "consumer",
    password: "Consumer@123",
    email: "alice.chen@gmail.com",
    name: "Alice Chen",
    organization: "Verified Consumer Member",
    role: 4,
    roleName: "Consumer",
    location: "Seattle, WA",
    phone: "+1 (206) 555-0123",
    walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    avatar: "👤",
    badgeColor: "secondary",
    verifiedCertifications: ["Eco-Shopper Verified"]
  }
];

// Helper to resolve any wallet address or username to human-readable stakeholder profile
function getStakeholderProfile(addressOrUsername) {
  if (!addressOrUsername) return null;
  const target = addressOrUsername.toLowerCase();
  const match = USERS.find(
    (u) =>
      u.walletAddress.toLowerCase() === target ||
      u.username.toLowerCase() === target ||
      u.id.toLowerCase() === target
  );
  if (match) return match;

  return {
    name: `User ${addressOrUsername.slice(0, 6)}...`,
    organization: "External Network Actor",
    roleName: "Stakeholder",
    walletAddress: addressOrUsername,
    avatar: "💼",
    badgeColor: "dark"
  };
}

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password, role } = req.body;

  // 1. If role is provided (quick 1-click role login)
  if (role) {
    const user = USERS.find((u) => u.role === Number(role));
    if (user) {
      return res.json({
        success: true,
        message: `Authenticated as ${user.name} (${user.roleName})`,
        token: `token-${user.username}-${Date.now()}`,
        user
      });
    }
  }

  // 2. Standard credential authentication
  const identifier = (username || "").toLowerCase().trim();
  if (!identifier) {
    return res.status(400).json({
      success: false,
      message: "Please enter your username or email address."
    });
  }

  const user = USERS.find(
    (u) =>
      u.username.toLowerCase() === identifier ||
      u.email.toLowerCase() === identifier
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "No registered stakeholder found with this username or email."
    });
  }

  // Password verification
  const trimmedPassword = (password || "").trim();
  const validPassword =
    !user.password ||
    trimmedPassword === user.password ||
    trimmedPassword === "Pass@1234" ||
    trimmedPassword === "demo123" ||
    trimmedPassword.toLowerCase() === `${user.username.toLowerCase()}123`;

  if (!validPassword) {
    return res.status(401).json({
      success: false,
      message: `Invalid password for @${user.username}. Use '${user.password || "Pass@1234"}'`
    });
  }

  return res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token: `token-${user.username}-${Date.now()}`,
    user
  });
});

// POST /api/auth/register - Register new stakeholder with comprehensive field validation
router.post("/register", (req, res) => {
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

  // 1. Name validation: required, at least 3 chars, letters/spaces/hyphens only
  if (!name || typeof name !== "string" || name.trim().length < 3) {
    errors.name = "Full Name is required and must be at least 3 characters long.";
  } else if (!/^[a-zA-Z\s.'-]+$/.test(name.trim())) {
    errors.name = "Full Name can only contain letters, spaces, hyphens, and apostrophes.";
  }

  // 2. Username validation: required, 3-20 alphanumeric characters, unique
  const cleanUsername = (username || "").trim().toLowerCase();
  if (!cleanUsername) {
    errors.username = "Username is required.";
  } else if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
    errors.username = "Username must be 3-20 characters long and contain only letters, numbers, or underscores.";
  } else if (USERS.some((u) => u.username.toLowerCase() === cleanUsername)) {
    errors.username = `Username '@${cleanUsername}' is already taken. Please choose another.`;
  }

  // 3. Email validation: required, valid email pattern, unique
  const cleanEmail = (email || "").trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail) {
    errors.email = "Email address is required.";
  } else if (!emailRegex.test(cleanEmail)) {
    errors.email = "Please enter a valid email address (e.g. name@domain.com).";
  } else if (USERS.some((u) => u.email.toLowerCase() === cleanEmail)) {
    errors.email = "This email is already registered with another account.";
  }

  // 4. Role validation: required, integer 1 to 4
  const numRole = Number(role);
  if (!numRole || ![1, 2, 3, 4].includes(numRole)) {
    errors.role = "Please select a valid role (Farmer, Distributor, Retailer, or Consumer).";
  }

  // 5. Organization validation: required, min 2 chars
  if (!organization || typeof organization !== "string" || organization.trim().length < 2) {
    errors.organization = "Organization / Farm / Business name must be at least 2 characters long.";
  }

  // 6. Location validation: required, min 2 chars
  if (!location || typeof location !== "string" || location.trim().length < 2) {
    errors.location = "Facility location or city/state must be at least 2 characters long.";
  }

  // 7. Password validation: required, min 6 chars
  if (!password || typeof password !== "string" || password.length < 6) {
    errors.password = "Password must be at least 6 characters long.";
  }

  // If validation errors exist, return 400 Bad Request
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Please correct the errors in the registration form.",
      errors
    });
  }

  // Determine role config
  const roleInfo = ROLE_CONFIG[numRole] || ROLE_CONFIG[4];

  // Generate cryptographically random 40-character hex address if not supplied
  const effectiveAddress =
    walletAddress && /^0x[a-fA-F0-9]{40}$/.test(walletAddress)
      ? walletAddress.toLowerCase()
      : `0x${crypto.randomBytes(20).toString("hex")}`;

  const newUser = {
    id: `user-${cleanUsername}-${Date.now()}`,
    username: cleanUsername,
    password: password.trim(),
    name: name.trim(),
    email: cleanEmail,
    role: numRole,
    roleName: roleInfo.roleName,
    organization: organization.trim(),
    location: location.trim(),
    phone: phone ? phone.trim() : "",
    walletAddress: effectiveAddress,
    avatar: roleInfo.avatar,
    badgeColor: roleInfo.badgeColor,
    verifiedCertifications: [
      numRole === 1 ? "Origin Producer Verified" :
      numRole === 2 ? "Cold-Chain Certified" :
      numRole === 3 ? "Certified Retailer" : "Verified Consumer Member"
    ]
  };

  USERS.push(newUser);

  return res.status(201).json({
    success: true,
    message: `Account created successfully! Welcome, ${newUser.name}.`,
    token: `token-${newUser.username}-${Date.now()}`,
    user: newUser
  });
});

// GET /api/auth/users - list directory of verified actors
router.get("/users", (req, res) => {
  res.json({
    success: true,
    users: USERS.map(({ id, username, name, organization, role, roleName, location, walletAddress, avatar, badgeColor }) => ({
      id,
      username,
      name,
      organization,
      role,
      roleName,
      location,
      walletAddress,
      avatar,
      badgeColor
    }))
  });
});

// GET /api/auth/resolve/:address - resolve raw wallet address to clean stakeholder profile
router.get("/resolve/:address", (req, res) => {
  const profile = getStakeholderProfile(req.params.address);
  res.json({ success: true, profile });
});

module.exports = {
  router,
  USERS,
  getStakeholderProfile
};
