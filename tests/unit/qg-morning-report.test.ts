import { describe, expect, it } from "vitest";
import {
  TEXT_MAX,
  buildMorningReport,
  parseReportData,
  renderReportText,
  reportWindow,
  summarizeStageMoves,
  summaryLine,
  type MorningFacts,
  type MorningReportData,
} from "@/features/qg/morning/rules";
import { parseDateInput } from "@/lib/dates";

const d = (s: string) => parseDateInput(s)!;
const PEOPLE = ["Johan", "Charles", "Pierre"];

/** Mardi 3 novembre 2026, 9 h à Paris. */
const tuesday = reportWindow(new Date("2026-11-03T08:00:00Z"));

function facts(over: Partial<MorningFacts> = {}): MorningFacts {
  return {
    window: tuesday,
    doneTasks: [{ id: "t1", title: "Tourner le teaser", project: "Maison Lune" }],
    stageMoves: [{ id: "d1", title: "Teaser 30 s", project: "Maison Lune", from: "CREATION", to: "MONTAGE" }],
    delivered: [{ id: "d2", title: "Affiche", project: "Café Nord" }],
    won: [{ id: "o1", title: "Identité visuelle", client: "Atelier Sel" }],
    newProjects: [{ id: "p9", name: "Atelier Sel — identité", client: "Atelier Sel" }],
    openTasks: [
      {
        id: "t10",
        title: "Valider le script",
        status: "EN_COURS",
        dueDate: d("2026-11-03"),
        blockedReason: null,
        owner: "Johan",
        project: "Maison Lune",
      },
      {
        id: "t11",
        title: "Envoyer le devis",
        status: "A_FAIRE",
        dueDate: d("2026-10-30"),
        blockedReason: null,
        owner: "Charles",
        project: "Café Nord",
      },
      {
        id: "t12",
        title: "Récupérer les rushes",
        status: "BLOQUE",
        dueDate: d("2026-11-03"),
        blockedReason: "Disque dur chez le client",
        owner: "Pierre",
        project: "Maison Lune",
      },
    ],
    deliverables: [
      {
        id: "d3",
        title: "Reel lancement",
        stage: "MONTAGE",
        dueDate: d("2026-11-03"),
        publishDate: null,
        blockedReason: null,
        channel: "Instagram",
        owner: "Pierre",
        project: "Maison Lune",
      },
      {
        id: "d4",
        title: "Carrousel recettes",
        stage: "CREATION",
        dueDate: d("2026-11-01"),
        publishDate: null,
        blockedReason: null,
        channel: null,
        owner: "Johan",
        project: "Café Nord",
      },
      {
        id: "d5",
        title: "Vidéo portrait",
        stage: "PRODUCTION",
        dueDate: d("2026-11-05"),
        publishDate: null,
        blockedReason: "Attente des validations client",
        channel: null,
        owner: "Charles",
        project: "Maison Lune",
      },
      {
        id: "d6",
        title: "Post annonce",
        stage: "LIVRE",
        dueDate: d("2026-11-02"),
        publishDate: d("2026-11-03"),
        blockedReason: null,
        channel: "LinkedIn",
        owner: "Johan",
        project: "Café Nord",
      },
      {
        id: "d7",
        title: "Bannière site",
        stage: "LIVRAISON",
        dueDate: d("2026-11-06"),
        publishDate: null,
        blockedReason: null,
        channel: null,
        owner: "Pierre",
        project: "Café Nord",
      },
      {
        id: "d8",
        title: "Story coulisses",
        stage: "PREPARATION",
        dueDate: d("2026-11-09"),
        publishDate: null,
        blockedReason: null,
        channel: null,
        owner: "Pierre",
        project: "Café Nord",
      },
    ],
    meetings: [
      {
        id: "e1",
        title: "Point client Maison Lune",
        startsAt: new Date("2026-11-03T09:30:00Z"),
        allDay: false,
        project: "Maison Lune",
      },
    ],
    followUps: [
      {
        id: "o2",
        title: "Refonte site Café Nord",
        nextAction: "Rappeler pour le devis",
        nextActionDate: d("2026-10-31"),
      },
      { id: "o3", title: "Studio Bleu", nextAction: null, nextActionDate: d("2026-11-03") },
    ],
    handoffs: [
      {
        id: "h1",
        createdAt: new Date("2026-11-02T10:00:00Z"),
        task: { id: "t20", title: "Monter la v2", project: "Maison Lune" },
        opportunity: null,
      },
    ],
    projects: [
      {
        id: "p2",
        name: "Café Nord",
        client: null,
        status: "BLOQUE",
        statusReason: "Attente du contrat",
        tasksDone: 0,
        tasksTotal: 0,
        deliverablesInProgress: 2,
        nextDue: null,
      },
      {
        id: "p1",
        name: "Maison Lune",
        client: "Maison Lune SAS",
        status: "ACTIF",
        statusReason: null,
        tasksDone: 9,
        tasksTotal: 20,
        deliverablesInProgress: 3,
        nextDue: d("2026-11-03"),
      },
    ],
    ...over,
  };
}

const section = (r: MorningReportData, key: string) => r.sections.find((s) => s.key === key)!;
const listOf = (r: MorningReportData, key: string) =>
  r.sections.flatMap((s) => s.lists).find((l) => l.key === key);
const ids = (r: MorningReportData, key: string) => listOf(r, key)?.items.map((i) => i.id) ?? [];

describe("assemblage du point", () => {
  const report = buildMorningReport(facts());

  it("chiffres et résumé court", () => {
    expect(report.counts).toEqual({ done: 1, delivered: 1, today: 2, late: 2, blocked: 2 });
    expect(report.summary).toBe("1 terminée hier · 1 livré · 2 pour aujourd'hui · 2 en retard · 2 bloqués");
    expect(report.title).toBe("Le point du mardi 3 novembre");
    expect(report.date).toBe("2026-11-03");
  });

  it("hier : terminé, avancé, livré, signé, nouveau projet", () => {
    expect(section(report, "hier").title).toBe("Hier");
    expect(section(report, "hier").lists.map((l) => l.key)).toEqual([
      "taches-terminees",
      "livrables-avances",
      "livrables-livres",
      "opportunites-signees",
      "nouveaux-projets",
    ]);
    expect(listOf(report, "livrables-avances")!.items[0].detail).toBe("Création → Montage");
    expect(listOf(report, "opportunites-signees")!.items[0]).toMatchObject({
      href: "/crm/opportunites/o1",
      context: "Atelier Sel",
    });
  });

  it("chaque objet à un seul endroit : bloqué > en retard > aujourd'hui > semaine", () => {
    expect(ids(report, "bloques")).toEqual(["t12", "d5"]);
    expect(ids(report, "taches-en-retard")).toEqual(["t11"]);
    expect(ids(report, "livrables-en-retard")).toEqual(["d4"]);
    expect(ids(report, "taches-du-jour")).toEqual(["t10"]);
    expect(ids(report, "livrables-du-jour")).toEqual(["d3"]);
    // Jusqu'à dimanche seulement, jamais un livrable bloqué.
    expect(ids(report, "livrables-semaine")).toEqual(["d7"]);
    expect(ids(report, "publications")).toEqual(["d6"]);
    // Seules les relances dépassées sont « en retard ».
    expect(ids(report, "relances")).toEqual(["o2"]);
    expect(ids(report, "passations")).toEqual(["h1"]);
  });

  it("un retard ou un blocage porte sur l'objet, avec son motif", () => {
    const blocked = listOf(report, "bloques")!.items;
    expect(blocked[0]).toMatchObject({
      title: "Récupérer les rushes",
      detail: "Motif : Disque dur chez le client",
    });
    expect(blocked[1]).toMatchObject({
      title: "Vidéo portrait",
      detail: "Motif : Attente des validations client",
    });
    expect(listOf(report, "taches-en-retard")!.items[0].detail).toBe("Prévue le 30 oct.");
    expect(listOf(report, "relances")!.items[0].detail).toBe("Rappeler pour le devis · prévue le 31 oct.");
    const noReason = buildMorningReport(
      facts({ openTasks: [{ ...facts().openTasks[2], blockedReason: null }], deliverables: [] }),
    );
    expect(listOf(noReason, "bloques")!.items[0].detail).toBe("Motif non précisé");
  });

  it("aujourd'hui : responsable de l'élément, heure de Paris des réunions", () => {
    expect(listOf(report, "taches-du-jour")!.items[0].owner).toBe("Johan");
    expect(listOf(report, "reunions")!.items[0]).toMatchObject({ detail: "10:30", href: "/calendrier/e1" });
    expect(listOf(report, "publications")!.items[0]).toMatchObject({
      context: "Café Nord · LinkedIn",
      detail: "Livré, prêt à publier",
    });
  });

  it("projets actifs : avancement en %, livrables en cours, prochaine échéance, statut et motif", () => {
    expect(report.projects.items.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(report.projects.items[0]).toMatchObject({ percent: 45, nextDue: "2026-11-03", status: undefined });
    expect(report.projects.items[1]).toMatchObject({
      percent: 0,
      status: "Bloqué",
      reason: "Attente du contrat",
    });
  });

  it("le lundi : « depuis vendredi »", () => {
    const monday = buildMorningReport(
      facts({ window: reportWindow(new Date("2026-11-02T07:30:00Z")), doneTasks: [] }),
    );
    expect(section(monday, "hier").title).toBe("Depuis vendredi");
    expect(summaryLine({ done: 3, delivered: 0, today: 5, late: 2, blocked: 1 }, "depuis vendredi")).toBe(
      "3 terminées depuis vendredi · 5 pour aujourd'hui · 2 en retard · 1 bloqué",
    );
  });

  it("rubriques vides : texte de remplacement, rien en retard", () => {
    const calm = buildMorningReport({
      ...facts(),
      doneTasks: [],
      stageMoves: [],
      delivered: [],
      won: [],
      newProjects: [],
      openTasks: [],
      deliverables: [],
      meetings: [],
      followUps: [],
      handoffs: [],
      projects: [],
    });
    expect(calm.summary).toBe("Rien à rendre aujourd'hui · rien en retard");
    expect(calm.sections.every((s) => s.lists.length === 0)).toBe(true);
    const text = renderReportText(calm);
    expect(text).toContain("Rien de terminé.");
    expect(text).toContain("Rien en retard, rien de bloqué.");
    expect(text).toContain("Aucun projet actif.");
  });
});

describe("passages d'étape d'après le journal", () => {
  it("garde l'avancée globale, ignore les retours et la livraison", () => {
    const moves = summarizeStageMoves([
      { targetId: "d1", before: { stage: "CREATION" }, after: { stage: "PRODUCTION" } },
      { targetId: "d1", before: { stage: "PRODUCTION" }, after: { stage: "MONTAGE", auto: true } },
      { targetId: "d2", before: { stage: "MONTAGE" }, after: { stage: "CREATION" } },
      { targetId: "d3", before: { stage: "LIVRAISON" }, after: { stage: "LIVRE" } },
      { targetId: "d4", before: { stage: "CREATION" }, after: { stage: "PRODUCTION" } },
      { targetId: "d4", before: { stage: "PRODUCTION" }, after: { stage: "CREATION" } },
      { targetId: null, before: { stage: "CREATION" }, after: { stage: "PRODUCTION" } },
      { targetId: "d5", before: "?", after: { stage: "INCONNU" } },
    ]);
    expect(moves).toEqual([
      { id: "d1", from: "CREATION", to: "MONTAGE" },
      { id: "d4", from: "CREATION", to: "PRODUCTION" },
    ]);
  });

  it("un livrable livré dans la fenêtre n'est pas aussi compté comme « avancé »", () => {
    const r = buildMorningReport(
      facts({
        stageMoves: [{ id: "d2", title: "Affiche", project: "Café Nord", from: "CREATION", to: "MONTAGE" }],
      }),
    );
    expect(listOf(r, "livrables-avances")).toBeUndefined();
    expect(ids(r, "livrables-livres")).toEqual(["d2"]);
  });
});

describe("texte publié dans la Salle commune", () => {
  it("Markdown léger : titre en gras, rubriques, puces", () => {
    const text = renderReportText(buildMorningReport(facts()));
    const lines = text.split("\n");
    expect(lines[0]).toBe("☀️ **Le point du mardi 3 novembre**");
    expect(lines[1]).toBe("1 terminée hier · 1 livré · 2 pour aujourd'hui · 2 en retard · 2 bloqués");
    for (const title of [
      "**Hier**",
      "**Aujourd'hui**",
      "**À surveiller**",
      "**Projets actifs**",
      "**Cette semaine**",
    ])
      expect(lines).toContain(title);
    expect(lines).toContain(
      "• Récupérer les rushes · Tâche · Maison Lune · Motif : Disque dur chez le client",
    );
    expect(lines).toContain(
      "• Maison Lune : 45 % des tâches · 3 livrables en cours · prochaine échéance 3 nov.",
    );
    expect(lines).toContain(
      "• Café Nord : aucune tâche · 2 livrables en cours · bloqué : Attente du contrat",
    );
    expect(text.length).toBeLessThanOrEqual(TEXT_MAX);
  });

  it("au-delà de 5 éléments par rubrique : « … et N autres »", () => {
    const doneTasks = Array.from({ length: 12 }, (_, i) => ({
      id: `t${i}`,
      title: `Tâche ${String(i).padStart(2, "0")}`,
      project: "Maison Lune",
    }));
    const lines = renderReportText(buildMorningReport(facts({ doneTasks }))).split("\n");
    const start = lines.indexOf("✅ Tâches terminées (12)");
    expect(start).toBeGreaterThan(-1);
    expect(lines.slice(start + 1, start + 6).every((l) => l.startsWith("• Tâche "))).toBe(true);
    expect(lines[start + 6]).toBe("… et 7 autres");
  });

  it("jamais plus de 3 500 caractères, même avec des dizaines d'éléments", () => {
    const long = "Un titre de tâche particulièrement long ".repeat(6);
    const many = <T>(n: number, make: (i: number) => T) => Array.from({ length: n }, (_, i) => make(i));
    const big = buildMorningReport(
      facts({
        doneTasks: many(40, (i) => ({ id: `a${i}`, title: `${long}${i}`, project: long })),
        delivered: many(40, (i) => ({ id: `b${i}`, title: `${long}${i}`, project: long })),
        won: many(40, (i) => ({ id: `c${i}`, title: `${long}${i}`, client: long })),
        newProjects: many(40, (i) => ({ id: `p${i}`, name: `${long}${i}`, client: long })),
        openTasks: many(80, (i) => ({
          id: `o${i}`,
          title: `${long}${i}`,
          status: i % 2 ? "A_FAIRE" : "BLOQUE",
          dueDate: d(i % 3 ? "2026-11-03" : "2026-10-20"),
          blockedReason: long,
          owner: "Johan",
          project: long,
        })),
        projects: many(30, (i) => ({
          id: `q${i}`,
          name: `${long}${i}`,
          client: long,
          status: "BLOQUE",
          statusReason: long,
          tasksDone: 1,
          tasksTotal: 3,
          deliverablesInProgress: 2,
          nextDue: d("2026-11-04"),
        })),
      }),
    );
    const text = renderReportText(big);
    expect(text.length).toBeLessThanOrEqual(TEXT_MAX);
    expect(text.startsWith("☀️ **Le point du mardi 3 novembre**")).toBe(true);
    // L'instantané garde au plus 30 éléments par rubrique, avec le total réel.
    expect(listOf(big, "taches-terminees")).toMatchObject({ total: 40 });
    expect(listOf(big, "taches-terminees")!.items).toHaveLength(30);
  });

  it("un titre ne casse pas la mise en forme", () => {
    const text = renderReportText(
      buildMorningReport(facts({ doneTasks: [{ id: "t1", title: "**Urgent**\nà `revoir`", project: "X" }] })),
    );
    expect(text).toContain("• ∗∗Urgent∗∗ à 'revoir' · X");
  });
});

describe("garde-fous : aucune statistique par personne", () => {
  // Johan est responsable de presque tout : rien ne doit le compter ni le classer.
  const busy = facts({
    openTasks: Array.from({ length: 8 }, (_, i) => ({
      id: `j${i}`,
      title: `Tâche J${i}`,
      status: i < 3 ? ("BLOQUE" as const) : ("A_FAIRE" as const),
      dueDate: d(i < 6 ? "2026-10-28" : "2026-11-03"),
      blockedReason: i < 3 ? "En attente du client" : null,
      owner: "Johan",
      project: "Maison Lune",
    })),
  });
  const report = buildMorningReport(busy);
  const text = renderReportText(report);

  it("les compteurs sont collectifs", () => {
    expect(Object.keys(report.counts).sort()).toEqual(["blocked", "delivered", "done", "late", "today"]);
    for (const name of PEOPLE) expect(report.summary).not.toContain(name);
  });

  it("jamais de responsable sur ce qui est fait, en retard ou bloqué", () => {
    for (const key of ["hier", "surveiller"])
      for (const l of section(report, key).lists)
        for (const item of l.items) expect(item.owner).toBeUndefined();
    const watch = text.slice(text.indexOf("**À surveiller**"), text.indexOf("**Projets actifs**"));
    const yesterday = text.slice(text.indexOf("**Hier**"), text.indexOf("**Aujourd'hui**"));
    for (const name of PEOPLE) {
      expect(watch).not.toContain(name);
      expect(yesterday).not.toContain(name);
    }
  });

  it("aucune ligne n'associe une personne à un nombre", () => {
    for (const line of text.split("\n"))
      for (const name of PEOPLE) {
        expect(line).not.toMatch(new RegExp(`${name}\\s*(:|a|·)?\\s*\\d+`));
        expect(line).not.toMatch(new RegExp(`\\d+\\s+\\S+\\s+(par|pour|de)\\s+${name}`));
      }
  });
});

describe("instantané enregistré", () => {
  it("relu à l'identique", () => {
    const report = buildMorningReport(facts());
    expect(parseReportData(JSON.parse(JSON.stringify(report)))).toEqual(report);
  });

  it("illisible ou lien externe : refusé sans exception", () => {
    const report = buildMorningReport(facts());
    expect(parseReportData(null)).toBeNull();
    expect(parseReportData({ version: 2 })).toBeNull();
    for (const href of ["javascript:alert(1)", "//exemple.test", "https://exemple.test"]) {
      const tampered = structuredClone(report);
      tampered.sections[0].lists[0].items[0].href = href;
      expect(parseReportData(tampered)).toBeNull();
    }
  });
});
