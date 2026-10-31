import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("zone protégée", () => {
  it("le gabarit de l'application vérifie la session pour toutes les pages", () => {
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    expect(layout).toContain("<SessionGate />");
    const gate = readFileSync("src/components/auth/session-gate.tsx", "utf8");
    expect(gate).toContain("await requireUser()");
  });

  it("le filtre d'entrée ne laisse publics que la connexion, l'invitation et les ressources techniques", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    const matcher = /"\/\(\(\?!(.+)\)\.\*\)"/.exec(proxy)?.[1] ?? "";
    expect(matcher.split("|").sort()).toEqual(
      [
        "_next/image",
        "_next/static",
        "api",
        "apple-icon.png",
        "brand",
        "connexion",
        "hors-ligne.html",
        "icon.png",
        "icons",
        "invitation",
        "manifest.webmanifest",
        "mot-de-passe-oublie",
        "reinitialiser",
        "robots.txt",
        "sw.js",
      ].sort(),
    );
  });
});
