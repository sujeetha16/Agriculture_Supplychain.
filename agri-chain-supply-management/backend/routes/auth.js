// Path: backend/routes/auth.js
const express = require("express");
const router = express.Router();

// Verified Agricultural Stakeholders Directory
const USERS = [
  {
    id: "user-farmer",
    username: "farmer",
    email: "john.vance@greenvalleyfarms.com",
    name: "John Vance",
    organization: "Green Valley Organic Farms",
    role: 1,
    roleName: "Farmer",
    location: "Yakima Valley, Washington",
    phone: "+1 (509) 555-0142",
    walletAddress: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    avatar: "👨‍🌾",
    verifiedCertifications: ["USDA Organic", "GlobalG.A.P.", "Non-GMO"]
  },
  {
    id: "user-distributor",
    username: "distributor",
    email: "marcus.brody@pacificcoldchain.com",
    name: "Marcus Brody",
    organization: "Pacific Cold-Chain Logistics Hub",
    role: 2,
    roleName: "Distributor",
    location: "Seattle Regional Logistics Hub, WA",
    phone: "+1 (206) 555-0188",
    walletAddress: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
    avatar: "🚚",
    verifiedCertifications: ["HACCP Certified", "ISO 22000 Cold Chain"]
  },
  {
    id: "user-retailer",
    username: "retailer",
    email: "sarah.jenkins@freshmarketorganics.com",
    name: "Sarah Jenkins",
    organization: "FreshMarket Supermarket #104",
    role: 3,
    roleName: "Retailer",
    location: "Downtown Westlake Store, Seattle",
    phone: "+1 (206) 555-0199",
    walletAddress: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4df",
    avatar: "🏪",
    verifiedCertifications: ["Certified Organic Retailer", "Fair Trade Partner"]
  },
  {
    id: "user-consumer",
    username: "consumer",
    email: "alice.chen@gmail.com",
    name: "Alice Chen",
    organization: "Verified Consumer Member",
    role: 4,
    roleName: "Consumer",
    location: "Seattle, WA",
    phone: "+1 (206) 555-0123",
    walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    avatar: "👤",
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

  // Fallback for unknown address
  return {
    name: `User ${addressOrUsername.slice(0, 6)}...`,
    organization: "External Network Actor",
    roleName: "Stakeholder",
    walletAddress: addressOrUsername,
    avatar: "💼"
  };
}

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { username, password, role } = req.body;

  // 1. If role is provided (quick demo login)
  if (role) {
    const user = USERS.find((u) => u.role === Number(role));
    if (user) {
      return res.json({
        success: true,
        message: `Authenticated as ${user.name} (${user.roleName})`,
        token: `demo-jwt-token-${user.username}-${Date.now()}`,
        user
      });
    }
  }

  // 2. Standard username matching
  const identifier = (username || "").toLowerCase().trim();
  const user = USERS.find(
    (u) =>
      u.username.toLowerCase() === identifier ||
      u.email.toLowerCase() === identifier
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid credentials. Use quick login or try: farmer, distributor, retailer, or consumer."
    });
  }

  // Demo accepts any password or standard demo password
  return res.json({
    success: true,
    message: `Welcome back, ${user.name}!`,
    token: `demo-jwt-token-${user.username}-${Date.now()}`,
    user
  });
});

// GET /api/auth/users - list directory of verified actors for easy destination selection
router.get("/users", (req, res) => {
  res.json({
    success: true,
    users: USERS.map(({ id, name, organization, role, roleName, location, walletAddress, avatar }) => ({
      id,
      name,
      organization,
      role,
      roleName,
      location,
      walletAddress,
      avatar
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
