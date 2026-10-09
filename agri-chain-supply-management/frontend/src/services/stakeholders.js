// Path: frontend/src/services/stakeholders.js

export const STAKEHOLDERS = [
  {
    id: "user-farmer",
    username: "farmer",
    password: "Farmer@123",
    name: "John Vance",
    organization: "Green Valley Organic Farms",
    role: 1,
    roleName: "Farmer",
    location: "Yakima Valley, Washington",
    walletAddress: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    avatar: "👨‍🌾",
    email: "john.vance@greenvalleyfarms.com",
    badgeColor: "success"
  },
  {
    id: "user-distributor",
    username: "distributor",
    password: "Distributor@123",
    name: "Marcus Brody",
    organization: "Pacific Cold-Chain Logistics Hub",
    role: 2,
    roleName: "Distributor",
    location: "Seattle Regional Logistics Hub, WA",
    walletAddress: "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65",
    avatar: "🚚",
    email: "marcus.brody@pacificcoldchain.com",
    badgeColor: "warning"
  },
  {
    id: "user-retailer",
    username: "retailer",
    password: "Retailer@123",
    name: "Sarah Jenkins",
    organization: "FreshMarket Supermarket #104",
    role: 3,
    roleName: "Retailer",
    location: "Downtown Westlake Store, Seattle",
    walletAddress: "0x9965507d1a55bcc2695c58ba16fb37d819b0a4df",
    avatar: "🏪",
    email: "sarah.jenkins@freshmarketorganics.com",
    badgeColor: "info"
  },
  {
    id: "user-consumer",
    username: "consumer",
    password: "Consumer@123",
    name: "Alice Chen",
    organization: "Verified Consumer Member",
    role: 4,
    roleName: "Consumer",
    location: "Seattle, WA",
    walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    avatar: "👤",
    email: "alice.chen@gmail.com",
    badgeColor: "secondary"
  }
];

/**
 * Returns all predefined plus newly registered custom stakeholders
 */
export function getAllStakeholders() {
  try {
    const raw = localStorage.getItem("agri_custom_users");
    const custom = raw ? JSON.parse(raw) : [];
    // Deduplicate against STAKEHOLDERS by id or username
    const combined = [...STAKEHOLDERS];
    custom.forEach((c) => {
      if (!combined.some((item) => item.username.toLowerCase() === c.username.toLowerCase())) {
        combined.push(c);
      }
    });
    return combined;
  } catch (_) {
    return STAKEHOLDERS;
  }
}

/**
 * Persists a newly registered stakeholder into local storage cache
 */
export function saveCustomStakeholder(newUser) {
  try {
    const raw = localStorage.getItem("agri_custom_users");
    const list = raw ? JSON.parse(raw) : [];
    const exists = list.some((u) => u.username.toLowerCase() === newUser.username.toLowerCase());
    if (!exists) {
      list.push(newUser);
      localStorage.setItem("agri_custom_users", JSON.stringify(list));
    }
  } catch (_) {}
}

/**
 * Resolves any raw 0x... Ethereum address or username to a human-readable stakeholder profile.
 */
export function resolveStakeholder(addressOrUsername) {
  if (!addressOrUsername) return null;
  const target = String(addressOrUsername).toLowerCase().trim();
  const all = getAllStakeholders();

  const found = all.find(
    (s) =>
      s.walletAddress.toLowerCase() === target ||
      s.username.toLowerCase() === target ||
      s.id.toLowerCase() === target
  );

  if (found) return found;

  // Graceful fallback for external wallets
  return {
    name: `User (${addressOrUsername.slice(0, 6)}...${addressOrUsername.slice(-4)})`,
    organization: "External Network Actor",
    roleName: "Stakeholder",
    walletAddress: addressOrUsername,
    avatar: "💼",
    badgeColor: "dark"
  };
}

/**
 * Formats an actor for display: e.g. "John Vance • Green Valley Organic Farms"
 */
export function formatActorDisplay(addressOrUsername) {
  const s = resolveStakeholder(addressOrUsername);
  if (!s) return "Unassigned";
  return `${s.name} • ${s.organization}`;
}
