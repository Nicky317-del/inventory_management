
function errorHandler(err, req, res, next) {
  console.error("API Error:", err.message);

  // Invalid MongoDB document ID
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID or data format"
    });
  }

  // Mongoose field validation errors
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map(
      (error) => error.message
    );

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors
    });
  }

  // Duplicate values, such as a unique product field
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with this value already exists"
    });
  }

  // Invalid JSON in request body
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body"
    });
  }

  // Default server error
  return res.status(err.statusCode || 500).json({
    success: false,
    message:
      err.statusCode && err.statusCode < 500
        ? err.message
        : "Internal server error"
  });
}

module.exports = errorHandler;
