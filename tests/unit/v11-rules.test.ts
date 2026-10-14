import { describe, expect, it } from "vitest";
import { addMonths, parseDateInput } from "@/lib/dates";
import { buildBrief } from "@/features/brief/rules";
import { commercialSignals } from "@/features/crm/signals";
import { summarize } from "@/features/finance/calc";
import { cashForecast } from "@/features/finance/cash";
import { estimateFromHistory, profitabilityBy, stat } from "@/features/finance/estimate";
import { loggedTimeCost, plannedTimeCost, rateResolver } from "@/features/finance/time-cost";
import { findDate, parseActions } from "@/features/notes/parse";
import { nextOccurrence } from "@/features/planning/recurrence";
import { loadPercent, weeklyLoad } from "@/features/planning/workload";
import { closureHints } from "@/features/projects/closure-auto";

const d = (s: string) => parseDateInput(s)!;
const iso = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);
const today = d("2026-10-12"); // lundi

describe("dates", () => {
  it("addMonths reste dans le mois cible", () => {
    expect(iso(addMonths(d("2026-01-31"), 1))).toBe("2026-02-28");
    expect(iso(addMonths(d("2028-01-31"), 1))).toBe("2028-02-29");
    expect(iso(addMonths(d("2026-11-15"), 3))).toBe("2027-02-15");
  });
});

describe("coût du temps", () => {
  const rateOf = rateResolver(
    new Map([
      ["johan", 6000],
      ["pierre", null],
    ]),
    4500,
  );
  it("taux de l'associé, sinon taux de l'agence", () => {
    expect(
      loggedTimeCost(
        [
          { userId: "johan", minutes: 90 },
          { userId: "pierre", minutes: 60 },
        ],
        rateOf,
      ),
    ).toEqual({ cost: 9000 + 4500, unvaluedMinutes: 0 });
  });
  it("sans aucun taux : temps non valorisé", () => {
    expect(loggedTimeCost([{ userId: "x", minutes: 30 }], rateResolver(new Map(), null))).toEqual({
      cost: 0,
      unvaluedMinutes: 30,
    });
  });
  it("temps prévu = max(estimation, passé), tâches annulées exclues", () => {
    expect(
      plannedTimeCost(
        [
          { ownerId: "johan", estimatedMinutes: 120, loggedMinutes: 60, cancelled: false },
          { ownerId: "johan", estimatedMinutes: 60, loggedMinutes: 180, cancelled: false },
          { ownerId: "johan", estimatedMinutes: 600, loggedMinutes: 0, cancelled: true },
        ],
        rateOf,
      ),
    ).toBe(12000 + 18000);
  });
  it("marge après temps dans la synthèse", () => {
    const s = summarize({
      budget: { revenue: 1000000, cost: 400000 },
      initial: null,
      costs: [{ amount: 300000, status: "FACTURE", rebillable: false }],
      billing: [{ id: "a", amount: 500000, status: "FACTURE", plannedDate: null }],
      payments: [],
      today,
      time: { logged: 100000, planned: 150000 },
    });
    expect(s.marginForecast).toBe(600000);
    expect(s.marginForecastAfterTime).toBe(450000);
    expect(s.marginActualAfterTime).toBe(500000 - 300000 - 100000);
    const none = summarize({ budget: null, initial: null, costs: [], billing: [], payments: [], today });
    expect(none.marginForecastAfterTime).toBeNull();
  });
});

describe("trésorerie 13 semaines", () => {
  const f = cashForecast({
    today,
    startBalance: 1000000,
    inflows: [
      { label: "Acompte en retard", amount: 300000, date: d("2026-10-01") },
      { label: "Solde", amount: 500000, date: d("2026-11-20") },
      { label: "Sans date", amount: 100000, date: null },
      { label: "Trop loin", amount: 999999, date: d("2027-06-01") },
    ],
    outflows: [{ label: "Loueur", amount: 200000, date: d("2026-10-15") }],
    contracts: [
      { label: "CM", monthlyAmount: 150000, startDate: d("2026-01-05"), endDate: null, status: "ACTIF" },
    ],
    charges: [
      { label: "Loyer", amount: 250000, frequency: "MENSUELLE", nextDate: d("2026-11-01"), endDate: null },
    ],
  });
  it("le retard tombe en semaine 1 et l'élément non daté est mis à part", () => {
    expect(f.weeks).toHaveLength(13);
    expect(f.weeks[0].inflow).toBe(300000);
    expect(f.weeks[0].items[0].late).toBe(true);
    expect(f.undated.map((u) => u.label)).toEqual(["Sans date"]);
  });
  it("contrat mensuel et loyer répétés ; horizon respecté", () => {
    // Contrat : 5 nov., 5 déc., 5 janv. ; loyer : 1er nov., 1er déc., 1er janv.
    expect(f.totalIn).toBe(300000 + 500000 + 3 * 150000);
    expect(f.totalOut).toBe(200000 + 3 * 250000);
    expect(f.endBalance).toBe(1000000 + f.totalIn - f.totalOut);
  });
  it("point bas identifié", () => {
    const low = cashForecast({
      today,
      startBalance: 100000,
      inflows: [],
      outflows: [{ label: "x", amount: 300000, date: d("2026-10-20") }],
      contracts: [],
      charges: [],
    });
    expect(low.lowest.balance).toBe(-200000);
    expect(low.negativeWeeks).toBe(12);
    expect(low.hasStartBalance).toBe(true);
  });
});

describe("charge à venir", () => {
  it("répartit le reste à faire sur les jours ouvrés jusqu'à l'échéance", () => {
    const r = weeklyLoad(
      [
        { ownerId: "j", startDate: null, dueDate: d("2026-10-23"), estimatedMinutes: 600, loggedMinutes: 0 }, // 10 jours ouvrés
        { ownerId: "j", startDate: null, dueDate: d("2026-10-01"), estimatedMinutes: 120, loggedMinutes: 60 }, // en retard
        { ownerId: "j", startDate: null, dueDate: null, estimatedMinutes: 90, loggedMinutes: 0 },
        { ownerId: null, startDate: null, dueDate: d("2026-10-14"), estimatedMinutes: 90, loggedMinutes: 0 },
      ],
      today,
    );
    expect(r.perOwner.get("j")!.slice(0, 3)).toEqual([300 + 60, 300, 0]);
    expect(r.unplannedMinutes).toBe(90);
    expect(loadPercent(2100, 35)).toBe(100);
  });
});

describe("récurrence", () => {
  it("hebdomadaire, mensuelle, fin de récurrence", () => {
    expect(
      nextOccurrence({
        recurrence: "HEBDOMADAIRE",
        startDate: d("2026-10-12"),
        dueDate: d("2026-10-16"),
        recurrenceUntil: null,
      }),
    ).toEqual({ startDate: d("2026-10-19"), dueDate: d("2026-10-23") });
    expect(
      iso(
        nextOccurrence({
          recurrence: "MENSUELLE",
          startDate: null,
          dueDate: d("2026-01-31"),
          recurrenceUntil: null,
        })!.dueDate,
      ),
    ).toBe("2026-02-28");
    expect(
      nextOccurrence({
        recurrence: "MENSUELLE",
        startDate: null,
        dueDate: d("2026-11-30"),
        recurrenceUntil: d("2026-12-15"),
      }),
    ).toBeNull();
    expect(
      nextOccurrence({
        recurrence: "AUCUNE",
        startDate: null,
        dueDate: d("2026-11-30"),
        recurrenceUntil: null,
      }),
    ).toBeNull();
  });
});

describe("compte rendu → actions", () => {
  const people = [
    { id: "j", name: "Johan" },
    { id: "c", name: "Charles" },
    { id: "e", name: "Élodie" },
  ];
  it("détecte les lignes d'action, le responsable et l'échéance", () => {
    const body = [
      "Réunion avec Claire (Maison Solène)",
      "- Le client valide la DA.",
      "- [ ] Envoyer le devis V2 @Charles pour le 15/10",
      "TODO : relancer le photographe @johan demain",
      "→ Préparer le moodboard @elodie le 3 novembre",
      "Action : réserver le studio vendredi",
      "[ ] @Inconnu vérifier les droits musicaux",
    ].join("\n");
    const a = parseActions(body, people, today);
    expect(a.map((x) => [x.title, x.ownerId, iso(x.dueDate)])).toEqual([
      ["Envoyer le devis V2", "c", "2026-10-15"],
      ["Relancer le photographe", "j", "2026-10-13"],
      ["Préparer le moodboard", "e", "2026-11-03"],
      ["Réserver le studio", null, "2026-10-16"],
      ["@Inconnu vérifier les droits musicaux", null, null],
    ]);
  });
  it("une date passée sans année bascule l'année suivante", () => {
    expect(iso(findDate("pour le 02/03", today)!.date)).toBe("2027-03-02");
    expect(iso(findDate("le 31/02", today)?.date ?? null)).toBeNull();
  });
});

describe("clôture semi-automatique", () => {
  it("explique chaque point vérifiable", () => {
    const h = closureHints({
      openTasks: 2,
      costsNotPaid: 0,
      billingNotCollected: 1,
      hasReview: true,
      documents: 0,
    });
    expect(h.taches).toMatchObject({ verifiable: true, ok: false, reason: "2 tâches encore ouvertes." });
    expect(h.couts.ok).toBe(true);
    expect(h.facturation.reason).toBe("1 échéance pas entièrement encaissée.");
    expect(h.bilan.ok).toBe(true);
    expect(h.archives.verifiable).toBe(false);
  });
});

describe("chiffrage par l'historique", () => {
  const H = [
    {
      id: "1",
      name: "Clip A",
      templateKey: "clip",
      clientId: "x",
      revenue: 2000000,
      costs: 1200000,
      minutes: 6000,
      durationDays: 40,
      closed: true,
    },
    {
      id: "2",
      name: "Clip B",
      templateKey: "clip",
      clientId: "y",
      revenue: 3000000,
      costs: 1500000,
      minutes: 9000,
      durationDays: 60,
      closed: true,
    },
    {
      id: "3",
      name: "Clip C",
      templateKey: "clip",
      clientId: "y",
      revenue: 2500000,
      costs: 2000000,
      minutes: 7000,
      durationDays: 50,
      closed: true,
    },
    {
      id: "4",
      name: "Clip en cours",
      templateKey: "clip",
      clientId: "y",
      revenue: 9900000,
      costs: 0,
      minutes: 0,
      durationDays: null,
      closed: false,
    },
    {
      id: "5",
      name: "Conseil",
      templateKey: "conseil",
      clientId: "x",
      revenue: 800000,
      costs: 50000,
      minutes: 3000,
      durationDays: 30,
      closed: true,
    },
  ];
  it("médiane, min et max sur les projets clôturés du même modèle", () => {
    const e = estimateFromHistory(H, "clip");
    expect(e.basis).toBe("clotures");
    expect(e.revenue).toEqual({ count: 3, min: 2000000, median: 2500000, max: 3000000 });
    expect(e.marginRate).toEqual({ count: 3, min: 20, median: 40, max: 50 });
    expect(stat([])).toBeNull();
  });
  it("se replie sur les projets en cours si moins de 2 clôturés", () => {
    expect(estimateFromHistory(H, "conseil").basis).toBe("en-cours");
  });
  it("rentabilité groupée et triée", () => {
    const r = profitabilityBy([
      { key: "clip", label: "Clip", revenue: 100, costs: 40, timeCost: 10 },
      { key: "clip", label: "Clip", revenue: 100, costs: 60, timeCost: null },
      { key: "conseil", label: "Conseil", revenue: 100, costs: 10, timeCost: 20 },
    ]);
    expect(r.map((x) => [x.key, x.margin, x.timeKnown])).toEqual([
      ["clip", 100, false],
      ["conseil", 70, true],
    ]);
  });
});

describe("opportunités détectées", () => {
  it("dormants, renouvellements avec préavis, suites à proposer", () => {
    const s = commercialSignals({
      today,
      clients: [
        {
          id: "a",
          name: "Atelier",
          lastActivityAt: d("2026-02-01"),
          openOpportunities: 0,
          activeProjects: 0,
          everWorked: true,
        },
        {
          id: "b",
          name: "Brume",
          lastActivityAt: d("2026-09-01"),
          openOpportunities: 0,
          activeProjects: 0,
          everWorked: true,
        },
        {
          id: "c",
          name: "Café",
          lastActivityAt: d("2025-01-01"),
          openOpportunities: 1,
          activeProjects: 0,
          everWorked: true,
        },
      ],
      contracts: [
        {
          id: "k1",
          label: "CM",
          clientName: "Café",
          status: "ACTIF",
          renewalDate: d("2026-12-31"),
          endDate: null,
          noticeDays: 30,
        },
        {
          id: "k2",
          label: "Ads",
          clientName: "Brume",
          status: "ACTIF",
          renewalDate: d("2027-06-01"),
          endDate: null,
          noticeDays: 30,
        },
      ],
      closedProjects: [
        {
          id: "p1",
          name: "Lookbook",
          clientId: "b",
          clientName: "Brume",
          closedAt: d("2026-08-20"),
          satisfaction: 5,
          marginRate: 18,
        },
        {
          id: "p2",
          name: "Clip",
          clientId: "c",
          clientName: "Café",
          closedAt: d("2026-09-20"),
          satisfaction: 5,
          marginRate: 40,
        },
      ],
    });
    expect(s.map((x) => [x.kind, x.title])).toEqual([
      ["renouvellement", "Renouvellement : CM"],
      ["suite", "Proposer une suite à Brume"],
      ["dormant", "Relancer Atelier"],
    ]);
  });
});

describe("brief du jour", () => {
  it("classe l'urgent d'abord et résume", () => {
    const b = buildBrief({
      overdueTasks: [{ id: "t1", title: "Key visual", dueDate: today, project: "P" }],
      dueToday: [{ id: "t2", title: "Moodboard", project: "P" }],
      blocked: [],
      followUps: [{ id: "o1", title: "Gamme solaire", nextAction: "Relancer", late: true }],
      meetings: [{ id: "e1", title: "Point hebdo", time: "09:30" }],
      decisions: [],
      lateBilling: [],
      renewals: [],
    });
    expect(b.summary).toBe("2 points urgents sur 4.");
    expect(b.items[0].severity).toBe(3);
    expect(b.items.at(-1)!.kind).toBe("reunion");
    expect(
      buildBrief({
        overdueTasks: [],
        dueToday: [],
        blocked: [],
        followUps: [],
        meetings: [],
        decisions: [],
        lateBilling: [],
        renewals: [],
      }).summary,
    ).toBe("Rien d'urgent aujourd'hui.");
  });
});
