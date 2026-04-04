import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./db.js";

const betterAuthUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: betterAuthUrl,
  basePath: "/api/auth",
  trustedOrigins: [clientUrl, betterAuthUrl],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "warga",
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "warga",
    }),
  ],
});
