import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";

import { auth } from "./config/auth.js";
import { corsMiddleware } from "./config/cors.js";
import { getHealthSnapshot } from "./config/health.js";
import {
  OFFICE_PHOTO_DIR,
  OFFICE_PHOTO_PUBLIC_PATH,
  UPLOAD_DIR,
  UPLOAD_PUBLIC_PATH,
} from "./config/storage.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import authRouter from "./routes/authRoutes.js";
import reportRouter from "./routes/reportRoutes.js";
import agencyRouter from "./routes/agencyRoutes.js";
import categoryRouter from "./routes/categoryRoutes.js";
import uploadRouter from "./routes/uploadRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import adminRouter from "./routes/adminRoutes.js";

const app = express();
const port = Number(process.env.PORT || 3000);

// 1. CORS first (with credentials for Better Auth cookies)
app.use(corsMiddleware);
app.use(requestLogger);

// 2. Custom auth routes that need access to Better Auth session cookies
app.use("/api/auth", authRouter);

// 3. Better Auth handler BEFORE express.json() — Express v5 uses /*splat
app.all("/api/auth/*splat", toNodeHandler(auth));

// 4. Other middleware AFTER Better Auth
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Static files for uploads
app.use(UPLOAD_PUBLIC_PATH, express.static(UPLOAD_DIR));
app.use(OFFICE_PHOTO_PUBLIC_PATH, express.static(OFFICE_PHOTO_DIR));

// 6. API routes
app.use("/api/reports", reportRouter);
app.use("/api/agencies", agencyRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/admin", adminRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/notifications", notificationRouter);

// 7. Health check
app.get("/api/health/live", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", async (_req, res, next) => {
  try {
    const health = await getHealthSnapshot();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  } catch (error) {
    next(error);
  }
});

// 8. Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

export default app;
