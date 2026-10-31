import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closedProjectMarginRate,
  detectSignals,
  frenchDates,
  latestDate,
  loadCommercialSignals,
  recentlyClosed,
  type SignalProject,
  type SignalSources,
} from "@/features/crm/signals-service";
import { parseDateInput } from "@/lib/dates";

const fakeDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    if (!fakeDb.current) throw new Error("Pas de base en test unitaire.");
    return fakeDb.current;
  },
}));

const d = (s: string) => parseDateInput(s)!;
const at = (s: string) => new Date(`${s}T10:00:00Z`);
const today = d("2026-10-14");

const project = (p: Partial<SignalProject> & Pick<SignalProject, "id" | "clientId">): SignalProject => ({
  name: `Projet ${p.id}`,
  status: "TERMINE",
  archivedAt: null,
  createdAt: at("2025-06-01"),
  startDate: null,
  actualEndDate: null,
  closedAt: null,
  clientSatisfaction: null,
  ...p,
});

const empty: SignalSources = {
  today,
  clients: [],
  projects: [],
  opportunities: [],
  activities: [],
  notes: [],
  contracts: [],
  margins: new Map(),
};

describe("opportunités détectées : outils", () => {
  it("latestDate retient la date la plus récente et ignore les vides", () => {
    expect(latestDate(null, d("2026-01-02"), undefined, d("2026-03-01"), d("2025-12-31"))).toEqual(
      d("2026-03-01"),
    );
    expect(latestDate(null, undefined)).toBeNull();
    expect(latestDate()).toBeNull();
  });

  it("projet clôturé récemment : terminé ou archivé, depuis 120 jours au plus", () => {
    expect(recentlyClosed({ status: "TERMINE", closedAt: at("2026-09-14") }, today)).toBe(true);
    expect(recentlyClosed({ status: "ARCHIVE", closedAt: at("2026-06-16") }, today)).toBe(true); // 120 j
    expect(recentlyClosed({ status: "TERMINE", closedAt: at("2026-06-15") }, today)).toBe(false); // 121 j
    // Rouvert après clôture : la date de clôture subsiste mais le projet est en cours.
    expect(recentlyClosed({ status: "ACTIF", closedAt: at("2026-09-14") }, today)).toBe(false);
    expect(recentlyClosed({ status: "TERMINE", closedAt: null }, today)).toBe(false);
  });

  it("marge d'un projet clôturé : facturé − coûts engagés, arrondie à l'entier inférieur", () => {
    const billing = [
      { id: "b1", amount: 600_000, status: "FACTURE" as const, plannedDate: d("2026-05-01") },
      // Attendue mais déjà encaissée : comptée comme facturée.
      { id: "b2", amount: 400_000, status: "ATTENDU" as const, plannedDate: d("2026-06-01") },
      { id: "b3", amount: 900_000, status: "ANNULE" as const, plannedDate: d("2026-06-01") },
    ];
    const payments = [{ amount: 400_000, billingMilestoneId: "b2" }];
    const costs = [
      { amount: 500_000, status: "ENGAGE" as const, rebillable: false },
      { amount: 200_000, status: "PAYE" as const, rebillable: true },
      { amount: 100_000, status: "PREVU" as const, rebillable: false }, // non engagé
      { amount: 300_000, status: "ANNULE" as const, rebillable: false },
    ];
    expect(closedProjectMarginRate({ billing, payments, costs, today })).toBe(30);
    // 24,5 % ne franchit pas le seuil de 25 % par arrondi.
    expect(
      closedProjectMarginRate({
        billing: [{ id: "b", amount: 1_000_000, status: "FACTURE", plannedDate: null }],
        payments: [],
        costs: [{ amount: 755_000, status: "FACTURE", rebillable: false }],
        today,
      }),
    ).toBe(24);
    expect(
      closedProjectMarginRate({
        billing: [],
        payments: [],
        costs: [{ amount: 100, status: "PAYE", rebillable: false }],
        today,
      }),
    ).toBeNull();
  });
});

describe("opportunités détectées : signaux enrichis", () => {
  const sources: SignalSources = {
    ...empty,
    clients: [
      { id: "atelier", name: "Atelier" },
      { id: "brume", name: "Brume" },
      { id: "cafe", name: "Café" },
      { id: "dune", name: "Dune" },
      { id: "eclat", name: "Éclat" },
      { id: "fjord", name: "Fjord" },
      { id: "gaia", name: "Gaïa" },
    ],
    projects: [
      // Atelier : dernier projet clôturé il y a 9 mois → dormant.
      project({ id: "p-a", clientId: "atelier", closedAt: at("2026-01-10"), actualEndDate: d("2026-01-10") }),
      // Brume : même situation, mais un échange CRM récent (sur une opportunité archivée).
      project({ id: "p-b", clientId: "brume", closedAt: at("2026-01-10") }),
      // Dune : projet réussi, mais une opportunité est ouverte → ni suite ni dormant.
      project({ id: "p-d", clientId: "dune", closedAt: at("2026-09-15"), clientSatisfaction: 5 }),
      // Éclat : deux projets réussis → une seule suite, sur le plus récent.
      project({
        id: "p-e1",
        clientId: "eclat",
        name: "Refonte",
        closedAt: at("2026-09-01"),
        clientSatisfaction: 5,
      }),
      project({
        id: "p-e2",
        clientId: "eclat",
        name: "Lancement",
        status: "ARCHIVE",
        archivedAt: at("2026-09-02"),
        closedAt: at("2026-08-01"),
      }),
      // Fjord : vieux projet, mais un compte rendu récent rattaché au projet.
      project({ id: "p-f", clientId: "fjord", closedAt: at("2025-12-01") }),
      // Gaïa : vieux projet ; la mise à jour d'une opportunité archivée ne compte pas.
      project({ id: "p-g", clientId: "gaia", createdAt: at("2025-03-01"), closedAt: at("2025-11-01") }),
      // Entreprise archivée : aucune suite proposée.
      project({ id: "p-z", clientId: "zinc", closedAt: at("2026-09-20"), clientSatisfaction: 5 }),
    ],
    opportunities: [
      {
        id: "o-b",
        clientId: "brume",
        stage: "PERDU",
        archivedAt: at("2026-08-02"),
        updatedAt: at("2026-08-02"),
      },
      // Café : seulement une opportunité perdue → jamais travaillé ensemble, pas « dormant ».
      { id: "o-c", clientId: "cafe", stage: "PERDU", archivedAt: null, updatedAt: at("2025-01-01") },
      { id: "o-d", clientId: "dune", stage: "QUALIFICATION", archivedAt: null, updatedAt: at("2026-10-01") },
      {
        id: "o-g",
        clientId: "gaia",
        stage: "PERDU",
        archivedAt: at("2026-09-01"),
        updatedAt: at("2026-09-01"),
      },
    ],
    activities: [{ opportunityId: "o-b", at: at("2026-08-01") }],
    notes: [{ clientId: null, projectId: "p-f", opportunityId: null, at: d("2026-06-01") }],
    contracts: [
      {
        id: "k-dune",
        label: "Maintenance",
        status: "ACTIF",
        renewalDate: d("2026-12-01"),
        endDate: null,
        noticeDays: 30,
        clientId: "dune",
        clientName: "Dune",
      },
      {
        id: "k-cafe",
        label: "Réseaux sociaux",
        status: "ACTIF",
        renewalDate: d("2026-11-19"),
        endDate: null,
        noticeDays: 30,
        clientId: "cafe",
        clientName: "Café",
      },
      {
        id: "k-zinc",
        label: "Hébergement",
        status: "ACTIF",
        renewalDate: null,
        endDate: d("2026-11-30"),
        noticeDays: null,
        clientId: "zinc",
        clientName: "Zinc",
      },
      {
        id: "k-loin",
        label: "Lointain",
        status: "ACTIF",
        renewalDate: d("2027-06-01"),
        endDate: null,
        noticeDays: 30,
        clientId: "cafe",
        clientName: "Café",
      },
    ],
    margins: new Map([
      ["p-e2", 40],
      ["p-z", 50],
    ]),
  };

  it("renouvellements (échéance la plus proche d'abord), une suite par entreprise, puis dormants", () => {
    const s = detectSignals(sources);
    expect(s.map((x) => [x.kind, x.clientName])).toEqual([
      ["renouvellement", "Café"],
      ["renouvellement", "Dune"],
      ["renouvellement", "Zinc"],
      ["suite", "Éclat"],
      ["dormant", "Atelier"],
      ["dormant", "Gaïa"],
    ]);
    expect(new Set(s.map((x) => x.key)).size).toBe(s.length);
    expect(s.find((x) => x.kind === "suite")?.detail).toBe("« Refonte » clôturé, satisfaction 5/5.");
    expect(s.find((x) => x.clientName === "Atelier")?.detail).toBe("Aucune activité depuis 9 mois.");
    expect(s.find((x) => x.clientName === "Gaïa")?.detail).toBe("Aucune activité depuis 12 mois.");
  });

  it("chaque signal pointe vers son entreprise et l'action « Créer une opportunité »", () => {
    const s = detectSignals(sources);
    const dune = s.find((x) => x.kind === "renouvellement" && x.clientName === "Dune")!;
    expect(dune).toMatchObject({
      clientId: "dune",
      clientHref: "/crm/clients/dune",
      contractHref: "/finance/contrats/k-dune",
      createHref: "/crm/opportunites/nouvelle?client=dune",
      date: d("2026-11-01"),
    });
    const dormant = s.find((x) => x.clientName === "Atelier")!;
    expect(dormant).toMatchObject({
      clientId: "atelier",
      contractHref: null,
      createHref: "/crm/opportunites/nouvelle?client=atelier",
    });
    expect(s.find((x) => x.kind === "suite")?.createHref).toBe("/crm/opportunites/nouvelle?client=eclat");
    // Contrat d'une entreprise archivée : signalé, mais sans fiche ni création d'opportunité.
    expect(s.find((x) => x.clientName === "Zinc")).toMatchObject({
      clientId: "zinc",
      clientHref: null,
      contractHref: "/finance/contrats/k-zinc",
      createHref: null,
    });
  });

  it("suite possible : satisfaction ≥ 4 ou marge ≥ 25 %, sinon rien", () => {
    const base: SignalSources = {
      ...empty,
      clients: [
        { id: "h", name: "Hélice" },
        { id: "i", name: "Iris" },
      ],
      projects: [
        project({ id: "p-h", clientId: "h", closedAt: at("2026-07-01"), clientSatisfaction: 3 }),
        project({ id: "p-i", clientId: "i", closedAt: at("2026-07-01"), clientSatisfaction: 3 }),
      ],
      margins: new Map([
        ["p-h", 25],
        ["p-i", 24],
      ]),
    };
    expect(detectSignals(base).map((x) => [x.kind, x.clientName, x.detail])).toEqual([
      ["suite", "Hélice", "« Projet p-h » clôturé, satisfaction 3/5, marge 25 %."],
    ]);
  });

  it("dates des motifs au format français (jour, mois abrégé, année si différente)", () => {
    const s = detectSignals(sources);
    expect(s.find((x) => x.clientName === "Dune")?.detail).toBe("Dune · préavis à donner avant le 1 nov.");
    expect(s.find((x) => x.clientName === "Zinc")?.detail).toBe("Zinc · échéance le 30 nov.");
    expect(s.every((x) => !/\d{4}-\d{2}-\d{2}/.test(x.detail))).toBe(true);
    expect(frenchDates("Iris · préavis à donner avant le 2027-01-05", today)).toBe(
      "Iris · préavis à donner avant le 5 janv. 2027",
    );
    // Seule l'échéance finale est reformatée : un nom contenant une date reste intact.
    expect(frenchDates("Studio 2026-03-15 · échéance le 2026-12-01", today)).toBe(
      "Studio 2026-03-15 · échéance le 1 déc.",
    );
    // Une date impossible n'est pas réinterprétée.
    expect(frenchDates("échéance le 2026-02-30", today)).toBe("échéance le 2026-02-30");
  });

  it("un contrat récurrent actif rend la relation active : pas de client dormant", () => {
    const base: SignalSources = {
      ...empty,
      clients: [
        { id: "j", name: "Jade" },
        { id: "k", name: "Kaki" },
      ],
      projects: [
        project({ id: "p-j", clientId: "j", closedAt: at("2025-06-01") }),
        project({ id: "p-k", clientId: "k", closedAt: at("2025-06-01") }),
      ],
      contracts: [
        // Jade : contrat en cours, échéance lointaine → aucun signal.
        {
          id: "k-j",
          label: "Maintenance",
          status: "ACTIF",
          renewalDate: d("2027-06-01"),
          endDate: null,
          noticeDays: 30,
          clientId: "j",
          clientName: "Jade",
        },
        // Kaki : contrat resté « actif » mais terminé le 1er janvier → inactif depuis cette date.
        {
          id: "k-k",
          label: "Hébergement",
          status: "ACTIF",
          renewalDate: null,
          endDate: d("2026-01-01"),
          noticeDays: null,
          clientId: "k",
          clientName: "Kaki",
        },
      ],
    };
    expect(detectSignals(base).map((x) => [x.kind, x.clientName, x.detail])).toEqual([
      ["dormant", "Kaki", "Aucune activité depuis 10 mois."],
    ]);
  });

  it("aucune donnée : aucun signal", () => {
    expect(detectSignals(empty)).toEqual([]);
  });
});

describe("opportunités détectées : chargement", () => {
  let calls: string[];
  beforeEach(() => {
    calls = [];
  });

  function db(clients: number) {
    const rec =
      <T>(name: string, rows: T) =>
      async () => {
        calls.push(name);
        return rows;
      };
    return {
      client: {
        findMany: rec(
          "client",
          Array.from({ length: clients }, (_, i) => ({ id: `c${i}`, name: `Entreprise ${i}` })),
        ),
      },
      project: {
        findMany: rec(
          "project",
          Array.from({ length: clients }, (_, i) =>
            project({ id: `p${i}`, clientId: `c${i}`, closedAt: at("2026-09-01"), clientSatisfaction: 2 }),
          ),
        ),
      },
      opportunity: { findMany: rec("opportunity", []) },
      opportunityActivity: { groupBy: rec("activity", []) },
      meetingNote: { groupBy: rec("note", []) },
      recurringContract: {
        findMany: rec("contract", [
          {
            id: "k1",
            label: "Maintenance",
            status: "ACTIF",
            renewalDate: d("2026-11-13"),
            endDate: null,
            noticeDays: 10,
            clientId: "c0",
            client: { name: "Entreprise 0" },
          },
        ]),
      },
      billingMilestone: {
        findMany: rec(
          "billing",
          Array.from({ length: clients }, (_, i) => ({
            id: `b${i}`,
            projectId: `p${i}`,
            amount: "10000.00",
            status: "FACTURE",
            plannedDate: d("2026-08-01"),
          })),
        ),
      },
      paymentRecord: { findMany: rec("payment", []) },
      costItem: {
        findMany: rec(
          "cost",
          Array.from({ length: clients }, (_, i) => ({
            projectId: `p${i}`,
            amount: i === 0 ? "5000.00" : "9000.00",
            status: "ENGAGE",
            rebillable: false,
          })),
        ),
      },
    };
  }

  it("nombre de requêtes fixe, quel que soit le nombre d'entreprises", async () => {
    for (const n of [2, 40]) {
      calls = [];
      fakeDb.current = db(n);
      const signals = await loadCommercialSignals(today);
      expect(calls).toHaveLength(9);
      // c0 : marge 50 % → suite ; les autres (10 %) ne déclenchent rien. k1 : préavis le 3 nov.
      expect(signals.map((s) => [s.kind, s.clientId])).toEqual([
        ["renouvellement", "c0"],
        ["suite", "c0"],
      ]);
      expect(signals[1].detail).toBe("« Projet p0 » clôturé, satisfaction 2/5, marge 50 %.");
    }
    fakeDb.current = null;
  });
});
