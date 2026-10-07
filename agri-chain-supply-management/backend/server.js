// Path: backend/server.js
require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const productRoutes = require("./routes/products");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173"
}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "AgriChain backend is running" });
});

app.use("/api/products", productRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });
