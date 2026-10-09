// Path: backend/routes/products.js
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const Product = require("../models/Product");

const router = express.Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const addressRule = (field) =>
  body(field)
    .matches(/^0x[a-fA-F0-9]{40}$/)
    .withMessage(`${field} must be a valid Ethereum address`);

const dateRule = (field) =>
  body(field)
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage(`${field} must use YYYY-MM-DD`);

// GET /api/products - list all products
router.get("/", async (req, res) => {
  const products = await Product.find().sort({ productId: 1 });
  res.json({ success: true, count: products.length, products });
});

// GET /api/products/stats - executive supply-chain KPI metrics
router.get("/stats", async (req, res) => {
  const products = await Product.find();

  const byStatus = {
    Created: 0,
    DispatchedToDistributor: 0,
    ReceivedByDistributor: 0,
    DispatchedToRetailer: 0,
    ReceivedByRetailer: 0,
    SoldToConsumer: 0
  };

  const byCropType = {};
  let totalBatches = products.length;
  let inTransitCount = 0;
  let completedCount = 0;
  const recentEvents = [];

  for (const p of products) {
    if (byStatus[p.status] !== undefined) {
      byStatus[p.status]++;
    }

    const crop = p.cropType || "General Produce";
    byCropType[crop] = (byCropType[crop] || 0) + 1;

    if (p.status === "DispatchedToDistributor" || p.status === "DispatchedToRetailer") {
      inTransitCount++;
    }
    if (p.status === "SoldToConsumer") {
      completedCount++;
    }

    if (Array.isArray(p.history)) {
      for (const h of p.history) {
        recentEvents.push({
          productId: p.productId,
          productName: p.name,
          action: h.action,
          actorAddress: h.actorAddress,
          receiverAddress: h.receiverAddress,
          date: h.date,
          txHash: h.txHash,
          createdAt: h.createdAt
        });
      }
    }
  }

  // Sort recent events newest first
  recentEvents.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  res.json({
    success: true,
    stats: {
      totalBatches,
      inTransitCount,
      completedCount,
      activeFarming: byStatus.Created,
      byStatus,
      byCropType,
      recentActivity: recentEvents.slice(0, 8)
    }
  });
});

// POST /api/products/reset-demo - reloads initial seed data for faculty demos
router.post("/reset-demo", async (req, res) => {
  if (typeof Product.resetToDefault === "function") {
    const products = await Product.resetToDefault();
    return res.json({
      success: true,
      message: "Demonstration agricultural catalog reset to reference state.",
      count: products.length,
      products
    });
  }
  res.json({ success: true, message: "Using standard MongoDB cluster." });
});

// GET /api/products/:productId - single product trace
router.get("/:productId", [
  param("productId").isInt({ min: 1 })
], validate, async (req, res) => {
  const product = await Product.findOne({ productId: Number(req.params.productId) });
  if (!product) {
    return res.status(404).json({ success: false, message: "Agricultural product not found." });
  }
  res.json({ success: true, product });
});

// GET /api/products/wallet/:address - products associated with actor wallet
router.get("/wallet/:address", [
  param("address").matches(/^0x[a-fA-F0-9]{40}$/)
], validate, async (req, res) => {
  const address = req.params.address.toLowerCase();
  const products = await Product.find({
    $or: [
      { farmer: address },
      { distributor: address },
      { retailer: address },
      { consumer: address }
    ]
  }).sort({ productId: 1 });

  res.json({ success: true, count: products.length, products });
});

// POST /api/products - register new agricultural batch
router.post("/", [
  body("productId").isInt({ min: 1 }),
  body("name").trim().notEmpty().isLength({ max: 120 }),
  dateRule("harvestDate"),
  addressRule("farmer"),
  body("txHash").matches(/^0x[a-fA-F0-9]{64}$/)
], validate, async (req, res) => {
  const {
    productId,
    name,
    harvestDate,
    farmer,
    txHash,
    cropType,
    farmLocation,
    quantity,
    qualityGrade,
    storageConditions,
    certifications,
    estimatedShelfLife,
    notes
  } = req.body;

  const existing = await Product.findOne({ productId });
  if (existing) {
    return res.status(409).json({ success: false, message: "Batch Product ID already registered." });
  }

  const normalizedFarmer = farmer.toLowerCase();

  const product = await Product.create({
    productId: Number(productId),
    name,
    cropType: cropType || "Fruits",
    harvestDate,
    farmLocation: farmLocation || "Salinas Valley, California",
    quantity: quantity || "1,000 kg",
    qualityGrade: qualityGrade || "Grade A+ (Premium Export)",
    storageConditions: storageConditions || "Cold Chain Controlled (4°C, 85% RH)",
    certifications: Array.isArray(certifications) ? certifications : ["USDA Organic", "GlobalG.A.P."],
    estimatedShelfLife: estimatedShelfLife || "45 Days",
    notes: notes || "",
    farmer: normalizedFarmer,
    status: "Created",
    qrBlockchainHash: txHash,
    history: [{
      action: "CREATED",
      actorAddress: normalizedFarmer,
      receiverAddress: null,
      date: harvestDate,
      txHash,
      location: farmLocation || "Origin Farm",
      notes: "Harvest registered and logged to smart contract ledger."
    }]
  });

  res.status(201).json({ success: true, product });
});

// Helper for linear supply-chain state machine transitions
async function updateProductAction(req, res, action) {
  const productId = Number(req.params.productId);
  const product = await Product.findOne({ productId });

  if (!product) {
    return res.status(404).json({ success: false, message: "Agricultural product batch not found." });
  }

  const { actorAddress, receiverAddress, date, txHash, location, notes } = req.body;
  const normalizedActor = actorAddress.toLowerCase();
  const normalizedReceiver = receiverAddress ? receiverAddress.toLowerCase() : null;

  const requirements = {
    DISPATCHED_TO_DISTRIBUTOR: ["farmer", "Created", "DispatchedToDistributor"],
    RECEIVED_BY_DISTRIBUTOR: ["distributor", "DispatchedToDistributor", "ReceivedByDistributor"],
    DISPATCHED_TO_RETAILER: ["distributor", "ReceivedByDistributor", "DispatchedToRetailer"],
    RECEIVED_BY_RETAILER: ["retailer", "DispatchedToRetailer", "ReceivedByRetailer"],
    SOLD_TO_CONSUMER: ["retailer", "ReceivedByRetailer", "SoldToConsumer"]
  };

  const [roleField, expectedStatus, newStatus] = requirements[action];
  if (product.status !== expectedStatus) {
    return res.status(409).json({
      success: false,
      message: `Invalid supply-chain state transition. Expected ${expectedStatus}, found ${product.status}.`
    });
  }

  if (product[roleField] !== normalizedActor) {
    return res.status(403).json({
      success: false,
      message: `Signer wallet (${normalizedActor.slice(0, 8)}...) does not match designated ${roleField} (${product[roleField] ? product[roleField].slice(0, 8) + '...' : 'none'}).`
    });
  }

  if (action === "DISPATCHED_TO_DISTRIBUTOR") product.distributor = normalizedReceiver;
  if (action === "DISPATCHED_TO_RETAILER") product.retailer = normalizedReceiver;
  if (action === "SOLD_TO_CONSUMER") product.consumer = normalizedReceiver;

  product.status = newStatus;
  product.history.push({
    action,
    actorAddress: normalizedActor,
    receiverAddress: normalizedReceiver,
    date,
    txHash,
    location: location || null,
    notes: notes || null,
    createdAt: new Date().toISOString()
  });

  if (!product.qrBlockchainHash) product.qrBlockchainHash = txHash;

  await product.save();
  return res.json({ success: true, product });
}

const actionValidators = [
  body("actorAddress").matches(/^0x[a-fA-F0-9]{40}$/),
  body("receiverAddress").optional().matches(/^0x[a-fA-F0-9]{40}$/),
  dateRule("date"),
  body("txHash").matches(/^0x[a-fA-F0-9]{64}$/)
];

router.post("/:productId/dispatch-distributor", [
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "DISPATCHED_TO_DISTRIBUTOR"));

router.post("/:productId/receive-distributor", [
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "RECEIVED_BY_DISTRIBUTOR"));

router.post("/:productId/dispatch-retailer", [
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "DISPATCHED_TO_RETAILER"));

router.post("/:productId/receive-retailer", [
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "RECEIVED_BY_RETAILER"));

router.post("/:productId/sell-consumer", [
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "SOLD_TO_CONSUMER"));

module.exports = router;
