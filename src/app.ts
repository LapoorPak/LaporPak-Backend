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
} from "./config/storage.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { swaggerSpec, swaggerUi } from "./config/swagger.js";
import authRouter from "./modules/auth/auth.routes.js";
import reportRouter from "./modules/report/report.routes.js";
import agencyRouter from "./modules/agency/agency.routes.js";
import categoryRouter from "./modules/category/category.routes.js";
import uploadRouter from "./modules/upload/upload.routes.js";
import notificationRouter from "./modules/notification/notification.routes.js";
import adminRouter from "./modules/admin/admin.routes.js";

export function createApp() {
  const app = express();
  app.disable("etag");

  app.use(corsMiddleware);
  app.use(requestLogger);
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  app.use("/api/auth", authRouter);
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.get("/api/docs/openapi.json", (_req, res) => {
    res.json(swaggerSpec);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(OFFICE_PHOTO_PUBLIC_PATH, express.static(OFFICE_PHOTO_DIR));

  app.use("/api/reports", reportRouter);
  app.use("/api/agencies", agencyRouter);
  app.use("/api/categories", categoryRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/upload", uploadRouter);
  app.use("/api/notifications", notificationRouter);

  /**
   * @swagger
   * /api/health/live:
   *   get:
   *     tags: [Health]
   *     summary: Liveness check
   *     responses:
   *       200:
   *         description: Service is alive
   *         content:
   *           application/json:
   *             schema:
   *               $ref: "#/components/schemas/HealthLiveResponse"
   */
  app.get("/api/health/live", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /api/health:
   *   get:
   *     tags: [Health]
   *     summary: Detailed health check
   *     responses:
   *       200:
   *         description: Service is healthy
   *       503:
   *         description: Service is unhealthy
   */
  app.get("/api/health", async (_req, res, next) => {
    try {
      const health = await getHealthSnapshot();
      res.status(health.status === "ok" ? 200 : 503).json(health);
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);

  return app;
}

