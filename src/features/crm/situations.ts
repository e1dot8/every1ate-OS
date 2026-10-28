/**
 * La Salle de restaurant — situations commerciales (pures, testées). Une entrée dit toujours POURQUOI elle
 * apparaît, qui s'en charge, la prochaine action et l'échéance. Un même client peut apparaître
 * dans plusieurs vues. Les seuils viennent des réglages de l'agence (ADR-0017).
 */
import type { OpportunityStage } from "@/generated/prisma/enums";
import { addDays, daysBetween } from "@/lib/dates";

export type SituationView = "EN_ATTENTE" | "A_RISQUE" | "A_ENCAISSER" | "A_DEVELOPPER";

export type Thresholds = {
  /** Silence (jours sans échange) au-delà duquel une opportunité ouverte est à risque. */
  silenceDays: number;
  /** Délai de paiement après facturation. */
  paymentTermDays: number;
  /** Une échéance de facturation entre dans « À encaisser » ce nombre de jours avant sa date. */
  billingHorizonDays: number;
  /** Satisfaction (1-5) à partir de laquelle (incluse) un projet clôturé est un risque. */
  lowSatisfaction: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  silenceDays: 21,
  paymentTermDays: 30,
  billingHorizonDays: 7,
  lowSatisfaction: 2,
};

export type Situation = {
  key: string;
  view: SituationView;
  title: string;
  client: string | null;
  /** Pourquoi l'entrée est là, en une phrase. */
  reason: string;
  /** Règle déclenchée (documentée sur la page). */
  rule: string;
  owner: { id: string; name: string } | null;
  nextAction: string;
  dueDate: Date | null;
  priority: 1 | 2 | 3;
  href: string;
};

/** Étapes où la balle est dans le camp du client. */
const WAITING_STAGES: OpportunityStage[] = ["PROPOSITION_ENVOYEE", "NEGOCIATION"];
const OPEN_STAGES: OpportunityStage[] = [
  "A_CONTACTER",
  "PREMIER_ECHANGE",
  "QUALIFICATION",
  "PROPOSITION_ENVOYEE",
  "NEGOCIATION",
];

export type SitOpportunity = {
  id: string;
  title: string;
  client: string;
  stage: OpportunityStage;
  owner: { id: string; name: string };
  nextAction: string | null;
  nextActionDate: Date | null;
  expectedCloseDate: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
};

export type SitBilling = {
  id: string;
  label: string;
  projectId: string;
  project: string;
  client: string | null;
  owner: { id: string; name: string } | null;
  status: "ATTENDU" | "FACTURE" | "ANNULE";
  plannedDate: Date | null;
  invoicedAt: Date | null;
  amount: number;
  paid: number;
};

export type SitClosedProject = {
  id: string;
  name: string;
  client: string | null;
  owner: { id: string; name: string } | null;
  closedAt: Date;
  satisfaction: number | null;
};

export type SitSignal = {
  key: string;
  kind: "dormant" | "renouvellement" | "suite";
  title: string;
  detail: string;
  client: string | null;
  owner: { id: string; name: string } | null;
  href: string;
  date: Date | null;
};

const euros = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function detectSituations(
  input: {
    today: Date;
    opportunities: SitOpportunity[];
    billing: SitBilling[];
    closedProjects: SitClosedProject[];
    signals: SitSignal[];
  },
  t: Thresholds = DEFAULT_THRESHOLDS,
): Situation[] {
  const { today } = input;
  const out: Situation[] = [];

  for (const o of input.opportunities) {
    if (!OPEN_STAGES.includes(o.stage)) continue;
    const href = `/crm/opportunites/${o.id}`;
    const since = o.lastActivityAt ?? o.createdAt;
    const silent = daysBetween(since, today);
    const base = { client: o.client, owner: o.owner, href };

    // À risque — relance en retard, échéance de signature dépassée, silence prolongé.
    if (o.nextActionDate && o.nextActionDate < today)
      out.push({
        ...base,
        key: `risque-relance:${o.id}`,
        view: "A_RISQUE",
        title: o.title,
        rule: "Relance en retard",
        reason: `Prochaine action prévue le ${o.nextActionDate.toISOString().slice(0, 10)}, non faite depuis ${daysBetween(o.nextActionDate, today)} j.`,
        nextAction: o.nextAction ?? "Relancer le client",
        dueDate: o.nextActionDate,
        priority: 3,
      });
    else if (o.expectedCloseDate && o.expectedCloseDate < today)
      out.push({
        ...base,
        key: `risque-signature:${o.id}`,
        view: "A_RISQUE",
        title: o.title,
        rule: "Signature attendue dépassée",
        reason: `Signature attendue le ${o.expectedCloseDate.toISOString().slice(0, 10)} : date dépassée.`,
        nextAction: o.nextAction ?? "Faire le point et fixer une nouvelle date",
        dueDate: today,
        priority: 2,
      });
    else if (silent >= t.silenceDays)
      out.push({
        ...base,
        key: `risque-silence:${o.id}`,
        view: "A_RISQUE",
        title: o.title,
        rule: `Silence de ${t.silenceDays} jours ou plus`,
        reason: `Aucun échange depuis ${silent} jours.`,
        nextAction: o.nextAction ?? "Reprendre contact",
        dueDate: o.nextActionDate ?? today,
        priority: 2,
      });

    // En attente — la balle est chez le client, et la relance est planifiée (pas encore due).
    if (WAITING_STAGES.includes(o.stage) && !(o.nextActionDate && o.nextActionDate < today))
      out.push({
        ...base,
        key: `attente:${o.id}`,
        view: "EN_ATTENTE",
        title: o.title,
        rule: "Réponse client attendue",
        reason: `${o.stage === "NEGOCIATION" ? "En négociation" : "Proposition envoyée"} : réponse attendue depuis ${silent} jours.`,
        nextAction: o.nextAction ?? "Planifier une relance",
        dueDate: o.nextActionDate,
        priority: o.nextActionDate ? 1 : 2,
      });
  }

  for (const b of input.billing) {
    if (b.status === "ANNULE") continue;
    const base = { client: b.client, owner: b.owner, href: `/projets/${b.projectId}?onglet=finance` };
    if (b.status === "ATTENDU" && b.plannedDate && b.plannedDate <= addDays(today, t.billingHorizonDays)) {
      const late = b.plannedDate < today;
      out.push({
        ...base,
        key: `facturer:${b.id}`,
        view: "A_ENCAISSER",
        title: `${b.label} · ${b.project}`,
        rule: `Facture prévue sous ${t.billingHorizonDays} jours`,
        reason: late
          ? `Facture prévue le ${b.plannedDate.toISOString().slice(0, 10)}, pas encore émise.`
          : `Facture à émettre le ${b.plannedDate.toISOString().slice(0, 10)} (${euros(b.amount)}).`,
        nextAction: "Émettre la facture",
        dueDate: b.plannedDate,
        priority: late ? 3 : 2,
      });
    }
    const left = Math.round((b.amount - b.paid) * 100) / 100;
    if (b.status === "FACTURE" && left > 0) {
      const due = b.invoicedAt ? addDays(b.invoicedAt, t.paymentTermDays) : null;
      const overdue = !!due && due < today;
      out.push({
        ...base,
        key: `encaisser:${b.id}`,
        view: "A_ENCAISSER",
        title: `${b.label} · ${b.project}`,
        rule: `Facture non soldée (paiement à ${t.paymentTermDays} jours)`,
        reason: overdue
          ? `${euros(left)} non reçus, échéance de paiement dépassée de ${daysBetween(due!, today)} j.`
          : `${euros(left)} à recevoir${due ? ` d'ici le ${due.toISOString().slice(0, 10)}` : ""}.`,
        nextAction: overdue ? "Relancer le paiement" : "Surveiller l'encaissement",
        dueDate: due,
        priority: overdue ? 3 : 1,
      });
    }
  }

  for (const p of input.closedProjects) {
    if (p.satisfaction == null || p.satisfaction > t.lowSatisfaction) continue;
    if (daysBetween(p.closedAt, today) > 180) continue;
    out.push({
      key: `risque-satisfaction:${p.id}`,
      view: "A_RISQUE",
      title: p.name,
      client: p.client,
      owner: p.owner,
      href: `/projets/${p.id}`,
      rule: `Satisfaction ≤ ${t.lowSatisfaction}/5 (6 derniers mois)`,
      reason: `Projet clôturé avec une satisfaction de ${p.satisfaction}/5.`,
      nextAction: "Appeler le client pour en parler",
      dueDate: null,
      priority: 3,
    });
  }

  for (const s of input.signals)
    out.push({
      key: `developper:${s.key}`,
      view: "A_DEVELOPPER",
      title: s.title,
      client: s.client,
      owner: s.owner,
      href: s.href,
      rule:
        s.kind === "renouvellement"
          ? "Contrat à renouveler (≤ 60 jours)"
          : s.kind === "suite"
            ? "Projet réussi clôturé (≤ 120 jours)"
            : "Client sans activité (≥ 180 jours)",
      reason: s.detail,
      nextAction:
        s.kind === "renouvellement"
          ? "Préparer la proposition de renouvellement"
          : s.kind === "suite"
            ? "Proposer une suite"
            : "Reprendre des nouvelles",
      dueDate: s.date && s.kind === "renouvellement" ? s.date : null,
      priority: s.kind === "renouvellement" ? 2 : 1,
    });

  return out.sort(
    (a, b) =>
      b.priority - a.priority || (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
  );
}

export const viewLabels: Record<SituationView, string> = {
  EN_ATTENTE: "En attente",
  A_RISQUE: "À risque",
  A_ENCAISSER: "À encaisser",
  A_DEVELOPPER: "À développer",
};

export const viewDescriptions: Record<SituationView, string> = {
  EN_ATTENTE: "Nous attendons une réponse ou une validation du client ; la relance est planifiée.",
  A_RISQUE: "Relance en retard, signature dépassée, silence prolongé ou client insatisfait.",
  A_ENCAISSER: "Factures à émettre bientôt, ou émises et pas encore payées.",
  A_DEVELOPPER: "Renouvellements, suites à proposer, clients à réveiller.",
};

export const priorityWord: Record<1 | 2 | 3, string> = { 1: "Normale", 2: "Haute", 3: "Urgente" };
