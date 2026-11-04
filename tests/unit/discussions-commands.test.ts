import { describe, expect, it } from "vitest";
import { helpLines, isCommand, parseCommand, parseDelay, parseDueToken } from "@/features/discussions/rules";

// Mercredi 4 novembre 2026, 14 h 30 à Paris.
const NOW = new Date("2026-11-04T13:30:00Z");
const TODAY = new Date("2026-11-04T00:00:00Z");
const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("échéances de /tache", () => {
  it("mots relatifs", () => {
    expect(day(parseDueToken("aujourd'hui", TODAY))).toBe("2026-11-04");
    expect(day(parseDueToken("aujourd’hui", TODAY))).toBe("2026-11-04");
    expect(day(parseDueToken("demain", TODAY))).toBe("2026-11-05");
    expect(day(parseDueToken("Après-demain", TODAY))).toBe("2026-11-06");
  });

  it("jour de la semaine : le prochain, jamais aujourd'hui", () => {
    expect(day(parseDueToken("lundi", TODAY))).toBe("2026-11-09");
    expect(day(parseDueToken("vendredi", TODAY))).toBe("2026-11-06");
    expect(day(parseDueToken("mercredi", TODAY))).toBe("2026-11-11");
  });

  it("jj/mm : cette année, ou l'an prochain si la date est passée", () => {
    expect(day(parseDueToken("12/11", TODAY))).toBe("2026-11-12");
    expect(day(parseDueToken("3/1", TODAY))).toBe("2027-01-03");
    expect(day(parseDueToken("15/02/2027", TODAY))).toBe("2027-02-15");
    expect(day(parseDueToken("15/02/27", TODAY))).toBe("2027-02-15");
    expect(parseDueToken("31/02", TODAY)).toBeNull();
    expect(parseDueToken("bientôt", TODAY)).toBeNull();
  });
});

describe("délais de /rappel", () => {
  it("minutes, heures, heure du jour, demain", () => {
    expect(parseDelay("20m", NOW)?.toISOString()).toBe("2026-11-04T13:50:00.000Z");
    expect(parseDelay("45min", NOW)?.toISOString()).toBe("2026-11-04T14:15:00.000Z");
    expect(parseDelay("1h", NOW)?.toISOString()).toBe("2026-11-04T14:30:00.000Z");
    expect(parseDelay("16h30", NOW)?.toISOString()).toBe("2026-11-04T15:30:00.000Z");
    // 9 h est passé : demain 9 h.
    expect(parseDelay("9h00", NOW)?.toISOString()).toBe("2026-11-05T08:00:00.000Z");
    expect(parseDelay("demain", NOW)?.toISOString()).toBe("2026-11-05T08:00:00.000Z");
  });

  it("refuse l'illisible et au-delà d'une semaine", () => {
    expect(parseDelay("bientôt", NOW)).toBeNull();
    expect(parseDelay("0m", NOW)).toBeNull();
    expect(parseDelay("200h", NOW)).toBeNull();
    expect(parseDelay("25h00", NOW)).toBeNull();
  });
});

describe("analyse des commandes", () => {
  it("un texte ordinaire n'est pas une commande", () => {
    expect(parseCommand("Bonjour", NOW)).toBeNull();
    expect(parseCommand("/ espace", NOW)).toBeNull();
    expect(isCommand("  /aide")).toBe(true);
    expect(isCommand("https://exemple.fr")).toBe(false);
  });

  it("/aide liste toutes les commandes", () => {
    expect(parseCommand("/aide", NOW)).toEqual({ ok: true, command: "aide" });
    expect(helpLines().map((l) => l.text.split(" ")[0])).toEqual([
      "/aide",
      "/tache",
      "/relance",
      "/focus",
      "/dispo",
      "/standup",
      "/rappel",
      "/huddle",
    ]);
  });

  it("/tache : titre, responsable et échéance", () => {
    const parsed = parseCommand("/tache Préparer le moodboard @Pierre demain", NOW);
    expect(parsed).toMatchObject({
      ok: true,
      command: "tache",
      title: "Préparer le moodboard",
      owner: "Pierre",
    });
    expect(parsed?.ok && parsed.command === "tache" && day(parsed.due)).toBe("2026-11-05");

    expect(parseCommand("/tâche @Zoé, Appeler Brume 12/11", NOW)).toMatchObject({
      title: "Appeler Brume",
      owner: "Zoé",
    });
    expect(parseCommand("/TACHE Relire le devis", NOW)).toMatchObject({
      title: "Relire le devis",
      owner: null,
      due: null,
    });
    // Un seul mot : c'est le titre, pas une échéance.
    expect(parseCommand("/tache demain", NOW)).toMatchObject({ title: "demain", due: null });
    expect(parseCommand("/tache", NOW)).toMatchObject({ ok: false });
    expect(parseCommand("/tache @Pierre", NOW)).toMatchObject({ ok: false });
  });

  it("/focus : 50 min par défaut, de 5 à 480", () => {
    expect(parseCommand("/focus", NOW)).toEqual({ ok: true, command: "focus", minutes: 50 });
    expect(parseCommand("/focus 90", NOW)).toEqual({ ok: true, command: "focus", minutes: 90 });
    expect(parseCommand("/focus 25min", NOW)).toEqual({ ok: true, command: "focus", minutes: 25 });
    expect(parseCommand("/focus 2", NOW)).toMatchObject({ ok: false });
    expect(parseCommand("/focus beaucoup", NOW)).toMatchObject({ ok: false });
  });

  it("/dispo, /huddle, /relance", () => {
    expect(parseCommand("/dispo", NOW)).toEqual({ ok: true, command: "dispo" });
    expect(parseCommand("/huddle", NOW)).toEqual({ ok: true, command: "huddle" });
    expect(parseCommand("/relance", NOW)).toEqual({ ok: true, command: "relance", filter: null });
    expect(parseCommand("/relance Brume", NOW)).toEqual({ ok: true, command: "relance", filter: "Brume" });
  });

  it("/standup : aujourd'hui | bloqué", () => {
    expect(parseCommand("/standup Montage du clip | Attente des rushs", NOW)).toEqual({
      ok: true,
      command: "standup",
      today: "Montage du clip",
      blocked: "Attente des rushs",
    });
    expect(parseCommand("/standup Montage du clip", NOW)).toMatchObject({
      today: "Montage du clip",
      blocked: null,
    });
    expect(parseCommand("/standup | Rien ne marche", NOW)).toMatchObject({
      today: null,
      blocked: "Rien ne marche",
    });
    expect(parseCommand("/standup", NOW)).toMatchObject({ ok: false });
  });

  it("/rappel : délai puis texte", () => {
    const parsed = parseCommand("/rappel 1h Rappeler le client", NOW);
    expect(parsed).toMatchObject({ ok: true, command: "rappel", text: "Rappeler le client" });
    expect(parsed?.ok && parsed.command === "rappel" && parsed.remindAt.toISOString()).toBe(
      "2026-11-04T14:30:00.000Z",
    );
    expect(parseCommand("/rappel demain", NOW)).toMatchObject({ ok: false });
    expect(parseCommand("/rappel bientôt Texte", NOW)).toMatchObject({ ok: false });
  });

  it("commande inconnue : message explicite", () => {
    expect(parseCommand("/danse", NOW)).toEqual({
      ok: false,
      error: "Commande inconnue : /danse. Tape /aide pour la liste.",
    });
  });
});
