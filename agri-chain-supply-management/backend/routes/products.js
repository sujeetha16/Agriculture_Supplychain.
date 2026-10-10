// Path: backend/routes/products.js
const express = require("express");
const { body, param, validationResult } = require("express-validator");
const Product = require("../models/Product");
const { authenticate, optionalAuth, requireRole, requireWalletMatch } = require("../middleware/auth");
const { verifyTransaction } = require("../services/blockchainVerifier");

const router = express.Router();

function getVerificationFailureResponse(verification) {
  switch (verification.status) {
    case "RPC_UNAVAILABLE":
      return {
        status: 503,
        message: "Sepolia RPC endpoint is temporarily unavailable. Product lifecycle update blocked until on-chain verification can complete."
      };
    case "PENDING_OR_NOT_FOUND":
      return {
        status: 422,
        message: "Transaction receipt not yet confirmed on Ethereum Sepolia ledger. Batch state cannot advance while pending."
      };
    case "TRANSACTION_REVERTED":
      return {
        status: 422,
        message: "Transaction execution reverted on-chain. State transition rejected."
      };
    case "CONTRACT_MISMATCH":
      return {
        status: 422,
        message: "Transaction was not submitted to the authorized AgriChain smart contract."
      };
    case "PRODUCT_ID_MISMATCH":
      return {
        status: 422,
        message: "On-chain transaction event product ID does not match this agricultural batch ID."
      };
    case "EXPECTED_EVENT_MISSING":
      return {
        status: 422,
        message: "Transaction receipt does not contain the expected lifecycle event from AgriChain contract."
      };
    case "ACTION_MISMATCH":
      return {
        status: 422,
        message: "On-chain transaction event does not correspond to the requested supply-chain action."
      };
    case "ACTOR_MISMATCH":
      return {
        status: 422,
        message: "On-chain transaction stakeholder address does not match the authenticated actor."
      };
    case "DEMO_PROHIBITED_IN_PRODUCTION":
      return {
        status: 403,
        message: "Simulated demonstration transactions are strictly prohibited in production."
      };
    case "INVALID_HASH_FORMAT":
      return {
        status: 400,
        message: "Invalid transaction hash format."
      };
    default:
      return {
        status: 422,
        message: "Cryptographic blockchain verification failed."
      };
  }
}

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

// GET /api/products - list all products (public query)
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
  let verifiedOnChainCount = 0;
  let simulatedDemoCount = 0;
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

    if (p.verificationStatus === "VERIFIED_ON_CHAIN") {
      verifiedOnChainCount++;
    } else {
      simulatedDemoCount++;
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
          verificationStatus: h.verificationStatus || "UNVERIFIED",
          isSimulated: h.isSimulated || false,
          createdAt: h.createdAt
        });
      }
    }
  }

  recentEvents.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  res.json({
    success: true,
    stats: {
      totalBatches,
      inTransitCount,
      completedCount,
      verifiedOnChainCount,
      simulatedDemoCount,
      activeFarming: byStatus.Created,
      byStatus,
      byCropType,
      recentActivity: recentEvents.slice(0, 8)
    }
  });
});

// POST /api/products/reset-demo - reloads initial seed data for faculty demos (Non-prod only)
router.post("/reset-demo", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "Catalog reset is prohibited in production tier."
    });
  }

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

// GET /api/products/:productId - single product trace (public)
router.get("/:productId", [
  param("productId").isInt({ min: 1 })
], validate, async (req, res) => {
  const product = await Product.findOne({ productId: Number(req.params.productId) });
  if (!product) {
    return res.status(404).json({ success: false, message: "Agricultural product not found." });
  }
  res.json({ success: true, product });
});

// GET /api/products/:productId/verify - cryptographic verification audit of on-chain state
router.get("/:productId/verify", [
  param("productId").isInt({ min: 1 })
], validate, async (req, res) => {
  const product = await Product.findOne({ productId: Number(req.params.productId) });
  if (!product) {
    return res.status(404).json({ success: false, message: "Agricultural product not found." });
  }

  // Audit product creation hash
  const creationVerification = await verifyTransaction(product.qrBlockchainHash, {
    productId: product.productId,
    expectedAction: "CREATED",
    expectedActor: product.farmer,
    isDemoMode: product.isSimulated
  });

  // Audit each history event hash
  const historyVerifications = [];
  if (Array.isArray(product.history)) {
    for (const h of product.history) {
      const v = await verifyTransaction(h.txHash, {
        productId: product.productId,
        expectedAction: h.action,
        expectedActor: h.actorAddress,
        expectedReceiver: h.receiverAddress,
        isDemoMode: h.isSimulated
      });
      historyVerifications.push({
        action: h.action,
        txHash: h.txHash,
        actorAddress: h.actorAddress,
        receiverAddress: h.receiverAddress,
        verification: v
      });
    }
  }

  res.json({
    success: true,
    productId: product.productId,
    productName: product.name,
    overallStatus: product.status,
    creationVerification,
    historyVerifications
  });
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

// POST /api/products - register new agricultural batch (Farmer Role Required)
router.post("/", [
  authenticate,
  requireRole(1), // Role 1: Farmer
  requireWalletMatch("farmer"),
  body("productId").isInt({ min: 1 }),
  body("name").trim().notEmpty().isLength({ max: 120 }),
  dateRule("harvestDate"),
  addressRule("farmer"),
  body("txHash").isString().notEmpty()
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
    notes,
    isDemoMode
  } = req.body;

  const existing = await Product.findOne({ productId });
  if (existing) {
    return res.status(409).json({ success: false, message: "Batch Product ID already registered." });
  }

  const normalizedFarmer = farmer.toLowerCase();

  // Cryptographic receipt check
  const isDemo = Boolean(isDemoMode || req.user.isDemo);
  const verification = await verifyTransaction(txHash, {
    isDemoMode: isDemo,
    productId: Number(productId),
    expectedAction: "CREATED",
    expectedActor: normalizedFarmer
  });

  // Guard: strictly block unverified actions from creating database records
  if (!verification.verified && verification.status !== "SIMULATED_DEMO") {
    const failure = getVerificationFailureResponse(verification);
    return res.status(failure.status).json({
      success: false,
      status: verification.status,
      message: failure.message,
      verification
    });
  }

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
    verificationStatus: verification.status,
    isSimulated: verification.isSimulated,
    blockNumber: verification.blockNumber || null,
    history: [{
      action: "CREATED",
      actorAddress: normalizedFarmer,
      receiverAddress: null,
      date: harvestDate,
      txHash,
      verificationStatus: verification.status,
      isSimulated: verification.isSimulated,
      blockNumber: verification.blockNumber || null,
      gasUsed: verification.gasUsed || null,
      verifiedAt: verification.verified ? new Date().toISOString() : null,
      location: farmLocation || "Origin Farm",
      notes: "Harvest registered and logged."
    }]
  });

  res.status(201).json({ success: true, product, verification });
});

// Helper for linear supply-chain state machine transitions with authorization & receipt checks
async function updateProductAction(req, res, action) {
  const productId = Number(req.params.productId);
  const product = await Product.findOne({ productId });

  if (!product) {
    return res.status(404).json({ success: false, message: "Agricultural product batch not found." });
  }

  const { actorAddress, receiverAddress, date, txHash, location, notes, isDemoMode } = req.body;
  const normalizedActor = actorAddress.toLowerCase();
  const normalizedReceiver = receiverAddress ? receiverAddress.toLowerCase() : null;

  const requirements = {
    DISPATCHED_TO_DISTRIBUTOR: ["farmer", "Created", "DispatchedToDistributor", 1],
    RECEIVED_BY_DISTRIBUTOR: ["distributor", "DispatchedToDistributor", "ReceivedByDistributor", 2],
    DISPATCHED_TO_RETAILER: ["distributor", "ReceivedByDistributor", "DispatchedToRetailer", 2],
    RECEIVED_BY_RETAILER: ["retailer", "DispatchedToRetailer", "ReceivedByRetailer", 3],
    SOLD_TO_CONSUMER: ["retailer", "ReceivedByRetailer", "SoldToConsumer", 3]
  };

  const [roleField, expectedStatus, newStatus, requiredRole] = requirements[action];

  // 1. Role verification
  if (req.user && !req.user.isDemo && req.user.role !== requiredRole) {
    return res.status(403).json({
      success: false,
      message: `Role mismatch: User role (${req.user.roleName || req.user.role}) is not authorized for ${action}.`
    });
  }

  // 2. State machine sequence validation
  if (product.status !== expectedStatus) {
    return res.status(409).json({
      success: false,
      message: `Invalid supply-chain state transition. Expected '${expectedStatus}', but product is currently '${product.status}'.`
    });
  }

  // 3. Actor custody validation
  if (roleField === "farmer" && product.farmer !== normalizedActor) {
    return res.status(403).json({
      success: false,
      message: `Signer wallet (${normalizedActor.slice(0, 8)}...) does not match designated Farmer (${product.farmer.slice(0, 8)}...).`
    });
  }
  if (roleField === "distributor" && product.distributor && product.distributor !== normalizedActor) {
    return res.status(403).json({
      success: false,
      message: `Signer wallet (${normalizedActor.slice(0, 8)}...) does not match assigned Distributor (${product.distributor.slice(0, 8)}...).`
    });
  }
  if (roleField === "retailer" && product.retailer && product.retailer !== normalizedActor) {
    return res.status(403).json({
      success: false,
      message: `Signer wallet (${normalizedActor.slice(0, 8)}...) does not match assigned Retailer (${product.retailer.slice(0, 8)}...).`
    });
  }

  // Duplicate transaction submission check
  const isDuplicateTx =
    (Array.isArray(product.history) && product.history.some((h) => h.txHash === txHash)) ||
    product.qrBlockchainHash === txHash;
  if (isDuplicateTx) {
    return res.status(409).json({
      success: false,
      message: `Transaction hash ${txHash} has already been processed for this product batch. Duplicate transitions are rejected.`
    });
  }

  // 4. Cryptographic receipt verification
  const verification = await verifyTransaction(txHash, {
    isDemoMode: Boolean(isDemoMode || req.user?.isDemo),
    productId: Number(productId),
    expectedAction: action,
    expectedActor: normalizedActor,
    expectedReceiver: normalizedReceiver
  });

  // Guard: strictly block unverified actions from advancing state
  if (!verification.verified && verification.status !== "SIMULATED_DEMO") {
    const failure = getVerificationFailureResponse(verification);
    return res.status(failure.status).json({
      success: false,
      status: verification.status,
      message: failure.message,
      verification
    });
  }

  // 5. Update custody & state
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
    verificationStatus: verification.status,
    isSimulated: verification.isSimulated,
    blockNumber: verification.blockNumber || null,
    gasUsed: verification.gasUsed || null,
    verifiedAt: verification.verified ? new Date().toISOString() : null,
    location: location || null,
    notes: notes || null,
    createdAt: new Date().toISOString()
  });

  if (!product.qrBlockchainHash) product.qrBlockchainHash = txHash;

  await product.save();
  return res.json({ success: true, product, verification });
}

const actionValidators = [
  body("actorAddress").matches(/^0x[a-fA-F0-9]{40}$/),
  body("receiverAddress").optional().matches(/^0x[a-fA-F0-9]{40}$/),
  dateRule("date"),
  body("txHash").isString().notEmpty()
];

router.post("/:productId/dispatch-distributor", [
  authenticate,
  requireRole(1),
  requireWalletMatch("actorAddress"),
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "DISPATCHED_TO_DISTRIBUTOR"));

router.post("/:productId/receive-distributor", [
  authenticate,
  requireRole(2),
  requireWalletMatch("actorAddress"),
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "RECEIVED_BY_DISTRIBUTOR"));

router.post("/:productId/dispatch-retailer", [
  authenticate,
  requireRole(2),
  requireWalletMatch("actorAddress"),
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "DISPATCHED_TO_RETAILER"));

router.post("/:productId/receive-retailer", [
  authenticate,
  requireRole(3),
  requireWalletMatch("actorAddress"),
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "RECEIVED_BY_RETAILER"));

router.post("/:productId/sell-consumer", [
  authenticate,
  requireRole(3),
  requireWalletMatch("actorAddress"),
  param("productId").isInt({ min: 1 }),
  ...actionValidators
], validate, (req, res) => updateProductAction(req, res, "SOLD_TO_CONSUMER"));

module.exports = router;
