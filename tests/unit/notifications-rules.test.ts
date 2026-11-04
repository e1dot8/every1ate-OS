import { describe, expect, it } from "vitest";
import {
  CALLMEBOT_ENDPOINT,
  WHATSAPP_HOURLY_LIMIT,
  appLink,
  buildCallMeBotUrl,
  buildPushMessage,
  buildWhatsappText,
  deliveryStatusLabel,
  deviceLabel,
  isAllowedPushEndpoint,
  isPlausibleApiKey,
  mapLimit,
  maskPhone,
  normalizePhone,
  shortError,
  truncateText,
  whatsappQuota,
} from "@/features/notifications/external-rules";

const now = new Date("2026-11-04T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("limite WhatsApp (heure glissante)", () => {
  it("autorise tant que moins de 20 envois réussis dans l'heure", () => {
    const sent = Array.from({ length: 19 }, (_, i) => minutesAgo(i + 1));
    expect(whatsappQuota(sent, now)).toEqual({ allowed: true, remaining: 1, retryAt: null });
    expect(WHATSAPP_HOURLY_LIMIT).toBe(20);
  });

  it("bloque au 21e et indique quand une place se libère", () => {
    const sent = Array.from({ length: 20 }, (_, i) => minutesAgo(i * 2 + 1)); // de -1 à -39 min
    const quota = whatsappQuota(sent, now);
    expect(quota.allowed).toBe(false);
    expect(quota.remaining).toBe(0);
    // Le plus ancien (-39 min) sort de la fenêtre dans 21 min.
    expect(quota.retryAt?.toISOString()).toBe(new Date(now.getTime() + 21 * 60_000).toISOString());
  });

  it("ignore les envois de plus d'une heure (fenêtre glissante, pas l'heure civile)", () => {
    const sent = [
      ...Array.from({ length: 30 }, (_, i) => minutesAgo(61 + i)),
      ...Array.from({ length: 5 }, (_, i) => minutesAgo(i)),
    ];
    expect(whatsappQuota(sent, now)).toMatchObject({ allowed: true, remaining: 15 });
    expect(whatsappQuota([minutesAgo(60)], now).remaining).toBe(20);
  });

  it("accepte une limite et une fenêtre personnalisées", () => {
    expect(whatsappQuota([minutesAgo(1), minutesAgo(2)], now, 2).allowed).toBe(false);
    expect(whatsappQuota([minutesAgo(1), minutesAgo(2)], now, 2, 60_000).allowed).toBe(true);
  });
});

describe("CallMeBot", () => {
  it("construit l'URL d'envoi avec numéro, texte et clé encodés", () => {
    const url = buildCallMeBotUrl({
      phone: "+33612345678",
      text: "Livré : Clip & co\nhttps://x/y?a=1",
      apikey: "123456",
    });
    expect(url.startsWith(`${CALLMEBOT_ENDPOINT}?`)).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("phone")).toBe("+33612345678");
    expect(params.get("text")).toBe("Livré : Clip & co\nhttps://x/y?a=1");
    expect(params.get("apikey")).toBe("123456");
    // Le « + » du numéro n'est jamais confondu avec une espace.
    expect(url).toContain("phone=%2B33612345678");
    expect(url).not.toMatch(/text=[^&]* [^&]*/);
  });

  it("normalise un numéro international et refuse un numéro national", () => {
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("0033 6.12.34.56.78")).toBe("+33612345678");
    expect(normalizePhone("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizePhone("06 12 34 56 78")).toBeNull();
    expect(normalizePhone("+33")).toBeNull();
    expect(normalizePhone("+0612345678")).toBeNull();
    expect(normalizePhone("+33 6 12 34 56 78 90 12 34")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  it("masque le numéro pour le journal", () => {
    expect(maskPhone("+33612345678")).toBe("+33 ••• 78");
    expect(maskPhone("+33612345678")).not.toContain("612345");
  });

  it("vérifie la forme de la clé API", () => {
    expect(isPlausibleApiKey("123456")).toBe(true);
    expect(isPlausibleApiKey(" 1234567 ")).toBe(true);
    expect(isPlausibleApiKey("12")).toBe(false);
    expect(isPlausibleApiKey("12 34 56")).toBe(false);
    expect(isPlausibleApiKey("<script>")).toBe(false);
  });
});

describe("texte WhatsApp", () => {
  const appUrl = "https://os.example.test";

  it("assemble titre, corps et lien absolu vers l'app", () => {
    expect(
      buildWhatsappText(
        { title: "Livrable livré", body: "Clip v2 · Projet Néons", href: "/livrables/abc" },
        appUrl,
      ),
    ).toBe("Livrable livré\nClip v2 · Projet Néons\nhttps://os.example.test/livrables/abc");
    expect(buildWhatsappText({ title: "Rappel" }, appUrl)).toBe("Rappel");
  });

  it("ne suit que les liens internes", () => {
    expect(appLink(appUrl, "https://ailleurs.example/x")).toBeNull();
    expect(appLink(appUrl, "//ailleurs.example/x")).toBeNull();
    expect(appLink(`${appUrl}/`, "/taches")).toBe(`${appUrl}/taches`);
  });

  it("tronque proprement à 900 caractères en gardant le lien entier", () => {
    const body = "mot ".repeat(400);
    const text = buildWhatsappText({ title: "Titre", body, href: "/projets/p1" }, appUrl);
    expect(Array.from(text).length).toBeLessThanOrEqual(900);
    expect(text.startsWith("Titre\n")).toBe(true);
    expect(text.endsWith("\nhttps://os.example.test/projets/p1")).toBe(true);
    expect(text).toContain("mot…");
  });

  it("raccourcit aussi un titre démesuré et abandonne un corps sans place", () => {
    const text = buildWhatsappText({ title: "T".repeat(2000), body: "corps", href: "/x" }, appUrl, 100);
    expect(Array.from(text).length).toBeLessThanOrEqual(100);
    expect(text.endsWith("\nhttps://os.example.test/x")).toBe(true);
    expect(text).not.toContain("corps");
  });

  it("ne coupe jamais un emoji en deux", () => {
    const cut = truncateText("🎬".repeat(50), 10);
    expect(Array.from(cut)).toHaveLength(10);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("coupe de préférence entre deux mots", () => {
    expect(truncateText("Livrable livré au client final", 20)).toBe("Livrable livré au…");
    expect(truncateText("court", 20)).toBe("court");
  });
});

describe("notifications push", () => {
  it("prépare le message : titre, corps, lien interne et étiquette", () => {
    expect(
      buildPushMessage({
        kind: "livrable.livre",
        title: "  Livré\n: Clip ",
        body: "Projet Néons",
        href: "/livrables/1",
      }),
    ).toEqual({
      title: "Livré : Clip",
      body: "Projet Néons",
      href: "/livrables/1",
      tag: "livrable.livre:/livrables/1",
    });
    expect(buildPushMessage({ kind: "rappel", title: "Rappel", href: "https://ailleurs.example" }).href).toBe(
      "/",
    );
  });

  it("n'accepte que les services push des navigateurs, en HTTPS", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://localhost/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedPushEndpoint("https://user:pw@fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("pas une url")).toBe(false);
  });

  it("nomme l'appareil sans empreinte détaillée", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("iPhone / iPad · Safari");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Android · Chrome");
    expect(deviceLabel(null)).toBe("Appareil");
  });
});

describe("outils", () => {
  it("exécute en parallèle borné et garde l'ordre", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapLimit([5, 1, 4, 2, 3, 0], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, n));
      active--;
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(await mapLimit([], 4, async (n: number) => n)).toEqual([]);
  });

  it("raccourcit les erreurs et retire les URL (qui peuvent contenir une clé)", () => {
    const message = shortError(
      "échec https://api.callmebot.com/whatsapp.php?apikey=123456 " + "x".repeat(300),
    );
    expect(message).not.toContain("123456");
    expect(Array.from(message).length).toBeLessThanOrEqual(160);
  });

  it("affiche des statuts lisibles", () => {
    expect(deliveryStatusLabel("outbox")).toBe("Mode test (rien n'est parti)");
    expect(deliveryStatusLabel("ignore_focus")).toBe("Non envoyé : focus ou absence");
    expect(deliveryStatusLabel("autre")).toBe("autre");
  });
});
