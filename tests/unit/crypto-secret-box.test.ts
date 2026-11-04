import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SecretBoxError, deriveSecretsKey, isSealed, openSecret, sealSecret } from "@/lib/crypto/secret-box";

const key = randomBytes(32);

/** Remplace un caractère d'une partie (iv, tag ou chiffré) sans changer le format. */
function tamper(sealed: string, part: 1 | 2 | 3): string {
  const parts = sealed.split(":");
  const chars = parts[part].split("");
  const i = Math.floor(chars.length / 2);
  chars[i] = chars[i] === "A" ? "B" : "A";
  parts[part] = chars.join("");
  return parts.join(":");
}

describe("coffre à secrets (AES-256-GCM)", () => {
  it("chiffre puis déchiffre à l'identique (accents, emoji)", () => {
    const secret = "clé-123456 é 🔐";
    const sealed = sealSecret(secret, key);
    expect(openSecret(sealed, key)).toBe(secret);
  });

  it("produit le format v1:<iv>:<tag>:<chiffré> en base64url, sans le texte clair", () => {
    const sealed = sealSecret("1234567", key);
    expect(sealed).toMatch(/^v1:[A-Za-z0-9_-]{16}:[A-Za-z0-9_-]{22}:[A-Za-z0-9_-]+$/);
    expect(sealed).not.toContain("1234567");
    expect(isSealed(sealed)).toBe(true);
    expect(isSealed("1234567")).toBe(false);
  });

  it("utilise un IV différent à chaque chiffrement", () => {
    expect(sealSecret("même texte", key)).not.toBe(sealSecret("même texte", key));
  });

  it("refuse un texte altéré (IV, étiquette ou chiffré)", () => {
    const sealed = sealSecret("clé personnelle", key);
    for (const part of [1, 2, 3] as const) {
      expect(() => openSecret(tamper(sealed, part), key)).toThrow(SecretBoxError);
    }
  });

  it("refuse un format inconnu ou tronqué", () => {
    const sealed = sealSecret("x", key);
    expect(() => openSecret(sealed.replace(/^v1/, "v2"), key)).toThrow(SecretBoxError);
    expect(() => openSecret(sealed.split(":").slice(0, 3).join(":"), key)).toThrow(SecretBoxError);
    expect(() => openSecret("v1:%%%:%%%:%%%", key)).toThrow(SecretBoxError);
  });

  it("refuse une mauvaise clé, sans révéler le contenu", () => {
    const sealed = sealSecret("secret-tres-prive", key);
    try {
      openSecret(sealed, randomBytes(32));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(SecretBoxError);
      expect((error as Error).message).not.toContain("secret-tres-prive");
    }
  });

  it("lie le secret à son contexte : un chiffré recopié pour un autre usage ne s'ouvre pas", () => {
    const sealed = sealSecret("123456", key, "whatsapp-key:user_a");
    expect(openSecret(sealed, key, "whatsapp-key:user_a")).toBe("123456");
    expect(() => openSecret(sealed, key, "whatsapp-key:user_b")).toThrow(SecretBoxError);
  });

  it("refuse une clé qui ne fait pas 32 octets", () => {
    expect(() => sealSecret("x", randomBytes(16))).toThrow(SecretBoxError);
  });
});

describe("clé du coffre", () => {
  const authSecret = "e2e-only-secret-0123456789abcdef0123456789";

  it("dérive une clé stable de 32 octets depuis BETTER_AUTH_SECRET (HKDF)", () => {
    const a = deriveSecretsKey({ authSecret });
    const b = deriveSecretsKey({ authSecret });
    expect(a).toHaveLength(32);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(deriveSecretsKey({ authSecret: `${authSecret}!` }))).toBe(false);
  });

  it("utilise SECRETS_KEY (base64 ou base64url) quand elle est fournie", () => {
    const raw = randomBytes(32);
    expect(deriveSecretsKey({ secretsKey: raw.toString("base64"), authSecret }).equals(raw)).toBe(true);
    expect(deriveSecretsKey({ secretsKey: raw.toString("base64url"), authSecret }).equals(raw)).toBe(true);
    expect(() => deriveSecretsKey({ secretsKey: randomBytes(16).toString("base64"), authSecret })).toThrow(
      SecretBoxError,
    );
  });

  it("un secret chiffré avec la clé dérivée s'ouvre avec la même configuration", () => {
    const sealed = sealSecret("7654321", deriveSecretsKey({ authSecret }));
    expect(openSecret(sealed, deriveSecretsKey({ authSecret }))).toBe("7654321");
  });
});
