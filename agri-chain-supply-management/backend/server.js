// Path: backend/server.js
require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const { connectDB, isMongoConnected } = require("./config/db");
const productRoutes = require("./routes/products");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Configure robust CORS for local and cloud environments
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, health-checks)
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use(express.json());

// Cloud Health Check Endpoint (Suitable for AWS App Runner, ALB, ECS Health Checks)
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "Agriculture Supply Chain API",
    version: "2.0.0",
    database: isMongoConnected() ? "MongoDB / AWS DocumentDB (Connected)" : "Local Agriculture Datastore (Active)",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/products", productRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Agriculture Supply Chain API] Service listening on http://localhost:${PORT}`);
    console.log(`[Health Endpoint] http://localhost:${PORT}/api/health`);
  });
}).catch((err) => {
  console.error("Initialization error:", err);
});
