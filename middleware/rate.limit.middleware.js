import rateLimit from "express-rate-limit";

// Global rate limiter — applied to all routes
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again in 15 minutes." },
});

// Strict limiter for auth routes (prevent brute force)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts. Please wait 15 minutes." },
});

// AI feature rate limiter (API cost protection)
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: { message: "AI feature limit reached. Please try again in 1 hour." },
});