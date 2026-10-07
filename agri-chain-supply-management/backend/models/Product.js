// Path: backend/models/Product.js
const mongoose = require("mongoose");

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
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const productSchema = new mongoose.Schema({
  productId: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  harvestDate: { type: String, required: true },
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

module.exports = mongoose.model("Product", productSchema);
