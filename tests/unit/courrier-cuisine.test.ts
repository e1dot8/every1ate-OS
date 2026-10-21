import { describe, expect, it } from "vitest";
import { mentionedNames, tierOf } from "@/features/notifications/tiers";
import { DEFAULT_THRESHOLDS, detectSituations, type SitOpportunity } from "@/features/crm/situations";
import { addDays, parseDateInput } from "@/lib/dates";

describe("le courrier", () => {
  it("classe chaque type en trois niveaux, l'inconnu reste « à suivre »", () => {
    expect(tierOf("mention")).toBe("PRIORITAIRE");
    expect(tierOf("assignation")).toBe("PRIORITAIRE");
    expect(tierOf("commentaire")).toBe("A_SUIVRE");
    expect(tierOf("badge")).toBe("INFO");
    expect(tierOf("nouveau-type")).toBe("A_SUIVRE");
  });

  it("repère les mentions @Prénom, accents et casse repliés, sans les e-mails", () => {
    expect(mentionedNames("Merci @Léa et @pierre, cf. contact@agence.fr")).toEqual(["lea", "pierre"]);
    expect(mentionedNames("@Johan @johan")).toEqual(["johan"]);
    expect(mentionedNames("aucune mention")).toEqual([]);
  });
});

const today = parseDateInput("2026-10-21")!;
const owner = { id: "u1", name: "Johan" };
const opp = (over: Partial<SitOpportunity>): SitOpportunity => ({
  id: "o1",
  title: "Campagne hiver",
  client: "Maison Kitsuné",
  stage: "QUALIFICATION",
  owner,
  nextAction: null,
  nextActionDate: null,
  expectedCloseDate: null,
  lastActivityAt: addDays(today, -2),
  createdAt: addDays(today, -30),
  ...over,
});
const run = (input: Partial<Parameters<typeof detectSituations>[0]>) =>
  detectSituations({ today, opportunities: [], billing: [], closedProjects: [], signals: [], ...input });

describe("La Cuisine", () => {
  it("relance en retard : à risque, urgente, avec la raison et la prochaine action", () => {
    const [s] = run({
      opportunities: [opp({ nextActionDate: addDays(today, -4), nextAction: "Rappeler Léa" })],
    });
    expect(s).toMatchObject({ view: "A_RISQUE", priority: 3, nextAction: "Rappeler Léa", owner });
    expect(s.reason).toMatch(/non faite depuis 4 j/);
  });

  it("proposition envoyée avec relance planifiée : en attente seulement", () => {
    const list = run({
      opportunities: [opp({ stage: "PROPOSITION_ENVOYEE", nextActionDate: addDays(today, 3) })],
    });
    expect(list.map((s) => s.view)).toEqual(["EN_ATTENTE"]);
  });

  it("un même client peut être à risque et en attente (silence prolongé pendant une négociation)", () => {
    const list = run({
      opportunities: [
        opp({ stage: "NEGOCIATION", lastActivityAt: addDays(today, -DEFAULT_THRESHOLDS.silenceDays) }),
      ],
    });
    expect(list.map((s) => s.view).sort()).toEqual(["A_RISQUE", "EN_ATTENTE"]);
  });

  it("les seuils sont réglables", () => {
    const quiet = opp({ lastActivityAt: addDays(today, -10) });
    expect(run({ opportunities: [quiet] })).toHaveLength(0);
    expect(
      detectSituations(
        { today, opportunities: [quiet], billing: [], closedProjects: [], signals: [] },
        { ...DEFAULT_THRESHOLDS, silenceDays: 7 },
      ),
    ).toHaveLength(1);
  });

  it("à encaisser : facture à émettre bientôt, et facture non soldée en retard", () => {
    const base = {
      projectId: "p1",
      project: "Site",
      client: "Dior",
      owner,
      amount: 1000,
      paid: 0,
      invoicedAt: null,
      plannedDate: null,
    };
    const list = run({
      billing: [
        { ...base, id: "b1", label: "Acompte", status: "ATTENDU", plannedDate: addDays(today, 3) },
        { ...base, id: "b2", label: "Solde", status: "FACTURE", invoicedAt: addDays(today, -45), paid: 400 },
        { ...base, id: "b3", label: "Payée", status: "FACTURE", invoicedAt: addDays(today, -45), paid: 1000 },
        { ...base, id: "b4", label: "Lointaine", status: "ATTENDU", plannedDate: addDays(today, 40) },
      ],
    });
    expect(list.map((s) => s.key)).toEqual(["encaisser:b2", "facturer:b1"]);
    expect(list[0].reason).toMatch(/600\s€ non reçus/);
  });

  it("à développer : chaque signal garde son responsable, ou reste à attribuer", () => {
    const list = run({
      signals: [
        {
          key: "s1",
          kind: "suite",
          title: "Proposer une suite",
          detail: "Projet réussi",
          client: "Dior",
          owner,
          href: "/x",
          date: null,
        },
        {
          key: "s2",
          kind: "dormant",
          title: "Relancer Kitsuné",
          detail: "6 mois",
          client: "Kitsuné",
          owner: null,
          href: "/y",
          date: null,
        },
      ],
    });
    expect(list.every((s) => s.view === "A_DEVELOPPER" && s.reason && s.nextAction)).toBe(true);
    expect(list.find((s) => s.key === "developper:s2")?.owner).toBeNull();
  });

  it("projet clôturé avec une satisfaction basse : à risque", () => {
    const [s] = run({
      closedProjects: [
        {
          id: "p9",
          name: "Teaser",
          client: "G-Shock",
          owner,
          closedAt: addDays(today, -20),
          satisfaction: 2,
        },
      ],
    });
    expect(s).toMatchObject({ view: "A_RISQUE", priority: 3 });
  });
});
