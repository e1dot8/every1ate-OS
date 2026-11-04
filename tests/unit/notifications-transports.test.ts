import { describe, expect, it, vi } from "vitest";
import { sendCallMeBot } from "@/features/notifications/transports";

const input = { phone: "+33612345678", apikey: "987654", text: "Livrable livré" };

const respond = (status: number, body: string) =>
  vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

describe("transport CallMeBot", () => {
  it("appelle l'API avec un délai maximal et considère « Message queued » comme un succès", async () => {
    const fetcher = respond(200, "Message queued. You will receive it in a few seconds.");
    expect(await sendCallMeBot(input, fetcher)).toEqual({ ok: true });
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain("apikey=987654");
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it("signale un refus HTTP sans jamais citer la clé ni l'URL", async () => {
    const result = await sendCallMeBot(input, respond(500, "boom apikey=987654"));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("987654");
    expect(JSON.stringify(result)).not.toContain("callmebot.com");
  });

  it("détecte une page d'erreur renvoyée avec un statut 200", async () => {
    const result = await sendCallMeBot(input, respond(200, "APIKey is invalid. Please check your apikey 987654"));
    expect(result).toEqual({ ok: false, error: "CallMeBot : clé API ou numéro refusés." });
  });

  it("ne lève jamais : délai dépassé ou réseau coupé deviennent des échecs", async () => {
    const timeout = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as unknown as typeof fetch;
    expect(await sendCallMeBot(input, timeout)).toEqual({ ok: false, error: "CallMeBot : délai dépassé (8 s)." });
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed https://api.callmebot.com/whatsapp.php?apikey=987654");
    }) as unknown as typeof fetch;
    const result = await sendCallMeBot(input, offline);
    expect(result).toEqual({ ok: false, error: "CallMeBot injoignable." });
  });
});
