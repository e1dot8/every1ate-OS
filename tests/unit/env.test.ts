import { describe, expect, it } from "vitest";
import { EnvValidationError, parseServerEnv } from "@/lib/env";

const valid = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:secret-password@db.example.com:5432/app",
};

describe("parseServerEnv", () => {
  it("accepte une configuration complète", () => {
    expect(parseServerEnv(valid).DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it("applique NODE_ENV=development par défaut", () => {
    expect(parseServerEnv({ DATABASE_URL: valid.DATABASE_URL }).NODE_ENV).toBe("development");
  });

  it("rejette une configuration sans DATABASE_URL", () => {
    expect(() => parseServerEnv({ NODE_ENV: "production" })).toThrow(EnvValidationError);
  });

  it("rejette une URL qui n'est pas PostgreSQL", () => {
    expect(() => parseServerEnv({ DATABASE_URL: "mysql://localhost/app" })).toThrow(/DATABASE_URL/);
  });

  it("rejette une APP_URL invalide", () => {
    expect(() => parseServerEnv({ ...valid, APP_URL: "pas-une-url" })).toThrow(/APP_URL/);
  });

  it("ne révèle jamais la valeur d'une variable dans le message d'erreur", () => {
    const secret = "mysql://user:secret-password@host/app";
    try {
      parseServerEnv({ DATABASE_URL: secret });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("secret-password");
    }
  });
});
