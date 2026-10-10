import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { checkNewPassword, isPasswordBreached } from "@/lib/auth/password-policy";

const sha1 = (value: string) => createHash("sha1").update(value).digest("hex").toUpperCase();

function fakeRangeApi(lines: string[]) {
  return vi.fn<(input: string | URL | Request) => Promise<Response>>(
    async () => new Response(lines.join("\r\n"), { status: 200 }),
  );
}

describe("isPasswordBreached (k-anonymat)", () => {
  it("n'envoie que les 5 premiers caractères de l'empreinte", async () => {
    const fetchMock = fakeRangeApi([]);
    await isPasswordBreached("Recette-Cuisson-2026!", fetchMock as unknown as typeof fetch);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1("Recette-Cuisson-2026!").slice(0, 5)}`);
    expect(url).not.toContain(sha1("Recette-Cuisson-2026!").slice(5));
  });

  it("détecte un mot de passe présent dans la liste", async () => {
    const hash = sha1("motdepasse123");
    const fetchMock = fakeRangeApi([`${hash.slice(5)}:42`, "0000000000000000000000000000000000A:1"]);
    expect(await isPasswordBreached("motdepasse123", fetchMock as unknown as typeof fetch)).toBe(true);
  });

  it("ignore les lignes de remplissage (compte à 0)", async () => {
    const hash = sha1("motdepasse123");
    const fetchMock = fakeRangeApi([`${hash.slice(5)}:0`]);
    expect(await isPasswordBreached("motdepasse123", fetchMock as unknown as typeof fetch)).toBe(false);
  });

  it("laisse passer si le service est indisponible (échec ouvert)", async () => {
    const failing = vi.fn(async () => {
      throw new Error("réseau coupé");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await isPasswordBreached("Recette-Cuisson-2026!", failing as unknown as typeof fetch)).toBe(false);
  });
});

describe("checkNewPassword", () => {
  it("refuse moins de 12 caractères", async () => {
    expect(await checkNewPassword("court", { breachCheck: null })).toBe("too_short");
  });

  it("refuse plus de 128 caractères", async () => {
    expect(await checkNewPassword("a".repeat(129), { breachCheck: null })).toBe("too_long");
  });

  it("refuse un mot de passe compromis", async () => {
    expect(await checkNewPassword("assez-long-mais-connu", { breachCheck: async () => true })).toBe(
      "breached",
    );
  });

  it("accepte un mot de passe robuste", async () => {
    expect(await checkNewPassword("Recette-Cuisson-2026!", { breachCheck: async () => false })).toBeNull();
  });
});
