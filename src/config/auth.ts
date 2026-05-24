import "dotenv/config";
import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { deleteSessionCookie } from "better-auth/cookies";
import { admin, emailOTP } from "better-auth/plugins";
import { prisma } from "./db.js";
import {
  ADMIN_PORTAL,
  AGENCY_PORTAL,
  CITIZEN_PORTAL,
  getPortalForRole,
  type AuthPortal,
} from "../utils/authPortal.js";
import { sendAuthOtpEmail } from "../modules/auth/auth-otp-email.service.js";

const betterAuthUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const isSecureDeployment = betterAuthUrl.startsWith("https://");
const PORTAL_ERROR_COOKIE = "lp_portal_error";
const authOtpExpiresInSeconds = 60 * 5;
const authOtpLength = 6;
const authOtpAllowedAttempts = 3;

function getPortalFromUrl(url: unknown) {
  if (typeof url !== "string" || !url.trim()) {
    return null;
  }

  try {
    const parsedUrl = new URL(url, clientUrl);
    const pathname = parsedUrl.pathname;

    if (pathname === "/agency" || pathname.startsWith("/agency/")) {
      return AGENCY_PORTAL;
    }

    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return ADMIN_PORTAL;
    }

    if (
      pathname === "/login" ||
      pathname.startsWith("/login/") ||
      pathname === "/register" ||
      pathname.startsWith("/register/") ||
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/")
    ) {
      return CITIZEN_PORTAL;
    }
  } catch {
    return null;
  }

  return null;
}

function isPortal(
  value: unknown,
): value is AuthPortal {
  return (
    value === AGENCY_PORTAL ||
    value === CITIZEN_PORTAL ||
    value === ADMIN_PORTAL
  );
}

function getRequestPortal(ctx: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Headers;
}) {
  const bodyPortal = ctx.body?.portal;
  if (isPortal(bodyPortal)) {
    return bodyPortal;
  }

  const queryPortal = ctx.query?.portal;
  if (isPortal(queryPortal)) {
    return queryPortal;
  }

  const callbackPortal = getPortalFromUrl(ctx.body?.callbackURL);
  if (callbackPortal) {
    return callbackPortal;
  }

  const errorCallbackPortal = getPortalFromUrl(ctx.body?.errorCallbackURL);
  if (errorCallbackPortal) {
    return errorCallbackPortal;
  }

  const newUserCallbackPortal = getPortalFromUrl(ctx.body?.newUserCallbackURL);
  if (newUserCallbackPortal) {
    return newUserCallbackPortal;
  }

  const refererPortal = getPortalFromUrl(ctx.headers?.get("referer"));
  if (refererPortal) {
    return refererPortal;
  }

  return null;
}

function buildPortalErrorRedirect(
  targetUrl: string,
  code: string,
  message: string,
) {
  const redirectUrl = new URL(targetUrl, clientUrl);
  redirectUrl.searchParams.set("portal_error", code);
  redirectUrl.searchParams.set("portal_message", message);
  return redirectUrl.toString();
}

function buildPortalErrorCookie(code: string, message: string) {
  const value = encodeURIComponent(JSON.stringify({ code, message }));
  return `${PORTAL_ERROR_COOKIE}=${value}; Max-Age=60; Path=/; SameSite=Lax`;
}

function getPortalMismatchResponse(
  userPortal: AuthPortal,
  targetPortal: AuthPortal,
) {
  if (targetPortal === CITIZEN_PORTAL) {
    if (userPortal === ADMIN_PORTAL) {
      return {
        code: "citizen_portal_forbidden",
        message: "Akun Anda terdaftar sebagai admin. Silakan login melalui portal admin.",
      };
    }

    return {
      code: "citizen_portal_forbidden",
      message: "Akun Anda terdaftar sebagai petugas. Silakan login melalui portal dinas.",
    };
  }

  if (targetPortal === AGENCY_PORTAL) {
    if (userPortal === ADMIN_PORTAL) {
      return {
        code: "agency_portal_forbidden",
        message: "Akun Anda terdaftar sebagai admin. Silakan login melalui portal admin.",
      };
    }

    return {
      code: "agency_portal_forbidden",
      message: "Akun Anda adalah akun warga. Silakan login melalui portal warga.",
    };
  }

  if (userPortal === CITIZEN_PORTAL) {
    return {
      code: "admin_portal_forbidden",
      message: "Akun Anda adalah akun warga. Portal admin hanya untuk administrator.",
    };
  }

  return {
    code: "admin_portal_forbidden",
    message: "Akun Anda terdaftar sebagai petugas. Silakan login melalui portal dinas.",
  };
}

function logPortalDecision(details: Record<string, unknown>) {
  console.log("[AUTH PORTAL]", JSON.stringify(details));
}

async function revokeNewSession(
  ctx: Parameters<typeof createAuthMiddleware>[0] extends (
    ...args: infer A
  ) => unknown
    ? A[0]
    : never,
) {
  const newSession = ctx.context.newSession;

  if (!newSession) {
    return;
  }

  await ctx.context.internalAdapter.deleteSession(newSession.session.token);
  deleteSessionCookie(ctx);
  ctx.context.setNewSession(null);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: betterAuthUrl,
  basePath: "/api/auth",
  trustedOrigins: [clientUrl, betterAuthUrl],
  account: {
    storeStateStrategy: "database",
    skipStateCookieCheck: true,
  },
  advanced: {
    useSecureCookies: isSecureDeployment,
    defaultCookieAttributes: {
      sameSite: isSecureDeployment ? "none" : "lax",
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      disableImplicitSignUp: true,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;

      if (!newSession) {
        return;
      }

      const userPortal = getPortalForRole(newSession.user.role);
      const requestPortal = getRequestPortal(ctx);

      let targetPortal: AuthPortal | null = requestPortal;
      let redirectTarget: string | null = null;
      let callbackUrl: string | null = null;
      let parsedStatePortal: string | null = null;

      if (ctx.path === "/sign-in/email") {
        callbackUrl = String(ctx.body?.callbackURL || "");
        if (!targetPortal) {
          targetPortal = getPortalFromUrl(callbackUrl) || CITIZEN_PORTAL;
        }
      } else if (ctx.path === "/sign-in/email-otp") {
        if (!targetPortal) {
          targetPortal = CITIZEN_PORTAL;
        }
      } else if (ctx.path?.startsWith("/callback/")) {
        const oauthState = await getOAuthState();
        if (oauthState) {
          parsedStatePortal = isPortal(oauthState.portal)
            ? oauthState.portal
            : null;
          targetPortal = isPortal(oauthState.portal)
            ? oauthState.portal
            : getPortalFromUrl(oauthState.callbackURL) || CITIZEN_PORTAL;
          redirectTarget = oauthState.errorURL || oauthState.callbackURL;
        }
      }

      logPortalDecision({
        path: ctx.path,
        userEmail: newSession.user.email,
        userRole: newSession.user.role,
        userPortal,
        requestPortal,
        targetPortal,
        callbackUrl,
        parsedStatePortal,
        redirectTarget,
        referer: ctx.headers?.get("referer") || null,
      });

      if (!targetPortal) {
        logPortalDecision({
          decision: "allow",
          reason: "target_portal_not_detected",
          userEmail: newSession.user.email,
          userRole: newSession.user.role,
          path: ctx.path,
        });
        return;
      }

      if (userPortal === targetPortal) {
        logPortalDecision({
          decision: "allow",
          reason: `${userPortal}_user_on_${targetPortal}_portal`,
          userEmail: newSession.user.email,
          userRole: newSession.user.role,
          userPortal,
          targetPortal,
          path: ctx.path,
        });
        return;
      }

      const mismatch = getPortalMismatchResponse(userPortal, targetPortal);
      logPortalDecision({
        decision: "deny",
        reason: `${userPortal}_user_on_${targetPortal}_portal`,
        userEmail: newSession.user.email,
        userRole: newSession.user.role,
        userPortal,
        targetPortal,
        path: ctx.path,
      });
      await revokeNewSession(ctx);
      if (ctx.path === "/sign-in/email") {
        throw new APIError("FORBIDDEN", {
          message: mismatch.message,
        });
      } else if (redirectTarget) {
        return {
          headers: new Headers({
            Location: buildPortalErrorRedirect(
              redirectTarget,
              mismatch.code,
              mismatch.message,
            ),
            "Set-Cookie": buildPortalErrorCookie(
              mismatch.code,
              mismatch.message,
            ),
          }),
        };
      }
    }),
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
    emailOTP({
      overrideDefaultEmailVerification: true,
      disableSignUp: true,
      otpLength: authOtpLength,
      expiresIn: authOtpExpiresInSeconds,
      allowedAttempts: authOtpAllowedAttempts,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        await sendAuthOtpEmail({ email, otp, type });
      },
    }),
    admin({
      defaultRole: "warga",
    }),
  ],
});
