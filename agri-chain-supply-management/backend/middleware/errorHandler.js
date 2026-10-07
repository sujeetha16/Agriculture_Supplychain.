// Path: backend/middleware/errorHandler.js
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate resource"
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
}

module.exports = { notFound, errorHandler };
