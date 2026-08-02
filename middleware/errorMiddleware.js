/**
 * Global error handling middleware.
 * All controllers call next(error) to reach here.
 */
export const errorMiddleware = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.stack || err.message);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(". ") });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : err.message || "Internal server error",
  });
};