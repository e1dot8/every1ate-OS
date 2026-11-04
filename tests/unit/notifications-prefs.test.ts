import { describe, expect, it } from "vitest";
import { EVENT_KINDS } from "@/features/events/kinds";
import {
  PUSH_OFF_BY_DEFAULT,
  WHATSAPP_RECOMMENDED,
  changedPrefs,
  defaultPrefs,
  parsePrefs,
  prefField,
  prefsFromForm,
  recommendedPrefs,
  wants,
} from "@/features/notifications/prefs";

describe("préférences d'alertes", () => {
  it("par défaut : push pour tout sauf les points cochés et les tâches terminées, WhatsApp nulle part", () => {
    const prefs = defaultPrefs();
    expect(Object.keys(prefs).sort()).toEqual([...EVENT_KINDS].sort());
    expect(prefs["livrable.coche"].push).toBe(false);
    expect(prefs["tache.terminee"].push).toBe(false);
    expect(prefs["livrable.livre"].push).toBe(true);
    expect(prefs.mention.push).toBe(true);
    expect(EVENT_KINDS.every((kind) => !prefs[kind].whatsapp)).toBe(true);
    expect(PUSH_OFF_BY_DEFAULT).toEqual(["livrable.coche", "tache.terminee"]);
  });

  it("réglages recommandés : WhatsApp pour livré, bloqué, passation, mention et message direct", () => {
    const prefs = recommendedPrefs();
    const whatsappOn = EVENT_KINDS.filter((kind) => prefs[kind].whatsapp);
    expect(whatsappOn.sort()).toEqual([...WHATSAPP_RECOMMENDED].sort());
    expect(whatsappOn).toEqual(
      expect.arrayContaining(["livrable.livre", "livrable.bloque", "passation.demandee", "mention", "message.direct"]),
    );
    expect(prefs["livrable.coche"].push).toBe(false);
  });

  it("lit le JSON stocké avec tolérance (absent, invalide, partiel, types inconnus)", () => {
    expect(parsePrefs(null)).toEqual(defaultPrefs());
    expect(parsePrefs("n'importe quoi")).toEqual(defaultPrefs());
    expect(parsePrefs([1, 2])).toEqual(defaultPrefs());
    const prefs = parsePrefs({
      mention: { whatsapp: true },
      "livrable.coche": { push: true, whatsapp: "oui" },
      rappel: "invalide",
      "type.inconnu": { push: true },
    });
    expect(prefs.mention).toEqual({ push: true, whatsapp: true });
    expect(prefs["livrable.coche"]).toEqual({ push: true, whatsapp: false });
    expect(prefs.rappel).toEqual(defaultPrefs().rappel);
    expect(prefs).not.toHaveProperty("type.inconnu");
  });

  it("relit à l'identique ce qui a été enregistré", () => {
    const saved = JSON.parse(JSON.stringify(recommendedPrefs()));
    expect(parsePrefs(saved)).toEqual(recommendedPrefs());
  });

  it("formulaire : une case absente vaut « non »", () => {
    const form = new Set([prefField("push", "mention"), prefField("whatsapp", "livrable.bloque")]);
    const prefs = prefsFromForm((field) => form.has(field));
    expect(prefs.mention).toEqual({ push: true, whatsapp: false });
    expect(prefs["livrable.bloque"]).toEqual({ push: false, whatsapp: true });
    expect(prefs.rappel).toEqual({ push: false, whatsapp: false });
    expect(wants(prefs, "mention", "push")).toBe(true);
    expect(wants(prefs, "mention", "whatsapp")).toBe(false);
  });

  it("liste les cases modifiées pour le journal", () => {
    expect(changedPrefs(defaultPrefs(), defaultPrefs())).toEqual([]);
    expect(changedPrefs(defaultPrefs(), recommendedPrefs()).sort()).toEqual(
      WHATSAPP_RECOMMENDED.map((kind) => `${kind}.whatsapp`).sort(),
    );
  });
});
