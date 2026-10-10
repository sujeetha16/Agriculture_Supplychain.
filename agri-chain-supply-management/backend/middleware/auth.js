// Path: backend/middleware/auth.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "agri-chain-production-jwt-secret-key-change-in-env-2026";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Validates JWT Bearer token and sets req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];

  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  // Demo Fallback ONLY in non-production environments when explicitly requested
  if (!token) {
    if (!IS_PRODUCTION && req.headers["x-demo-role"]) {
      const demoRole = Number(req.headers["x-demo-role"]);
      req.user = {
        id: `demo-user-${demoRole}`,
        username: `demo_role_${demoRole}`,
        role: demoRole,
        isDemo: true
      };
      return next();
    }

    return res.status(401).json({
      success: false,
      message: "Authentication required. Please provide a valid Bearer token in the Authorization header."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session token has expired. Please log in again."
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token signature."
    });
  }
}

/**
 * Optional authentication: attaches user if token is present and valid,
 * but allows guest access for public queries.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers["x-auth-token"];
  if (!authHeader) return next();

  let token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (_) {
    // Continue as guest
  }
  return next();
}

/**
 * Restricts access to specified roles:
 * 1: Farmer, 2: Distributor, 3: Retailer, 4: Consumer
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required before role verification."
      });
    }

    if (!allowedRoles.includes(Number(req.user.role))) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: This operation requires role [${allowedRoles.join(", ")}], but active role is ${req.user.role}.`
      });
    }

    next();
  };
}

/**
 * Verifies that the authenticated actor's wallet address matches the actorAddress provided in the request body.
 */
function requireWalletMatch(walletParamName = "actorAddress") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    // Skip wallet match check if in local demo mode without configured wallet
    if (req.user.isDemo && !req.user.walletAddress) {
      return next();
    }

    const expectedWallet = req.body[walletParamName] || req.body.farmer;
    if (expectedWallet && req.user.walletAddress) {
      if (req.user.walletAddress.toLowerCase() !== expectedWallet.toLowerCase()) {
        return res.status(403).json({
          success: false,
          message: `Actor wallet mismatch: Logged in wallet (${req.user.walletAddress}) cannot transact on behalf of (${expectedWallet}).`
        });
      }
    }

    next();
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  requireWalletMatch,
  JWT_SECRET
};
