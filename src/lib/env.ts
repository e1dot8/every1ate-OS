import "server-only";
import { z } from "zod";

/**
 * Variables d'environnement côté serveur, validées au premier accès.
 * Une configuration incomplète provoque une erreur explicite — sans jamais
 * afficher la valeur des variables (seulement leur nom).
 */
const postgresUrl = z
  .string()
  .min(1)
  .refine((value) => /^postgres(ql)?:\/\//.test(value), {
    message: "doit être une URL postgresql://",
  });

export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: postgresUrl,
    DIRECT_DATABASE_URL: postgresUrl.optional(),
    /** URL publique de l'application. Netlify fournit URL ; en local, localhost. */
    APP_URL: z.url().optional(),
    URL: z.url().optional(),
    BETTER_AUTH_SECRET: z.string().min(32, { message: "doit contenir au moins 32 caractères" }),
    /** resend = envoi réel ; outbox = stockage local (développement et tests). */
    EMAIL_TRANSPORT: z.enum(["resend", "outbox"]).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).default("Every1.ate OS <notifications@every1ate.com>"),
    /** Vérification des mots de passe dans les fuites connues (Have I Been Pwned). */
    PASSWORD_BREACH_CHECK: z.enum(["on", "off"]).default("on"),
    /** Secret partagé avec la fonction planifiée Netlify (escalades, priorités). */
    CRON_SECRET: z.string().min(32, { message: "doit contenir au moins 32 caractères" }).optional(),
    /** Notifications push (Web Push, VAPID) : `npx web-push generate-vapid-keys`. */
    VAPID_PUBLIC_KEY: z
      .string()
      .regex(/^[A-Za-z0-9_-]{80,90}$/, { message: "doit être une clé publique VAPID (base64url)" })
      .optional(),
    VAPID_PRIVATE_KEY: z
      .string()
      .regex(/^[A-Za-z0-9_-]{40,46}$/, { message: "doit être une clé privée VAPID (base64url)" })
      .optional(),
    /** Contact de l'expéditeur des notifications push : mailto: ou https:. */
    VAPID_SUBJECT: z
      .string()
      .regex(/^(mailto:\S+@\S+|https:\/\/\S+)$/, { message: "doit commencer par mailto: ou https://" })
      .optional(),
    /** webpush = envoi réel ; outbox = journal seulement (tests). Par défaut : webpush si clés VAPID. */
    PUSH_TRANSPORT: z.enum(["webpush", "outbox"]).optional(),
    /** callmebot = envoi réel (gratuit, usage personnel) ; outbox = journal seulement (tests). */
    WHATSAPP_TRANSPORT: z.enum(["callmebot", "outbox"]).default("callmebot"),
    /** Clé de chiffrement des secrets stockés (32 octets en base64). À défaut : dérivée de BETTER_AUTH_SECRET. */
    SECRETS_KEY: z
      .string()
      .refine((value) => decodesTo32Bytes(value), { message: "doit faire 32 octets encodés en base64" })
      .optional(),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "requise quand EMAIL_TRANSPORT=resend",
      });
    }
    if (Boolean(env.VAPID_PUBLIC_KEY) !== Boolean(env.VAPID_PRIVATE_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: [env.VAPID_PUBLIC_KEY ? "VAPID_PRIVATE_KEY" : "VAPID_PUBLIC_KEY"],
        message: "les deux clés VAPID vont ensemble",
      });
    }
    if (env.PUSH_TRANSPORT === "webpush" && !(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["VAPID_PUBLIC_KEY"],
        message: "requise quand PUSH_TRANSPORT=webpush",
      });
    }
  })
  .transform((env) => {
    const appUrl = (env.APP_URL ?? env.URL ?? "http://localhost:3000").replace(/\/$/, "");
    const hasVapid = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
    const fromAddress = /<([^>]+)>/.exec(env.EMAIL_FROM)?.[1] ?? env.EMAIL_FROM;
    return {
      ...env,
      appUrl,
      emailTransport: env.EMAIL_TRANSPORT ?? (env.RESEND_API_KEY ? "resend" : "outbox"),
      /** off = notifications push indisponibles (aucune clé VAPID). */
      pushTransport: (env.PUSH_TRANSPORT ?? (hasVapid ? "webpush" : "off")) as "webpush" | "outbox" | "off",
      vapidSubject:
        env.VAPID_SUBJECT ?? (appUrl.startsWith("https://") ? appUrl : `mailto:${fromAddress.trim()}`),
      whatsappTransport: env.WHATSAPP_TRANSPORT,
    };
  });

/** Vrai si la chaîne (base64 ou base64url) décode exactement 32 octets. */
function decodesTo32Bytes(value: string): boolean {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9+/_-]{42,44}={0,2}$/.test(trimmed)) return false;
  return Buffer.from(trimmed.replace(/-/g, "+").replace(/_/g, "/"), "base64").length === 32;
}

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Configuration serveur invalide : ${issues.join(" ; ")}`);
    this.name = "EnvValidationError";
  }
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`),
    );
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
