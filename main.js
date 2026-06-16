import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { connectDB } from "./utils/db/mongo.js";
import { errorMiddleware } from "./middleware/errorMiddleware.js";
import { globalRateLimiter } from "./middleware/rate.limit.middleware.js";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");
dotenv.config({ override: true });

// Routes
import userRoutes from "./route/user/userRoute.js";
import blogRoutes from "./route/blog/blogRoute.js";
import aiRoutes from "./route/ai/aiRoute.js";
import adminRoutes from "./route/admin/adminRoute.js";



const app = express();

// ─── Security & Utility Middleware ──────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "*", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(globalRateLimiter);

// ─── Database ────────────────────────────────────────────────────────────────
connectDB();

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/users", userRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Scriptify AI API is running" });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Scriptify AI server running on port ${PORT}`));

export default app;