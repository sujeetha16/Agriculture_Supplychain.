// Path: backend/models/User.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { isMongoConnected } = require("../config/db");

// --- Mongoose Schema Definition ---
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    organization: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4] // 1: Farmer, 2: Distributor, 3: Retailer, 4: Consumer
    },
    roleName: {
      type: String,
      required: true,
      enum: ["Farmer", "Distributor", "Retailer", "Consumer"]
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      default: ""
    },
    walletAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    avatar: {
      type: String,
      default: "👤"
    },
    badgeColor: {
      type: String,
      default: "secondary"
    },
    verifiedCertifications: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

// Hash password before saving in Mongoose
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Never leak password in JSON outputs
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const MongoUserModel = mongoose.model("User", userSchema);

// --- Resilient Local User Storage Adapter (for Offline / Demo / Dev Mode) ---
const dataDir = path.join(__dirname, "../data");
const usersDataFile = path.join(dataDir, "users.json");

// Pre-seeded default agricultural stakeholders
const DEFAULT_USERS_SEED = [
  {
    id: "user-farmer",
    username: "farmer",
    passwordPlain: "Farmer@123",
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
    passwordPlain: "Distributor@123",
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
    passwordPlain: "Retailer@123",
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
    passwordPlain: "Consumer@123",
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

function ensureUsersInitialized() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(usersDataFile)) {
    // Generate bcrypt hashes synchronously for the initial seed
    const seeded = DEFAULT_USERS_SEED.map((u) => {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(u.passwordPlain, salt);
      const copy = { ...u, password: hash };
      delete copy.passwordPlain;
      return copy;
    });
    fs.writeFileSync(usersDataFile, JSON.stringify(seeded, null, 2));
  }
}

function readLocalUsers() {
  ensureUsersInitialized();
  try {
    const raw = fs.readFileSync(usersDataFile, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Storage] Failed reading local users:", err.message);
    return [];
  }
}

function writeLocalUsers(users) {
  ensureUsersInitialized();
  fs.writeFileSync(usersDataFile, JSON.stringify(users, null, 2));
}

function wrapUserDocument(doc) {
  if (!doc) return null;
  const clone = { ...doc };

  clone.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, clone.password);
  };

  clone.toJSON = function () {
    const safe = { ...clone };
    delete safe.password;
    return safe;
  };

  clone.save = async function () {
    const list = readLocalUsers();
    const idx = list.findIndex(
      (u) => u.username.toLowerCase() === clone.username.toLowerCase()
    );
    clone.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      list[idx] = clone;
    } else {
      list.push(clone);
    }
    writeLocalUsers(list);
    return clone;
  };

  return clone;
}

// Unified Data Access Interface for User
const User = {
  async findOne(filter) {
    if (isMongoConnected()) {
      return MongoUserModel.findOne(filter);
    }

    const list = readLocalUsers();
    const match = list.find((u) => {
      if (filter.$or && Array.isArray(filter.$or)) {
        return filter.$or.some((clause) => {
          if (clause.username && u.username.toLowerCase() === clause.username.toLowerCase()) return true;
          if (clause.email && u.email.toLowerCase() === clause.email.toLowerCase()) return true;
          if (clause.walletAddress && u.walletAddress.toLowerCase() === clause.walletAddress.toLowerCase()) return true;
          return false;
        });
      }
      if (filter.username && u.username.toLowerCase() === filter.username.toLowerCase()) return true;
      if (filter.email && u.email.toLowerCase() === filter.email.toLowerCase()) return true;
      if (filter.role && u.role === filter.role) return true;
      if (filter.walletAddress && u.walletAddress.toLowerCase() === filter.walletAddress.toLowerCase()) return true;
      if (filter._id && (u._id === filter._id || u.id === filter._id)) return true;
      return false;
    });

    return wrapUserDocument(match);
  },

  async find(filter = {}) {
    if (isMongoConnected()) {
      return MongoUserModel.find(filter);
    }

    const list = readLocalUsers();
    let result = list;
    if (filter.role) {
      result = result.filter((u) => u.role === filter.role);
    }
    return result.map(wrapUserDocument);
  },

  async create(userData) {
    if (isMongoConnected()) {
      return MongoUserModel.create(userData);
    }

    const list = readLocalUsers();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userData.password, salt);

    const newUser = {
      id: `user-${userData.username}-${Date.now()}`,
      ...userData,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    list.push(newUser);
    writeLocalUsers(list);
    return wrapUserDocument(newUser);
  },

  DEFAULT_USERS_SEED
};

module.exports = User;
