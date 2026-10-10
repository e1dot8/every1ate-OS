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
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_TRANSPORT === "resend" && !env.RESEND_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "requise quand EMAIL_TRANSPORT=resend",
      });
    }
  })
  .transform((env) => ({
    ...env,
    appUrl: (env.APP_URL ?? env.URL ?? "http://localhost:3000").replace(/\/$/, ""),
    emailTransport: env.EMAIL_TRANSPORT ?? (env.RESEND_API_KEY ? "resend" : "outbox"),
  }));

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
