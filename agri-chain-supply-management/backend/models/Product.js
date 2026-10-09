// Path: backend/models/Product.js
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { isMongoConnected } = require("../config/db");

// --- Mongoose Schema Definition ---
const historySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      "CREATED",
      "DISPATCHED_TO_DISTRIBUTOR",
      "RECEIVED_BY_DISTRIBUTOR",
      "DISPATCHED_TO_RETAILER",
      "RECEIVED_BY_RETAILER",
      "SOLD_TO_CONSUMER"
    ],
    required: true
  },
  actorAddress: { type: String, required: true },
  receiverAddress: { type: String, default: null },
  date: { type: String, required: true },
  txHash: { type: String, required: true },
  location: { type: String, default: null },
  notes: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const productSchema = new mongoose.Schema({
  productId: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  cropType: {
    type: String,
    default: "Fruits",
    enum: [
      "Fruits",
      "Vegetables",
      "Grains & Cereals",
      "Coffee & Tea",
      "Dairy & Poultry",
      "Spices & Herbs",
      "Specialty Produce"
    ]
  },
  harvestDate: { type: String, required: true },
  farmLocation: { type: String, default: "Salinas Valley, California", trim: true },
  quantity: { type: String, default: "1,000 kg", trim: true },
  qualityGrade: { type: String, default: "Grade A+ (Premium Export)", trim: true },
  storageConditions: { type: String, default: "Cold Chain Controlled (4°C, 85% RH)", trim: true },
  certifications: { type: [String], default: ["USDA Organic", "GlobalG.A.P."] },
  estimatedShelfLife: { type: String, default: "45 Days", trim: true },
  notes: { type: String, default: "", trim: true },
  farmer: { type: String, required: true, lowercase: true },
  distributor: { type: String, default: null, lowercase: true },
  retailer: { type: String, default: null, lowercase: true },
  consumer: { type: String, default: null, lowercase: true },
  status: {
    type: String,
    enum: [
      "Created",
      "DispatchedToDistributor",
      "ReceivedByDistributor",
      "DispatchedToRetailer",
      "ReceivedByRetailer",
      "SoldToConsumer"
    ],
    default: "Created"
  },
  qrBlockchainHash: { type: String, default: null },
  history: { type: [historySchema], default: [] }
}, { timestamps: true });

const MongoProductModel = mongoose.model("Product", productSchema);

// --- Local Resilient Storage Adapter (Used when MongoDB is not connected) ---
const dataDir = path.join(__dirname, "../data");
const liveDataFile = path.join(dataDir, "products.json");
const seedDataFile = path.join(dataDir, "defaultProducts.json");

function ensureStoreInitialized() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(liveDataFile)) {
    if (fs.existsSync(seedDataFile)) {
      fs.copyFileSync(seedDataFile, liveDataFile);
    } else {
      fs.writeFileSync(liveDataFile, JSON.stringify([], null, 2));
    }
  }
}

function readLocalProducts() {
  ensureStoreInitialized();
  try {
    const raw = fs.readFileSync(liveDataFile, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[Storage] Failed reading local store:", err.message);
    return [];
  }
}

function writeLocalProducts(products) {
  ensureStoreInitialized();
  fs.writeFileSync(liveDataFile, JSON.stringify(products, null, 2));
}

function wrapProductDocument(doc) {
  if (!doc) return null;
  const clone = { ...doc };

  clone.save = async function () {
    const list = readLocalProducts();
    const idx = list.findIndex((p) => p.productId === clone.productId);
    clone.updatedAt = new Date().toISOString();
    if (idx >= 0) {
      list[idx] = clone;
    } else {
      list.push(clone);
    }
    writeLocalProducts(list);
    return clone;
  };

  return clone;
}

class QueryWrapper {
  constructor(dataPromise) {
    this.dataPromise = dataPromise;
  }

  sort(sortCriteria) {
    const nextPromise = this.dataPromise.then((items) => {
      if (!Array.isArray(items)) return items;
      const sorted = [...items];
      if (sortCriteria && sortCriteria.productId) {
        sorted.sort((a, b) =>
          sortCriteria.productId > 0
            ? a.productId - b.productId
            : b.productId - a.productId
        );
      }
      return sorted;
    });
    return new QueryWrapper(nextPromise);
  }

  then(resolve, reject) {
    return this.dataPromise.then(resolve, reject);
  }

  catch(reject) {
    return this.dataPromise.catch(reject);
  }
}

const LocalProductRepository = {
  find: (query = {}) => {
    let items = readLocalProducts().map(wrapProductDocument);

    if (query.$or && Array.isArray(query.$or)) {
      items = items.filter((item) =>
        query.$or.some((clause) => {
          for (const [key, val] of Object.entries(clause)) {
            if ((item[key] || "").toLowerCase() === (val || "").toLowerCase()) {
              return true;
            }
          }
          return false;
        })
      );
    }

    return new QueryWrapper(Promise.resolve(items));
  },

  findOne: async (query = {}) => {
    const items = readLocalProducts();
    let found = null;
    if (query.productId !== undefined) {
      found = items.find((p) => Number(p.productId) === Number(query.productId));
    }
    return wrapProductDocument(found);
  },

  create: async (data) => {
    const items = readLocalProducts();
    const existing = items.find((p) => Number(p.productId) === Number(data.productId));
    if (existing) {
      const err = new Error("Product ID already exists");
      err.code = 11000;
      throw err;
    }

    const newDoc = {
      ...data,
      cropType: data.cropType || "Fruits",
      farmLocation: data.farmLocation || "Salinas Valley, California",
      quantity: data.quantity || "1,000 kg",
      qualityGrade: data.qualityGrade || "Grade A+ (Premium Export)",
      storageConditions: data.storageConditions || "Cold Chain Controlled (4°C, 85% RH)",
      certifications: data.certifications || ["USDA Organic", "GlobalG.A.P."],
      estimatedShelfLife: data.estimatedShelfLife || "45 Days",
      notes: data.notes || "",
      distributor: data.distributor || null,
      retailer: data.retailer || null,
      consumer: data.consumer || null,
      status: data.status || "Created",
      qrBlockchainHash: data.qrBlockchainHash || data.txHash || null,
      history: data.history || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    items.push(newDoc);
    writeLocalProducts(items);
    return wrapProductDocument(newDoc);
  },

  countDocuments: async (query = {}) => {
    const items = readLocalProducts();
    return items.length;
  },

  resetToDefault: async () => {
    if (fs.existsSync(seedDataFile)) {
      fs.copyFileSync(seedDataFile, liveDataFile);
    }
    return readLocalProducts().map(wrapProductDocument);
  }
};

// Dispatch proxy to seamlessly use MongoDB if connected, or Local fallback
const ProductProxy = new Proxy(MongoProductModel, {
  get(target, prop) {
    if (isMongoConnected()) {
      return target[prop];
    }
    if (prop in LocalProductRepository) {
      return LocalProductRepository[prop];
    }
    return target[prop];
  }
});

module.exports = ProductProxy;
