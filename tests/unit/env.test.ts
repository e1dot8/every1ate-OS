import { describe, expect, it } from "vitest";
import { EnvValidationError, parseServerEnv } from "@/lib/env";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:secret-password@db.example.com:5432/app",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("parseServerEnv", () => {
  it("accepte une configuration complète", () => {
    expect(parseServerEnv(valid).DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it("applique NODE_ENV=development par défaut", () => {
    expect(
      parseServerEnv({ DATABASE_URL: valid.DATABASE_URL, BETTER_AUTH_SECRET: valid.BETTER_AUTH_SECRET })
        .NODE_ENV,
    ).toBe("development");
  });

  it("rejette une configuration sans DATABASE_URL", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(EnvValidationError);
  });

  it("rejette une URL qui n'est pas PostgreSQL", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: "mysql://localhost/app" })).toThrow(/DATABASE_URL/);
  });

  it("rejette une APP_URL invalide", () => {
    expect(() => parseServerEnv({ ...valid, APP_URL: "pas-une-url" })).toThrow(/APP_URL/);
  });

  it("ne révèle jamais la valeur d'une variable dans le message d'erreur", () => {
    const secret = "mysql://user:secret-password@host/app";
    try {
      parseServerEnv({ ...valid, DATABASE_URL: secret });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("secret-password");
    }
  });

  it("exige un secret d'authentification d'au moins 32 caractères", () => {
    expect(() => parseServerEnv({ ...valid, BETTER_AUTH_SECRET: "court" })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("déduit l'URL publique : APP_URL, puis URL (Netlify), puis localhost", () => {
    expect(parseServerEnv({ ...valid, APP_URL: "https://os.example.com/" }).appUrl).toBe(
      "https://os.example.com",
    );
    expect(parseServerEnv({ ...valid, URL: "https://site.netlify.app" }).appUrl).toBe(
      "https://site.netlify.app",
    );
    expect(parseServerEnv(valid).appUrl).toBe("http://localhost:3000");
  });

  it("choisit Resend dès qu'une clé est fournie, sinon la boîte locale", () => {
    expect(parseServerEnv(valid).emailTransport).toBe("outbox");
    expect(parseServerEnv({ ...valid, RESEND_API_KEY: "re_test" }).emailTransport).toBe("resend");
  });

  it("refuse EMAIL_TRANSPORT=resend sans clé", () => {
    expect(() => parseServerEnv({ ...valid, EMAIL_TRANSPORT: "resend" })).toThrow(/RESEND_API_KEY/);
  });
});

describe("alertes push et WhatsApp", () => {
  // Clés de démonstration au bon format (jamais utilisées pour un envoi).
  const vapid = { VAPID_PUBLIC_KEY: `B${"A".repeat(86)}`, VAPID_PRIVATE_KEY: "c".repeat(43) };

  it("désactive le push sans clés VAPID, l'active (webpush) dès qu'elles sont fournies", () => {
    expect(parseServerEnv(valid).pushTransport).toBe("off");
    expect(parseServerEnv({ ...valid, ...vapid }).pushTransport).toBe("webpush");
    expect(parseServerEnv({ ...valid, ...vapid, PUSH_TRANSPORT: "outbox" }).pushTransport).toBe("outbox");
  });

  it("exige les deux clés VAPID ensemble, et des clés pour PUSH_TRANSPORT=webpush", () => {
    expect(() => parseServerEnv({ ...valid, VAPID_PUBLIC_KEY: vapid.VAPID_PUBLIC_KEY })).toThrow(/VAPID_PRIVATE_KEY/);
    expect(() => parseServerEnv({ ...valid, PUSH_TRANSPORT: "webpush" })).toThrow(/VAPID_PUBLIC_KEY/);
    expect(() => parseServerEnv({ ...valid, ...vapid, VAPID_PRIVATE_KEY: "trop-court" })).toThrow(/VAPID_PRIVATE_KEY/);
  });

  it("déduit le contact VAPID : VAPID_SUBJECT, sinon l'URL https, sinon l'adresse d'expédition", () => {
    expect(parseServerEnv({ ...valid, VAPID_SUBJECT: "mailto:ops@example.test" }).vapidSubject).toBe(
      "mailto:ops@example.test",
    );
    expect(parseServerEnv({ ...valid, APP_URL: "https://os.example.test" }).vapidSubject).toBe(
      "https://os.example.test",
    );
    expect(parseServerEnv({ ...valid, EMAIL_FROM: "OS <alertes@example.test>" }).vapidSubject).toBe(
      "mailto:alertes@example.test",
    );
    expect(() => parseServerEnv({ ...valid, VAPID_SUBJECT: "ops@example.test" })).toThrow(/VAPID_SUBJECT/);
  });

  it("utilise CallMeBot par défaut pour WhatsApp, outbox sur demande", () => {
    expect(parseServerEnv(valid).whatsappTransport).toBe("callmebot");
    expect(parseServerEnv({ ...valid, WHATSAPP_TRANSPORT: "outbox" }).whatsappTransport).toBe("outbox");
    expect(() => parseServerEnv({ ...valid, WHATSAPP_TRANSPORT: "twilio" })).toThrow(/WHATSAPP_TRANSPORT/);
  });

  it("accepte une SECRETS_KEY de 32 octets en base64, refuse le reste sans afficher la valeur", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    expect(parseServerEnv({ ...valid, SECRETS_KEY: key }).SECRETS_KEY).toBe(key);
    const tooShort = Buffer.alloc(16, 7).toString("base64");
    try {
      parseServerEnv({ ...valid, SECRETS_KEY: tooShort });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toMatch(/SECRETS_KEY/);
      expect((error as Error).message).not.toContain(tooShort);
    }
  });
});
