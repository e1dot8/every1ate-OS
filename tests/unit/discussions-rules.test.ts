import { describe, expect, it } from "vitest";
import {
  canAccessChannel,
  canArchiveChannel,
  canPostInChannel,
  channelSlugCandidates,
  channelTitle,
  dayLabel,
  dmSlug,
  firstUnreadIndex,
  formatHourFr,
  groupByDay,
  isHttpsUrl,
  jitsiUrl,
  messageHref,
  nextMondayAt9,
  permalink,
  persoSlug,
  plainExcerpt,
  presenceNotice,
  reminderAt,
  safeHref,
  slugify,
  taskTitleFromMessage,
  tomorrowAt9,
} from "@/features/discussions/rules";

// Mercredi 4 novembre 2026, 14 h 30 à Paris (heure d'hiver : UTC+1).
const NOW = new Date("2026-11-04T13:30:00Z");

describe("identifiants de salon", () => {
  it("slug lisible, sans accents ni ponctuation", () => {
    expect(slugify("Campagne Été 2027 !")).toBe("campagne-ete-2027");
    expect(slugify("  Œuvre & co  ")).toBe("oeuvre-co");
    expect(slugify("!!!")).toBe("salon");
    expect(slugify("a".repeat(80))).toHaveLength(48);
  });

  it("candidats : nom, puis suffixes ; segments réservés évités", () => {
    expect(channelSlugCandidates("Lookbook", "clx9AbCdEf12")).toEqual([
      "lookbook",
      "lookbook-cdef12",
      "lookbook-clx9abcdef12",
    ]);
    expect(channelSlugCandidates("Recherche", "x1")[0]).toBe("salon-recherche");
    expect(channelSlugCandidates("Général", "x1")[0]).toBe("salon-general");
    expect(channelSlugCandidates("DM Johan", "x1")[0]).toBe("salon-dm-johan");
  });

  it("message direct : même salon quel que soit l'ordre", () => {
    expect(dmSlug("bbb", "aaa")).toBe("dm-aaa-bbb");
    expect(dmSlug("aaa", "bbb")).toBe(dmSlug("bbb", "aaa"));
    expect(dmSlug("Zed", "abc")).toBe("dm-Zed-abc");
    expect(persoSlug("u1")).toBe("perso-u1");
  });
});

describe("accès aux salons", () => {
  it("public : tous ; privé, direct, perso : membres seulement", () => {
    expect(canAccessChannel({ kind: "PUBLIC" }, false)).toBe(true);
    for (const kind of ["PRIVE", "DIRECT", "PERSO"] as const) {
      expect(canAccessChannel({ kind }, false)).toBe(false);
      expect(canAccessChannel({ kind }, true)).toBe(true);
    }
  });

  it("un salon archivé se lit mais ne reçoit plus de message", () => {
    expect(canPostInChannel({ kind: "PUBLIC", archivedAt: null }, false)).toBe(true);
    expect(canPostInChannel({ kind: "PUBLIC", archivedAt: NOW }, true)).toBe(false);
    expect(canPostInChannel({ kind: "PRIVE", archivedAt: null }, false)).toBe(false);
  });

  it("ni les salons par défaut, ni les messages directs ne s'archivent", () => {
    expect(canArchiveChannel({ kind: "PUBLIC", slug: "general" })).toBe(false);
    expect(canArchiveChannel({ kind: "PUBLIC", slug: "clients" })).toBe(false);
    expect(canArchiveChannel({ kind: "DIRECT", slug: "dm-a-b" })).toBe(false);
    expect(canArchiveChannel({ kind: "PERSO", slug: "perso-a" })).toBe(false);
    expect(canArchiveChannel({ kind: "PUBLIC", slug: "lookbook" })).toBe(true);
    expect(canArchiveChannel({ kind: "PRIVE", slug: "direction" })).toBe(true);
  });
});

describe("dates de rappel (heure de Paris)", () => {
  it("dans 20 min, 1 h, 3 h", () => {
    expect(reminderAt("20m", NOW).toISOString()).toBe("2026-11-04T13:50:00.000Z");
    expect(reminderAt("1h", NOW).toISOString()).toBe("2026-11-04T14:30:00.000Z");
    expect(reminderAt("3h", NOW).toISOString()).toBe("2026-11-04T16:30:00.000Z");
  });

  it("demain 9 h à Paris, été comme hiver", () => {
    expect(reminderAt("demain", NOW).toISOString()).toBe("2026-11-05T08:00:00.000Z");
    expect(tomorrowAt9(new Date("2026-07-01T20:00:00Z")).toISOString()).toBe("2026-07-02T07:00:00.000Z");
    // 23 h 30 à Paris le 4 : « demain » est le 5 ; 0 h 30 le 5 : « demain » est le 6.
    expect(tomorrowAt9(new Date("2026-11-04T22:30:00Z")).toISOString()).toBe("2026-11-05T08:00:00.000Z");
    expect(tomorrowAt9(new Date("2026-11-04T23:30:00Z")).toISOString()).toBe("2026-11-06T08:00:00.000Z");
  });

  it("lundi prochain 9 h", () => {
    expect(nextMondayAt9(NOW).toISOString()).toBe("2026-11-09T08:00:00.000Z");
    // Un lundi : le lundi suivant.
    expect(nextMondayAt9(new Date("2026-11-09T10:00:00Z")).toISOString()).toBe("2026-11-16T08:00:00.000Z");
  });

  it("heures à la française", () => {
    expect(formatHourFr(new Date("2026-11-04T14:00:00Z"))).toBe("15 h");
    expect(formatHourFr(new Date("2026-11-04T14:30:00Z"))).toBe("15 h 30");
    expect(formatHourFr(new Date("2026-07-04T07:05:00Z"))).toBe("9 h 05");
  });
});

describe("jours et regroupement", () => {
  it("Aujourd'hui, Hier, puis le jour", () => {
    expect(dayLabel("2026-11-04", NOW)).toBe("Aujourd'hui");
    expect(dayLabel("2026-11-03", NOW)).toBe("Hier");
    expect(dayLabel("2026-11-02", NOW)).toBe("Lundi 2 nov.");
    expect(dayLabel("2025-11-02", NOW)).toBe("Dimanche 2 nov. 2025");
  });

  it("regroupe par jour de Paris ; même auteur à moins de 5 min = compact", () => {
    const at = (iso: string, authorId: string | null) => ({ createdAt: new Date(iso), authorId });
    const groups = groupByDay(
      [
        at("2026-11-03T22:50:00Z", "a"), // 23 h 50 le 3 à Paris
        at("2026-11-03T23:10:00Z", "a"), // 0 h 10 le 4 à Paris : nouveau jour
        at("2026-11-04T08:00:00Z", "a"),
        at("2026-11-04T08:02:00Z", "a"),
        at("2026-11-04T08:03:00Z", null),
        at("2026-11-04T08:04:00Z", null),
        at("2026-11-04T08:20:00Z", "a"),
      ],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual(["Hier", "Aujourd'hui"]);
    expect(groups[1].items.map((i) => i.compact)).toEqual([false, false, true, false, false, false]);
  });

  it("premier non lu : après la dernière lecture et pas de moi", () => {
    const msgs = [
      { createdAt: new Date("2026-11-04T10:00:00Z"), authorId: "b" },
      { createdAt: new Date("2026-11-04T11:00:00Z"), authorId: "me" },
      { createdAt: new Date("2026-11-04T12:00:00Z"), authorId: "b" },
    ];
    expect(firstUnreadIndex(msgs, new Date("2026-11-04T10:30:00Z"), "me")).toBe(2);
    expect(firstUnreadIndex(msgs, new Date("2026-11-04T09:00:00Z"), "me")).toBe(0);
    expect(firstUnreadIndex(msgs, null, "me")).toBe(-1);
  });
});

describe("textes dérivés", () => {
  it("extrait brut : mise en forme retirée, coupé sur un mot", () => {
    expect(plainExcerpt("**Urgent** : voir _vite_ `npm`\n@Pierre")).toBe("Urgent : voir vite npm @Pierre");
    const long = plainExcerpt("mot ".repeat(60), 40);
    expect(long.endsWith("…")).toBe(true);
    expect(Array.from(long).length).toBeLessThanOrEqual(40);
  });

  it("titre de tâche : début du message", () => {
    expect(taskTitleFromMessage("Monter la **bande-annonce** pour vendredi")).toBe(
      "Monter la bande-annonce pour vendredi",
    );
    expect(taskTitleFromMessage("   ")).toBe("Tâche issue d'un message");
  });

  it("encadré de présence : jamais d'heure de connexion", () => {
    expect(
      presenceNotice("Pierre Martin", { state: "FOCUS", until: new Date("2026-11-04T14:00:00Z") }, NOW),
    ).toBe("Pierre est en focus jusqu'à 15 h : il sera prévenu à la fin.");
    expect(presenceNotice("Pierre", { state: "FOCUS", until: null }, NOW)).toBe(
      "Pierre est en focus : il sera prévenu à la fin.",
    );
    expect(presenceNotice("Pierre", { state: "FOCUS", until: new Date("2026-11-05T08:00:00Z") }, NOW)).toBe(
      "Pierre est en focus jusqu'à demain à 9 h : il sera prévenu à la fin.",
    );
    expect(presenceNotice("Pierre", { state: "DISPO", until: null }, NOW)).toBeNull();
  });

  it("lien visio Jitsi et liens https", () => {
    expect(jitsiUrl("Lookbook-Hiver", "AB12cd")).toBe("https://meet.jit.si/every1ate-lookbook-hiver-ab12cd");
    expect(isHttpsUrl("https://meet.jit.si/salle")).toBe(true);
    expect(isHttpsUrl("http://exemple.fr")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("https://user:pass@exemple.fr")).toBe(false);
    expect(isHttpsUrl("https://exemple.fr/a b")).toBe(false);
  });
});

describe("titres et liens", () => {
  it("nom affiché selon le type de salon", () => {
    expect(channelTitle({ kind: "PERSO", name: "Notes perso" })).toBe("Moi (notes perso)");
    expect(channelTitle({ kind: "DIRECT", name: "Message direct", partnerName: "Pierre" })).toBe("Pierre");
    expect(channelTitle({ kind: "DIRECT", name: "Message direct" })).toBe("Message direct");
    expect(channelTitle({ kind: "PUBLIC", name: "Ancien nom", projectName: "Clip renommé" })).toBe(
      "Clip renommé",
    );
    expect(channelTitle({ kind: "PRIVE", name: "Direction" })).toBe("Direction");
  });

  it("liens vers un message : salon, fil, lien permanent", () => {
    expect(messageHref("general", { id: "m1", parentId: null })).toBe("/discussions/general#m-m1");
    expect(messageHref("general", { id: "m2", parentId: "m1" })).toBe("/discussions/general/fil/m1#m-m2");
    expect(permalink("general", { id: "m1", parentId: null })).toBe("/discussions/general/fil/m1#m-m1");
  });

  it("lien d'un message du QG : interne ou https seulement", () => {
    expect(safeHref("/taches/abc")).toBe("/taches/abc");
    expect(safeHref("https://exemple.fr/x")).toBe("https://exemple.fr/x");
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("/\\evil.example")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref(undefined)).toBeNull();
  });
});
