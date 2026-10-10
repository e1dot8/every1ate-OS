/** Règles pures du CRM (§9) : étapes, probabilités, prévisions. Testées unitairement. */
import { percentOf } from "@/lib/money";

export const STAGES = [
  "A_CONTACTER",
  "PREMIER_ECHANGE",
  "QUALIFICATION",
  "PROPOSITION_ENVOYEE",
  "NEGOCIATION",
  "GAGNE",
  "PERDU",
] as const;
export type Stage = (typeof STAGES)[number];
export const OPEN_STAGES: Stage[] = [
  "A_CONTACTER",
  "PREMIER_ECHANGE",
  "QUALIFICATION",
  "PROPOSITION_ENVOYEE",
  "NEGOCIATION",
];

export const stageLabels: Record<Stage, string> = {
  A_CONTACTER: "À contacter",
  PREMIER_ECHANGE: "Premier échange",
  QUALIFICATION: "Qualification",
  PROPOSITION_ENVOYEE: "Proposition envoyée",
  NEGOCIATION: "Négociation",
  GAGNE: "Gagné",
  PERDU: "Perdu",
};

export const DEFAULT_PROBABILITIES: Record<Stage, number> = {
  A_CONTACTER: 10,
  PREMIER_ECHANGE: 20,
  QUALIFICATION: 35,
  PROPOSITION_ENVOYEE: 55,
  NEGOCIATION: 75,
  GAGNE: 100,
  PERDU: 0,
};

export const sourceLabels = {
  OUTBOUND: "Outbound",
  INBOUND: "Inbound",
  RECOMMANDATION: "Recommandation",
  RESEAU: "Réseau",
  PARTENAIRE: "Partenaire",
} as const;

export const activityLabels = {
  ECHANGE: "Échange",
  REUNION: "Réunion",
  PROPOSITION: "Proposition",
  NOTE: "Note",
  RELANCE: "Relance",
  ETAPE: "Changement d'étape",
} as const;

/** Probabilité retenue : saisie sur l'opportunité ouverte, sinon celle de l'étape. Gagné = 100, Perdu = 0. */
export function effectiveProbability(
  stage: Stage,
  probability: number | null,
  settings: Record<Stage, number>,
) {
  if (stage === "GAGNE") return 100;
  if (stage === "PERDU") return 0;
  return probability ?? settings[stage];
}

export type StageCheck = { ok: true } | { ok: false; error: string };

/** Toutes les étapes sont accessibles (retour arrière compris), sauf quitter « Gagné » après conversion. */
export function checkStageChange(from: Stage, to: Stage, ctx: { converted: boolean }): StageCheck {
  if (from === to) return { ok: true };
  if (from === "GAGNE" && ctx.converted)
    return { ok: false, error: "Cette opportunité a déjà été convertie en projet : elle reste « Gagné »." };
  return { ok: true };
}

export type ForecastOpp = {
  id: string;
  stage: Stage;
  amountCents: number;
  probability: number | null;
  nextActionDate: Date | null;
};

/**
 * Prévisions (§9.3) : brut, pondéré, par étape, propositions envoyées, relances en retard.
 * Le pondéré est un indicateur commercial, pas du chiffre d'affaires.
 */
export function forecast(opps: ForecastOpp[], settings: Record<Stage, number>, today: Date) {
  const open = opps.filter((o) => OPEN_STAGES.includes(o.stage));
  const weightedOf = (o: ForecastOpp) =>
    percentOf(o.amountCents, effectiveProbability(o.stage, o.probability, settings));
  const byStage = STAGES.map((stage) => {
    const list = opps.filter((o) => o.stage === stage);
    return {
      stage,
      count: list.length,
      gross: list.reduce((n, o) => n + o.amountCents, 0),
      weighted: list.reduce((n, o) => n + weightedOf(o), 0),
    };
  });
  const proposals = opps.filter((o) => o.stage === "PROPOSITION_ENVOYEE");
  const late = open.filter((o) => o.nextActionDate && o.nextActionDate < today);
  const withoutNext = open.filter((o) => !o.nextActionDate);
  return {
    gross: open.reduce((n, o) => n + o.amountCents, 0),
    weighted: open.reduce((n, o) => n + weightedOf(o), 0),
    openCount: open.length,
    byStage,
    proposals: { count: proposals.length, gross: proposals.reduce((n, o) => n + o.amountCents, 0) },
    lateIds: late.map((o) => o.id),
    withoutNextIds: withoutNext.map((o) => o.id),
    won: byStage.find((s) => s.stage === "GAGNE")!,
  };
}
