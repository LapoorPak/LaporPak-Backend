import cors from "cors";

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

export const corsMiddleware = cors({
  origin: clientUrl,
  credentials: true,
});
