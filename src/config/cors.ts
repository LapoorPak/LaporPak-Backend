import cors from "cors";

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

export const corsMiddleware = cors({
  origin: allowedOrigins,
  credentials: true,
});
