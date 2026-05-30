import jwt from "jsonwebtoken";
import User from "../models/user/users.js";

/**
 * Verifies the JWT access token in Authorization header.
 * Attaches the user document to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(decoded._id).select(
      "-password -refreshToken -resetOTP -resetOTPExpiry"
    );

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.isSuspended) {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication — attaches user if token present, proceeds without error if not.
 * Used on public routes that benefit from knowing who the user is (e.g., blog detail).
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // no token — proceed anonymously
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded._id).select(
        "-password -refreshToken"
      );
      if (user && !user.isSuspended) req.user = user;
    } catch {
      // Invalid token — proceed anonymously
    }

    next();
  } catch (error) {
    next(error);
  }
};