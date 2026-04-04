import "dotenv/config";
import { APIError, betterAuth } from "better-auth";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { deleteSessionCookie } from "better-auth/cookies";
import { admin } from "better-auth/plugins";
import { prisma } from "./db.js";

const betterAuthUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const agencyRoleErrorMessage =
  "Akun Anda adalah akun warga. Silakan login melalui portal warga.";
const citizenRoleErrorMessage =
  "Akun Anda adalah akun pemerintah. Silakan login melalui portal dinas.";
const AGENCY_PORTAL = "agency";
const CITIZEN_PORTAL = "citizen";
const PORTAL_ERROR_COOKIE = "lp_portal_error";

function isAgencyCallbackUrl(url: unknown) {
  if (typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsedUrl = new URL(url, clientUrl);
    return (
      parsedUrl.pathname === "/agency" ||
      parsedUrl.pathname.startsWith("/agency/")
    );
  } catch {
    return false;
  }
}

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
): value is typeof AGENCY_PORTAL | typeof CITIZEN_PORTAL {
  return value === AGENCY_PORTAL || value === CITIZEN_PORTAL;
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

  const refererPortal = getPortalFromUrl(ctx.headers?.get("referer"));
  if (refererPortal) {
    return refererPortal;
  }

  return null;
}

function buildAuthErrorRedirect(targetUrl: string) {
  const redirectUrl = new URL(targetUrl, clientUrl);
  redirectUrl.searchParams.set("portal_error", "agency_role_forbidden");
  redirectUrl.searchParams.set("portal_message", agencyRoleErrorMessage);
  return redirectUrl.toString();
}

function buildCitizenAuthErrorRedirect(targetUrl: string) {
  const redirectUrl = new URL(targetUrl, clientUrl);
  redirectUrl.searchParams.set("portal_error", "citizen_role_forbidden");
  redirectUrl.searchParams.set("portal_message", citizenRoleErrorMessage);
  return redirectUrl.toString();
}

function buildPortalErrorCookie(code: string, message: string) {
  const value = encodeURIComponent(JSON.stringify({ code, message }));
  return `${PORTAL_ERROR_COOKIE}=${value}; Max-Age=60; Path=/; SameSite=Lax`;
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

      const isWarga = newSession.user.role === "warga";
      const requestPortal = getRequestPortal(ctx);

      let targetPortal: typeof AGENCY_PORTAL | typeof CITIZEN_PORTAL | null =
        requestPortal;
      let redirectTarget: string | null = null;
      let callbackUrl: string | null = null;
      let parsedStatePortal: string | null = null;

      if (ctx.path === "/sign-in/email") {
        callbackUrl = String(ctx.body?.callbackURL || "");
        if (!targetPortal) {
          targetPortal = isAgencyCallbackUrl(callbackUrl)
            ? AGENCY_PORTAL
            : CITIZEN_PORTAL;
        }
      } else if (ctx.path?.startsWith("/callback/")) {
        const oauthState = await getOAuthState();
        if (oauthState) {
          parsedStatePortal = isPortal(oauthState.portal)
            ? oauthState.portal
            : null;
          targetPortal = isPortal(oauthState.portal)
            ? oauthState.portal
            : isAgencyCallbackUrl(oauthState.callbackURL)
              ? AGENCY_PORTAL
              : CITIZEN_PORTAL;
          redirectTarget = oauthState.errorURL || oauthState.callbackURL;
        }
      }

      logPortalDecision({
        path: ctx.path,
        userEmail: newSession.user.email,
        userRole: newSession.user.role,
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

      if (!isWarga) {
        if (targetPortal === CITIZEN_PORTAL) {
          logPortalDecision({
            decision: "deny",
            reason: "agency_user_on_citizen_portal",
            userEmail: newSession.user.email,
            userRole: newSession.user.role,
            targetPortal,
            path: ctx.path,
          });
          await revokeNewSession(ctx);
          if (ctx.path === "/sign-in/email") {
            throw new APIError("FORBIDDEN", {
              message: citizenRoleErrorMessage,
            });
          } else if (redirectTarget) {
            return {
              headers: new Headers({
                Location: buildCitizenAuthErrorRedirect(redirectTarget),
                "Set-Cookie": buildPortalErrorCookie(
                  "citizen_role_forbidden",
                  citizenRoleErrorMessage,
                ),
              }),
            };
          }
        }
        logPortalDecision({
          decision: "allow",
          reason: "agency_user_on_agency_portal",
          userEmail: newSession.user.email,
          userRole: newSession.user.role,
          targetPortal,
          path: ctx.path,
        });
        return;
      }

      if (isWarga) {
        if (targetPortal === AGENCY_PORTAL) {
          logPortalDecision({
            decision: "deny",
            reason: "warga_user_on_agency_portal",
            userEmail: newSession.user.email,
            userRole: newSession.user.role,
            targetPortal,
            path: ctx.path,
          });
          await revokeNewSession(ctx);
          if (ctx.path === "/sign-in/email") {
            throw new APIError("FORBIDDEN", {
              message: agencyRoleErrorMessage,
            });
          } else if (redirectTarget) {
            return {
              headers: new Headers({
                Location: buildAuthErrorRedirect(redirectTarget),
                "Set-Cookie": buildPortalErrorCookie(
                  "agency_role_forbidden",
                  agencyRoleErrorMessage,
                ),
              }),
            };
          }
        }
        logPortalDecision({
          decision: "allow",
          reason: "warga_user_on_citizen_portal",
          userEmail: newSession.user.email,
          userRole: newSession.user.role,
          targetPortal,
          path: ctx.path,
        });
        return;
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
    admin({
      defaultRole: "warga",
    }),
  ],
});
