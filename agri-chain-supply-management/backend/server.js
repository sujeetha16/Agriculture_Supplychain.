// Path: backend/server.js
require("dotenv").config();
require("express-async-errors");

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { connectDB, isMongoConnected } = require("./config/db");
const productRoutes = require("./routes/products");
const { router: authRoutes } = require("./routes/auth");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// --- Correlation / Request ID & Structured Logging Middleware ---
app.use((req, res, next) => {
  const correlationId = req.headers["x-request-id"] || crypto.randomUUID();
  req.id = correlationId;
  res.setHeader("x-request-id", correlationId);

  const startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    // Structured JSON log for AWS CloudWatch Insights
    const logEntry = {
      level: res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO",
      timestamp: new Date().toISOString(),
      requestId: correlationId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.connection.remoteAddress
    };
    if (res.statusCode >= 400) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
});

// --- Origin-Restricted CORS Configuration ---
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:8080,http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""));

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, cloud health checks, Lambda)
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") return callback(null, true);

    const isAllowed = allowedOrigins.some((allowed) => allowed === origin || allowed === "*");
    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error(`CORS Policy: Origin ${origin} is not allowed.`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-auth-token", "x-demo-role"]
}));

// Body parsing with request size limits
app.use(express.json({ limit: "500kb" }));

// --- Cloud-Ready Health & Observability Endpoint ---
// Checks service liveness & dependency readiness for AWS App Runner, ALB, or ECS
app.get("/api/health", (req, res) => {
  const mongoStatus = isMongoConnected();
  const isHealthy = process.env.NODE_ENV === "production" ? mongoStatus : true;

  const healthData = {
    status: isHealthy ? "healthy" : "degraded",
    service: "Agriculture Supply Chain API",
    version: "2.1.0",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: {
      connected: mongoStatus,
      engine: mongoStatus ? "MongoDB / AWS DocumentDB" : "Local Agriculture Datastore (Sandbox)"
    },
    system: {
      nodeVersion: process.version,
      memoryUsageMB: Math.round(process.memoryUsage().rss / (1024 * 1024))
    }
  };

  res.status(isHealthy ? 200 : 503).json(healthData);
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Error Handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;

if (require.main === module) {
  connectDB().then(() => {
    server = app.listen(PORT, () => {
      console.log(`[Agriculture Supply Chain API] Service listening on http://localhost:${PORT}`);
      console.log(`[Health Endpoint] http://localhost:${PORT}/api/health`);
    });
  }).catch((err) => {
    console.error("Initialization critical error:", err);
    process.exit(1);
  });
}

// Graceful shutdown handling for container orchestrators (ECS / App Runner / Kubernetes)
const gracefulShutdown = (signal) => {
  console.log(`[System] Received ${signal}. Commencing graceful shutdown...`);
  if (server) {
    server.close(() => {
      console.log("[System] HTTP server closed cleanly.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = app;
