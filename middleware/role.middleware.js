/**
 * Role-based access control middleware.
 * Must be used AFTER authenticate middleware.
 *
 * Usage: authorize("admin") or authorize("admin", "blogger")
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${roles.join(", ")}`,
      });
    }

    next();
  };
};