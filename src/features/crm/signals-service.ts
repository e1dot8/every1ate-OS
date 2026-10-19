import "server-only";
/**
 * Opportunités détectées : chargement des données (requêtes groupées, sans N+1) puis règles pures
 * de `commercialSignals` (clients dormants, renouvellements, suites à proposer). Aucun état stocké,
 * aucune IA : les signaux sont recalculés à chaque affichage.
 *
 * Définitions retenues par le chargeur :
 * - Dernière activité d'une entreprise : la plus récente des dates de ses projets (création, début,
 *   fin réelle, clôture), des mises à jour de ses opportunités non archivées, des échanges du CRM et
 *   des comptes rendus (rattachés à l'entreprise, à l'un de ses projets ou à l'une de ses opportunités).
 *   Un contrat récurrent actif est une relation en cours (activité à la date du jour, ou à sa date
 *   de fin si elle est passée) : une entreprise servie chaque mois n'est jamais « dormante ».
 * - « Déjà travaillé ensemble » : au moins un projet (archivé compris) ou une opportunité gagnée.
 * - Affaire en cours : opportunité non archivée hors « Gagné » / « Perdu », ou projet non archivé
 *   ni terminé.
 * - Marge d'un projet clôturé : facturé HT − coûts engagés HT, comme la page Rentabilité (hors temps
 *   interne valorisé), arrondie au point inférieur pour ne jamais franchir le seuil par arrondi.
 */
import type { OpportunityStage, ProjectStatus } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db/client";
import { daysBetween, formatDay, parseDateInput, todayDate } from "@/lib/dates";
import { toCents } from "@/lib/money";
import {
  marginRate,
  summarize,
  type BillingLine,
  type CostLine,
  type PaymentLine,
} from "@/features/finance/calc";
import { commercialSignals, type Signal } from "@/features/crm/signals";

/** Les règles pures ne retiennent que les projets clôturés depuis 120 jours au plus. */
export const SUITE_WINDOW_DAYS = 120;

const FINISHED: ProjectStatus[] = ["TERMINE", "ARCHIVE"];
const CLOSED_STAGES: OpportunityStage[] = ["GAGNE", "PERDU"];

export type SignalProject = {
  id: string;
  name: string;
  clientId: string | null;
  status: ProjectStatus;
  archivedAt: Date | null;
  createdAt: Date;
  startDate: Date | null;
  actualEndDate: Date | null;
  closedAt: Date | null;
  clientSatisfaction: number | null;
};

export type SignalOpportunity = {
  id: string;
  clientId: string;
  stage: OpportunityStage;
  archivedAt: Date | null;
  updatedAt: Date;
};

export type SignalContract = {
  id: string;
  label: string;
  status: string;
  renewalDate: Date | null;
  endDate: Date | null;
  noticeDays: number | null;
  clientId: string;
  clientName: string;
};

export type SignalSources = {
  today: Date;
  /** Entreprises non archivées. */
  clients: { id: string; name: string }[];
  /** Projets rattachés à une entreprise (archivés compris). */
  projects: SignalProject[];
  /** Opportunités (archivées comprises : leurs échanges restent de vraies interactions). */
  opportunities: SignalOpportunity[];
  /** Dernier échange CRM par opportunité. */
  activities: { opportunityId: string; at: Date | null }[];
  /** Dernier compte rendu (non archivé) par rattachement. */
  notes: {
    clientId: string | null;
    projectId: string | null;
    opportunityId: string | null;
    at: Date | null;
  }[];
  /** Contrats récurrents actifs. */
  contracts: SignalContract[];
  /** Taux de marge (%) des projets clôturés récemment, par projet. */
  margins: Map<string, number | null>;
};

export type DetectedSignal = Signal & {
  /** Clé stable (unique dans la liste). */
  key: string;
  clientId: string | null;
  clientName: string | null;
  /** Fiche entreprise (null si l'entreprise est archivée ou introuvable). */
  clientHref: string | null;
  /** Contrat concerné (renouvellements). */
  contractHref: string | null;
  /** Nouvelle opportunité préremplie avec l'entreprise (null si l'entreprise est archivée). */
  createHref: string | null;
};

/** Jour calendaire (Paris) d'un horodatage. */
const parisDay = (at: Date) => todayDate(at);

/** La plus récente des dates connues (null si aucune). */
export function latestDate(...dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}

/** Projet clôturé (terminé ou archivé après clôture) depuis au plus `SUITE_WINDOW_DAYS` jours. */
export function recentlyClosed(p: Pick<SignalProject, "status" | "closedAt">, today: Date): boolean {
  if (!p.closedAt || !FINISHED.includes(p.status)) return false;
  const days = daysBetween(parisDay(p.closedAt), today);
  return days >= 0 && days <= SUITE_WINDOW_DAYS;
}

/**
 * Taux de marge d'un projet clôturé, défini comme sur la page Rentabilité : facturé HT − coûts
 * engagés HT, rapporté au facturé. Arrondi à l'entier inférieur ; null sans facturation.
 */
export function closedProjectMarginRate(input: {
  costs: CostLine[];
  billing: BillingLine[];
  payments: PaymentLine[];
  today: Date;
}): number | null {
  const s = summarize({ budget: null, initial: null, ...input });
  const rate = marginRate(s.billingInvoiced - s.costsCommitted, s.billingInvoiced);
  return rate == null ? null : Math.floor(rate);
}

/**
 * Les règles pures terminent le motif d'un renouvellement par une date ISO (« … avant le
 * 2026-11-03 ») : affichage à la française (« 3 nov. », « 3 nov. 2027 » hors de l'année en cours).
 * Seule l'échéance finale est reformatée, jamais un nom de client ou de contrat.
 */
export function frenchDates(text: string, today: Date): string {
  return text.replace(/(\ble )(\d{4}-\d{2}-\d{2})$/, (whole, prefix: string, iso: string) => {
    const date = parseDateInput(iso);
    return date ? `${prefix}${formatDay(date, today)}` : whole;
  });
}

const KIND_ORDER: Record<Signal["kind"], number> = { renouvellement: 0, suite: 1, dormant: 2 };

/**
 * Ordre d'affichage : renouvellements (échéance la plus proche d'abord), suites puis dormants
 * (les plus récents d'abord : les relations les plus « chaudes »).
 */
function compareSignals(a: Signal, b: Signal): number {
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  const ta = a.date?.getTime() ?? 0;
  const tb = b.date?.getTime() ?? 0;
  const byDate = a.kind === "renouvellement" ? ta - tb : tb - ta;
  return byDate || a.title.localeCompare(b.title, "fr");
}

/** Signaux enrichis (entreprise, liens d'action), triés, une seule « suite » par entreprise. */
export function detectSignals(src: SignalSources): DetectedSignal[] {
  const { today } = src;
  const active = new Map(src.clients.map((c) => [c.id, c]));
  const clientOfOpportunity = new Map(src.opportunities.map((o) => [o.id, o.clientId]));
  const clientOfProject = new Map(src.projects.map((p) => [p.id, p.clientId]));

  type Stat = { last: Date | null; open: number; running: number; worked: boolean };
  const stats = new Map<string, Stat>();
  const stat = (clientId: string) => {
    let s = stats.get(clientId);
    if (!s) stats.set(clientId, (s = { last: null, open: 0, running: 0, worked: false }));
    return s;
  };
  const touch = (clientId: string | null | undefined, ...dates: (Date | null | undefined)[]) => {
    if (!clientId) return;
    const s = stat(clientId);
    s.last = latestDate(s.last, ...dates);
  };

  for (const p of src.projects) {
    if (!p.clientId) continue;
    const s = stat(p.clientId);
    s.worked = true;
    if (!p.archivedAt && !FINISHED.includes(p.status)) s.running++;
    touch(
      p.clientId,
      parisDay(p.createdAt),
      p.startDate,
      p.actualEndDate,
      p.closedAt && parisDay(p.closedAt),
    );
  }
  for (const o of src.opportunities) {
    if (o.archivedAt) continue;
    const s = stat(o.clientId);
    if (o.stage === "GAGNE") s.worked = true;
    if (!CLOSED_STAGES.includes(o.stage)) s.open++;
    touch(o.clientId, parisDay(o.updatedAt));
  }
  for (const a of src.activities) touch(clientOfOpportunity.get(a.opportunityId), a.at && parisDay(a.at));
  // Contrat récurrent actif : relation en cours (jusqu'à sa fin si elle est déjà passée).
  for (const k of src.contracts)
    if (k.status === "ACTIF") touch(k.clientId, k.endDate && k.endDate < today ? k.endDate : today);
  for (const n of src.notes) {
    touch(n.clientId, n.at);
    if (n.projectId) touch(clientOfProject.get(n.projectId), n.at);
    if (n.opportunityId) touch(clientOfOpportunity.get(n.opportunityId), n.at);
  }

  const raw = commercialSignals({
    today,
    clients: src.clients.map((c) => {
      const s = stats.get(c.id);
      return {
        id: c.id,
        name: c.name,
        lastActivityAt: s?.last ?? null,
        openOpportunities: s?.open ?? 0,
        activeProjects: s?.running ?? 0,
        everWorked: s?.worked ?? false,
      };
    }),
    contracts: src.contracts.map((k) => ({
      id: k.id,
      label: k.label,
      clientName: k.clientName,
      status: k.status,
      renewalDate: k.renewalDate,
      endDate: k.endDate,
      noticeDays: k.noticeDays,
    })),
    closedProjects: src.projects
      .filter((p) => p.clientId && active.has(p.clientId) && recentlyClosed(p, today))
      .map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
        clientName: active.get(p.clientId!)!.name,
        closedAt: parisDay(p.closedAt!),
        satisfaction: p.clientSatisfaction,
        marginRate: src.margins.get(p.id) ?? null,
      })),
  });

  // Chaque signal désigne son sujet par son lien (fiche, contrat ou création préremplie).
  type Subject = { clientId: string; clientName: string; contractId: string | null };
  const subjects = new Map<string, Subject>();
  for (const c of src.clients) {
    const subject = { clientId: c.id, clientName: c.name, contractId: null };
    subjects.set(`/crm/clients/${c.id}`, subject);
    subjects.set(`/crm/opportunites/nouvelle?client=${c.id}`, subject);
  }
  for (const k of src.contracts)
    subjects.set(`/finance/contrats/${k.id}`, {
      clientId: k.clientId,
      clientName: k.clientName,
      contractId: k.id,
    });

  const seen = new Set<string>();
  const out: DetectedSignal[] = [];
  for (const s of [...raw].sort(compareSignals)) {
    const key = `${s.kind}:${s.href}`;
    if (seen.has(key)) continue; // plusieurs projets réussis d'une même entreprise : une seule suite
    seen.add(key);
    const subject = subjects.get(s.href);
    const known = !!subject && active.has(subject.clientId);
    out.push({
      ...s,
      detail: s.kind === "renouvellement" ? frenchDates(s.detail, today) : s.detail,
      key,
      clientId: subject?.clientId ?? null,
      clientName: subject?.clientName ?? null,
      clientHref: known ? `/crm/clients/${subject.clientId}` : null,
      contractHref: subject?.contractId ? `/finance/contrats/${subject.contractId}` : null,
      createHref: known ? `/crm/opportunites/nouvelle?client=${subject.clientId}` : null,
    });
  }
  return out;
}

/** Marges des projets donnés, en trois requêtes. */
async function loadMarginRates(projectIds: string[], today: Date): Promise<Map<string, number | null>> {
  const margins = new Map<string, number | null>();
  if (!projectIds.length) return margins;
  const db = getDb();
  const [billing, payments, costs] = await Promise.all([
    db.billingMilestone.findMany({
      where: { projectId: { in: projectIds }, archivedAt: null },
      select: { id: true, projectId: true, amount: true, status: true, plannedDate: true },
    }),
    db.paymentRecord.findMany({
      where: { projectId: { in: projectIds }, deletedAt: null },
      select: { projectId: true, amount: true, billingMilestoneId: true },
    }),
    db.costItem.findMany({
      where: { projectId: { in: projectIds }, archivedAt: null },
      select: { projectId: true, amount: true, status: true, rebillable: true },
    }),
  ]);
  for (const id of projectIds)
    margins.set(
      id,
      closedProjectMarginRate({
        billing: billing
          .filter((b) => b.projectId === id)
          .map((b) => ({
            id: b.id,
            amount: toCents(b.amount),
            status: b.status,
            plannedDate: b.plannedDate,
          })),
        payments: payments
          .filter((p) => p.projectId === id)
          .map((p) => ({ amount: toCents(p.amount), billingMilestoneId: p.billingMilestoneId })),
        costs: costs
          .filter((c) => c.projectId === id)
          .map((c) => ({ amount: toCents(c.amount), status: c.status, rebillable: c.rebillable })),
        today,
      }),
    );
  return margins;
}

/** Opportunités détectées du jour, pour tous les associés (aucune donnée privée concernée). */
export async function loadCommercialSignals(today = todayDate()): Promise<DetectedSignal[]> {
  const db = getDb();
  const [clients, projects, opportunities, activities, notes, contracts] = await Promise.all([
    db.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    db.project.findMany({
      where: { clientId: { not: null } },
      select: {
        id: true,
        name: true,
        clientId: true,
        status: true,
        archivedAt: true,
        createdAt: true,
        startDate: true,
        actualEndDate: true,
        closedAt: true,
        clientSatisfaction: true,
      },
    }),
    db.opportunity.findMany({
      select: { id: true, clientId: true, stage: true, archivedAt: true, updatedAt: true },
    }),
    db.opportunityActivity.groupBy({ by: ["opportunityId"], _max: { occurredAt: true } }),
    db.meetingNote.groupBy({
      by: ["clientId", "projectId", "opportunityId"],
      where: {
        archivedAt: null,
        OR: [{ clientId: { not: null } }, { projectId: { not: null } }, { opportunityId: { not: null } }],
      },
      _max: { occurredAt: true },
    }),
    db.recurringContract.findMany({
      where: { status: "ACTIF", archivedAt: null },
      select: {
        id: true,
        label: true,
        status: true,
        renewalDate: true,
        endDate: true,
        noticeDays: true,
        clientId: true,
        client: { select: { name: true } },
      },
    }),
  ]);
  // Marges utiles seulement pour les suites possibles : projets récents d'entreprises non archivées.
  const activeIds = new Set(clients.map((c) => c.id));
  const margins = await loadMarginRates(
    projects
      .filter((p) => p.clientId && activeIds.has(p.clientId) && recentlyClosed(p, today))
      .map((p) => p.id),
    today,
  );
  return detectSignals({
    today,
    clients,
    projects,
    opportunities,
    activities: activities.map((a) => ({ opportunityId: a.opportunityId, at: a._max.occurredAt })),
    notes: notes.map((n) => ({
      clientId: n.clientId,
      projectId: n.projectId,
      opportunityId: n.opportunityId,
      at: n._max.occurredAt,
    })),
    contracts: contracts.map(({ client, ...k }) => ({ ...k, clientName: client.name })),
    margins,
  });
}
