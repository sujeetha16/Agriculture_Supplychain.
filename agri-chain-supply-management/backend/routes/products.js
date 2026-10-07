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

router.get("/", async (req, res) => {
  const products = await Product.find().sort({ productId: 1 });
  res.json({ success: true, products });
});

router.get("/:productId", [
  param("productId").isInt({ min: 1 })
], validate, async (req, res) => {
  const product = await Product.findOne({ productId: Number(req.params.productId) });
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  res.json({ success: true, product });
});

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

  res.json({ success: true, products });
});

router.post("/", [
  body("productId").isInt({ min: 1 }),
  body("name").trim().notEmpty().isLength({ max: 120 }),
  dateRule("harvestDate"),
  addressRule("farmer"),
  body("txHash").matches(/^0x[a-fA-F0-9]{64}$/)
], validate, async (req, res) => {
  const { productId, name, harvestDate, farmer, txHash } = req.body;

  const existing = await Product.findOne({ productId });
  if (existing) {
    return res.status(409).json({ success: false, message: "Product ID already exists" });
  }

  const product = await Product.create({
    productId,
    name,
    harvestDate,
    farmer,
    status: "Created",
    qrBlockchainHash: txHash,
    history: [{
      action: "CREATED",
      actorAddress: farmer,
      date: harvestDate,
      txHash
    }]
  });

  res.status(201).json({ success: true, product });
});

async function updateProductAction(req, res, action) {
  const productId = Number(req.params.productId);
  const product = await Product.findOne({ productId });

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }

  const { actorAddress, receiverAddress, date, txHash } = req.body;
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
      message: `Invalid state transition. Expected ${expectedStatus}, found ${product.status}`
    });
  }

  if (product[roleField] !== normalizedActor) {
    return res.status(403).json({
      success: false,
      message: `Wallet does not match the assigned ${roleField}`
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
    txHash
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
