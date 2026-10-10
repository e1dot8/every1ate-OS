import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailFingerprint, recordAudit } from "@/lib/audit/audit";
import { checkLoginThrottle } from "@/lib/auth/login-throttle";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  checkNewPassword,
  isPasswordBreached,
  passwordProblemMessages,
} from "@/lib/auth/password-policy";
import { getDb } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { resetPasswordEmail } from "@/lib/email/templates";
import { getServerEnv } from "@/lib/env";

const DAY = 60 * 60 * 24;

function requestMeta(headers: Headers | undefined) {
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: headers?.get("x-nf-client-connection-ip") ?? forwarded ?? null,
    userAgent: headers?.get("user-agent") ?? null,
  };
}

function createAuth() {
  const env = getServerEnv();
  const breachCheck = env.PASSWORD_BREACH_CHECK === "on" ? isPasswordBreached : null;

  return betterAuth({
    appName: "Every1.ate OS",
    baseURL: env.appUrl,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.appUrl],
    database: prismaAdapter(getDb(), { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      // Pas d'inscription publique : les comptes naissent d'une invitation (src/lib/auth/invitations.ts).
      disableSignUp: true,
      autoSignIn: false,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(resetPasswordEmail({ to: user.email, name: user.name, url }));
      },
    },

    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "associe", input: false },
      },
    },

    // 7 jours, prolongés à chaque usage (au plus une écriture par jour).
    session: { expiresIn: 7 * DAY, updateAge: DAY },

    // Filet de sécurité sur les appels HTTP directs à /api/auth (stockage partagé en base).
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 10 },
        "/request-password-reset": { window: 15 * 60, max: 5 },
      },
    },

    advanced: {
      ipAddress: { ipAddressHeaders: ["x-nf-client-connection-ip", "x-forwarded-for"] },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-in/email") {
          const email = String(ctx.body?.email ?? "");
          const fingerprint = emailFingerprint(email);
          const decision = await checkLoginThrottle(fingerprint);
          if (decision.blocked) {
            await recordAudit({
              action: "auth.sign_in.blocked",
              targetType: "account",
              targetId: fingerprint,
              ...requestMeta(ctx.headers),
            });
            throw new APIError("TOO_MANY_REQUESTS", {
              code: "LOGIN_THROTTLED",
              message: "Trop de tentatives. Réessayez dans 15 minutes.",
            });
          }
        }

        if (ctx.path === "/reset-password" || ctx.path === "/change-password") {
          const problem = await checkNewPassword(String(ctx.body?.newPassword ?? ""), { breachCheck });
          if (problem) {
            throw new APIError("BAD_REQUEST", {
              code: problem.toUpperCase(),
              message: passwordProblemMessages[problem],
            });
          }
        }

        if (ctx.path === "/sign-out") {
          const session = await getSessionFromCtx(ctx).catch(() => null);
          if (session) {
            await recordAudit({
              action: "auth.sign_out",
              actorId: session.user.id,
              ...requestMeta(ctx.headers),
            });
          }
        }
      }),

      after: createAuthMiddleware(async (ctx) => {
        const meta = requestMeta(ctx.headers);
        const failed = ctx.context.returned instanceof APIError;

        if (ctx.path === "/sign-in/email") {
          const fingerprint = emailFingerprint(String(ctx.body?.email ?? ""));
          const newSession = ctx.context.newSession;
          if (!failed && newSession) {
            await recordAudit({
              action: "auth.sign_in.success",
              actorId: newSession.user.id,
              targetType: "account",
              targetId: fingerprint,
              ...meta,
            });
          } else if (failed && (ctx.context.returned as APIError).body?.code !== "LOGIN_THROTTLED") {
            await recordAudit({
              action: "auth.sign_in.failure",
              targetType: "account",
              targetId: fingerprint,
              ...meta,
            });
          }
          return;
        }

        if (failed) return;

        if (ctx.path === "/request-password-reset") {
          await recordAudit({
            action: "auth.password_reset.requested",
            targetType: "account",
            targetId: emailFingerprint(String(ctx.body?.email ?? "")),
            ...meta,
          });
        } else if (ctx.path === "/reset-password") {
          await recordAudit({ action: "auth.password_reset.completed", targetType: "account", ...meta });
        } else if (ctx.path === "/change-password") {
          const session = ctx.context.session;
          await recordAudit({ action: "auth.password.changed", actorId: session?.user.id, ...meta });
        } else if (ctx.path === "/revoke-session") {
          await recordAudit({
            action: "auth.session.revoked",
            actorId: ctx.context.session?.user.id,
            targetType: "session",
            ...meta,
          });
        } else if (ctx.path === "/revoke-other-sessions") {
          await recordAudit({
            action: "auth.sessions.revoked_others",
            actorId: ctx.context.session?.user.id,
            ...meta,
          });
        }
      }),
    },

    // Doit rester le dernier plugin : écrit les cookies depuis les Server Actions.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { auth?: Auth };

/** Instance unique, créée au premier usage (la configuration est lue à l'exécution, pas au build). */
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}
