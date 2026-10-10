import "server-only";
import type {
  BillingKind,
  BillingStatus,
  ContractStatus,
  CostStatus,
  PricingMode,
} from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { centsToDecimal, toCents } from "@/lib/money";
import { budgetRuleTriggered, mrr, summarize, type Budget } from "@/features/finance/calc";
import { announceDecision, createDecision, getGovernance } from "@/features/finance/governance";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });
const dec = (cents: number | null) => (cents == null ? null : centsToDecimal(cents));

// ─── Lecture : synthèse projet et lots ──────────────────────────────────────

type Revision = {
  workPackageId: string | null;
  status: string;
  isInitial: boolean;
  plannedRevenue: unknown;
  plannedCost: unknown;
  createdAt: Date;
};

function budgetsFor(
  revisions: Revision[],
  workPackageId: string | null,
): { current: Budget; initial: Budget } {
  const scope = revisions.filter((r) => r.workPackageId === workPackageId && r.status === "APPLIQUEE");
  const toBudget = (r?: Revision): Budget =>
    r ? { revenue: toCents(r.plannedRevenue as string), cost: toCents(r.plannedCost as string) } : null;
  const sorted = [...scope].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return {
    current: toBudget(sorted.at(-1)),
    initial: toBudget(sorted.find((r) => r.isInitial) ?? sorted[0]),
  };
}

export async function projectFinance(projectId: string) {
  const db = getDb();
  const [project, revisions, costs, billing, payments, lots] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, archivedAt: true, clientId: true },
    }),
    db.budgetRevision.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { decision: { select: { id: true, status: true } } },
    }),
    db.costItem.findMany({
      where: { projectId, archivedAt: null },
      orderBy: [{ invoiceDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      include: { workPackage: { select: { name: true } } },
    }),
    db.billingMilestone.findMany({
      where: { projectId, archivedAt: null },
      orderBy: [{ plannedDate: { sort: "asc", nulls: "last" } }],
      include: { payments: { where: { deletedAt: null } } },
    }),
    db.paymentRecord.findMany({ where: { projectId, deletedAt: null }, orderBy: { receivedAt: "desc" } }),
    db.workPackage.findMany({
      where: { projectId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!project) return null;
  const today = todayDate();
  const costLines = costs.map((c) => ({
    amount: toCents(c.amount),
    status: c.status,
    rebillable: c.rebillable,
    workPackageId: c.workPackageId,
  }));
  const billingLines = billing.map((b) => ({
    id: b.id,
    amount: toCents(b.amount),
    status: b.status,
    plannedDate: b.plannedDate,
    workPackageId: b.workPackageId,
  }));
  const paymentLines = payments.map((p) => ({
    amount: toCents(p.amount),
    billingMilestoneId: p.billingMilestoneId,
  }));
  const projectBudget = budgetsFor(revisions, null);
  const summary = summarize({
    budget: projectBudget.current,
    initial: projectBudget.initial,
    costs: costLines,
    billing: billingLines,
    payments: paymentLines,
    today,
  });
  const byLot = lots.map((l) => {
    const b = budgetsFor(revisions, l.id);
    const lotBilling = billingLines.filter((x) => x.workPackageId === l.id);
    const ids = new Set(lotBilling.map((x) => x.id));
    return {
      ...l,
      summary: summarize({
        budget: b.current,
        initial: b.initial,
        costs: costLines.filter((c) => c.workPackageId === l.id),
        billing: lotBilling,
        payments: paymentLines.filter((p) => p.billingMilestoneId && ids.has(p.billingMilestoneId)),
        today,
      }),
    };
  });
  const minutes = await db.timeEntry.aggregate({
    where: { projectId, deletedAt: null },
    _sum: { durationMinutes: true },
  });
  return {
    project,
    revisions,
    costs,
    billing,
    payments,
    lots,
    summary,
    byLot,
    today,
    minutes: minutes._sum.durationMinutes ?? 0,
  };
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export type BudgetInput = {
  workPackageId: string | null;
  revenue: number;
  cost: number;
  pricingMode: PricingMode | null;
  reason: string | null;
};

/**
 * Le premier budget d'un périmètre est le budget initial. Les révisions suivantes sont
 * historisées ; au-delà du seuil de dépassement, une décision collective est demandée et,
 * si la règle est bloquante, la révision attend l'approbation (§10.2, §14).
 */
export async function proposeBudget(
  projectId: string,
  input: BudgetInput,
  actor: Actor,
): Promise<ServiceResult<{ pendingDecision: string | null }>> {
  const db = getDb();
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project || project.archivedAt) return failed("Projet introuvable.");
  if (
    input.workPackageId &&
    !(await db.workPackage.findFirst({ where: { id: input.workPackageId, projectId } }))
  )
    return failed("Lot invalide.");
  const revisions = await db.budgetRevision.findMany({ where: { projectId } });
  if (revisions.some((r) => r.workPackageId === input.workPackageId && r.status === "EN_ATTENTE"))
    return failed("Une révision attend déjà une décision pour ce périmètre.");
  const { current, initial } = budgetsFor(revisions, input.workPackageId);
  const isInitial = !current;
  if (!isInitial && !input.reason) return failed("Indiquez le motif de la révision.");

  const rules = await getGovernance();
  const check = isInitial
    ? { triggered: false, pct: null }
    : budgetRuleTriggered(initial?.cost ?? null, input.cost, rules);
  const scope = input.workPackageId ? "lot" : "projet";
  let decisionId: string | null = null;
  if (check.triggered) {
    const decision = await createDecision(
      {
        projectId,
        kind: "BUDGET",
        title: `Dépassement de budget (${scope}) : ${project.name}`,
        explanation: `Coûts prévus portés à ${(input.cost / 100).toLocaleString("fr-FR")} € HT, soit +${check.pct} % par rapport au budget de référence. Motif : ${input.reason}`,
        consequences: rules.blocking
          ? "La révision ne s'applique qu'après approbation."
          : "La révision est appliquée ; la décision documente le dépassement.",
        before: { revenue: centsToDecimal(current!.revenue), cost: centsToDecimal(current!.cost) },
        after: { revenue: centsToDecimal(input.revenue), cost: centsToDecimal(input.cost) },
      },
      actor,
    );
    decisionId = decision.id;
  }
  const revision = await db.budgetRevision.create({
    data: {
      projectId,
      workPackageId: input.workPackageId,
      isInitial,
      plannedRevenue: centsToDecimal(input.revenue),
      plannedCost: centsToDecimal(input.cost),
      pricingMode: input.pricingMode,
      reason: input.reason ?? (isInitial ? "Budget initial" : null),
      status: decisionId && rules.blocking ? "EN_ATTENTE" : "APPLIQUEE",
      decisionId,
      createdById: actor.id,
    },
  });
  await recordAudit({
    action: isInitial ? "finance.budget_initial" : "finance.budget_revised",
    actorId: actor.id,
    projectId,
    targetType: "budget_revision",
    targetId: revision.id,
    before: current
      ? { revenue: centsToDecimal(current.revenue), cost: centsToDecimal(current.cost) }
      : undefined,
    after: {
      revenue: centsToDecimal(input.revenue),
      cost: centsToDecimal(input.cost),
      scope,
      status: revision.status,
    },
    reason: input.reason ?? undefined,
  });
  if (decisionId) await announceDecision(decisionId, actor);
  return done({ pendingDecision: decisionId });
}

// ─── Coûts ──────────────────────────────────────────────────────────────────

export type CostInput = {
  workPackageId: string | null;
  supplier: string | null;
  description: string;
  category: string | null;
  pricingMode: PricingMode;
  quantity: string | null;
  unit: string | null;
  unitRate: number | null;
  amount: number;
  vatAmount: number | null;
  amountTTC: number | null;
  status: CostStatus;
  committedAt: Date | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  documentRef: string | null;
  rebillable: boolean;
};

export async function saveCost(
  projectId: string,
  id: string | null,
  input: CostInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (
    input.workPackageId &&
    !(await db.workPackage.findFirst({ where: { id: input.workPackageId, projectId } }))
  )
    return failed("Lot invalide.");
  if (input.status === "PAYE" && !input.paidAt) return failed("Indiquez la date de paiement.");
  const data = {
    ...input,
    amount: centsToDecimal(input.amount),
    unitRate: dec(input.unitRate),
    vatAmount: dec(input.vatAmount),
    amountTTC: dec(input.amountTTC),
    committedAt:
      input.committedAt ?? (input.status !== "PREVU" && input.status !== "ANNULE" ? todayDate() : null),
  };
  if (id) {
    const before = await db.costItem.findFirst({ where: { id, projectId } });
    if (!before) return failed("Coût introuvable.");
    const norm = {
      ...before,
      amount: before.amount.toString(),
      unitRate: before.unitRate?.toString() ?? null,
      vatAmount: before.vatAmount?.toString() ?? null,
      amountTTC: before.amountTTC?.toString() ?? null,
      quantity: before.quantity?.toString() ?? null,
    };
    const changes = diff(norm, data);
    await db.costItem.update({ where: { id }, data });
    if (changes.changed)
      await recordAudit({
        action: "finance.cost_updated",
        actorId: actor.id,
        projectId,
        targetType: "cost",
        targetId: id,
        ...changes,
      });
    return done({ id });
  }
  const cost = await db.costItem.create({ data: { ...data, projectId, createdById: actor.id } });
  await recordAudit({
    action: "finance.cost_saved",
    actorId: actor.id,
    projectId,
    targetType: "cost",
    targetId: cost.id,
    after: { description: cost.description, amount: cost.amount.toString(), status: cost.status },
  });
  return done({ id: cost.id });
}

export async function getCost(id: string) {
  return getDb().costItem.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true } } },
  });
}

export async function archiveCost(id: string, actor: Actor): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const c = await db.costItem.findUnique({ where: { id } });
  if (!c) return failed("Coût introuvable.");
  await db.costItem.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({
    action: "finance.cost_archived",
    actorId: actor.id,
    projectId: c.projectId,
    targetType: "cost",
    targetId: id,
    before: { description: c.description, amount: c.amount.toString() },
  });
  return done({ projectId: c.projectId });
}

// ─── Échéancier et encaissements ────────────────────────────────────────────

export type BillingInput = {
  workPackageId: string | null;
  label: string;
  kind: BillingKind;
  plannedDate: Date | null;
  amount: number;
  vatAmount: number | null;
  status: BillingStatus;
  invoiceRef: string | null;
  invoiceUrl: string | null;
  invoicedAt: Date | null;
};

export async function saveBilling(
  projectId: string,
  id: string | null,
  input: BillingInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (
    input.workPackageId &&
    !(await db.workPackage.findFirst({ where: { id: input.workPackageId, projectId } }))
  )
    return failed("Lot invalide.");
  const data = {
    ...input,
    amount: centsToDecimal(input.amount),
    vatAmount: dec(input.vatAmount),
    invoicedAt: input.invoicedAt ?? (input.status === "FACTURE" ? todayDate() : null),
  };
  if (id) {
    const before = await db.billingMilestone.findFirst({ where: { id, projectId } });
    if (!before) return failed("Échéance introuvable.");
    const changes = diff(
      { ...before, amount: before.amount.toString(), vatAmount: before.vatAmount?.toString() ?? null },
      data,
    );
    await db.billingMilestone.update({ where: { id }, data });
    if (changes.changed)
      await recordAudit({
        action: "finance.billing_saved",
        actorId: actor.id,
        projectId,
        targetType: "billing",
        targetId: id,
        ...changes,
      });
    return done({ id });
  }
  const m = await db.billingMilestone.create({ data: { ...data, projectId } });
  await recordAudit({
    action: "finance.billing_saved",
    actorId: actor.id,
    projectId,
    targetType: "billing",
    targetId: m.id,
    after: { label: m.label, amount: m.amount.toString() },
  });
  return done({ id: m.id });
}

export async function getBilling(id: string) {
  return getDb().billingMilestone.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      payments: { where: { deletedAt: null }, orderBy: { receivedAt: "asc" } },
    },
  });
}

export async function recordPayment(
  projectId: string,
  input: { billingMilestoneId: string | null; amount: number; receivedAt: Date; reference: string | null },
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (input.amount <= 0) return failed("Montant encaissé positif requis.");
  if (
    input.billingMilestoneId &&
    !(await db.billingMilestone.findFirst({ where: { id: input.billingMilestoneId, projectId } }))
  )
    return failed("Échéance invalide.");
  const p = await db.paymentRecord.create({
    data: { ...input, amount: centsToDecimal(input.amount), projectId, createdById: actor.id },
  });
  await recordAudit({
    action: "finance.payment_recorded",
    actorId: actor.id,
    projectId,
    targetType: "payment",
    targetId: p.id,
    after: { amount: p.amount.toString(), receivedAt: input.receivedAt.toISOString() },
  });
  return done({ id: p.id });
}

export async function deletePayment(id: string, actor: Actor): Promise<ServiceResult<{ projectId: string }>> {
  const db = getDb();
  const p = await db.paymentRecord.findUnique({ where: { id } });
  if (!p || p.deletedAt) return failed("Encaissement introuvable.");
  await db.paymentRecord.update({ where: { id }, data: { deletedAt: new Date() } });
  await recordAudit({
    action: "finance.payment_deleted",
    actorId: actor.id,
    projectId: p.projectId,
    targetType: "payment",
    targetId: id,
    before: { amount: p.amount.toString() },
  });
  return done({ projectId: p.projectId });
}

// ─── Contrats récurrents ────────────────────────────────────────────────────

export type ContractInput = {
  clientId: string;
  projectId: string | null;
  label: string;
  monthlyAmount: number;
  startDate: Date;
  endDate: Date | null;
  durationMonths: number | null;
  status: ContractStatus;
  renewalDate: Date | null;
  noticeDays: number | null;
  notes: string | null;
};

export async function saveContract(
  id: string | null,
  input: ContractInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (input.endDate && input.endDate < input.startDate) return failed("La fin précède le début.");
  if (!(await db.client.findUnique({ where: { id: input.clientId } }))) return failed("Client introuvable.");
  const data = { ...input, monthlyAmount: centsToDecimal(input.monthlyAmount) };
  if (id) {
    const before = await db.recurringContract.findUnique({ where: { id } });
    if (!before) return failed("Contrat introuvable.");
    const changes = diff({ ...before, monthlyAmount: before.monthlyAmount.toString() }, data);
    await db.recurringContract.update({ where: { id }, data });
    if (changes.changed)
      await recordAudit({
        action: "finance.contract_updated",
        actorId: actor.id,
        targetType: "contract",
        targetId: id,
        ...changes,
      });
    return done({ id });
  }
  const c = await db.recurringContract.create({ data });
  await recordAudit({
    action: "finance.contract_created",
    actorId: actor.id,
    targetType: "contract",
    targetId: c.id,
    after: { label: c.label, monthlyAmount: c.monthlyAmount.toString() },
  });
  return done({ id: c.id });
}

export async function listContracts() {
  const contracts = await getDb().recurringContract.findMany({
    where: { archivedAt: null },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    include: { client: { select: { id: true, name: true } }, project: { select: { id: true, name: true } } },
  });
  const today = todayDate();
  return {
    contracts,
    mrr: mrr(
      contracts.map((c) => ({ ...c, monthlyAmount: toCents(c.monthlyAmount) })),
      today,
    ),
  };
}

export async function getContract(id: string) {
  return getDb().recurringContract.findUnique({ where: { id } });
}

// ─── Vue agence ─────────────────────────────────────────────────────────────

export async function financeOverview() {
  const projects = await getDb().project.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, client: { select: { name: true } } },
  });
  const rows = [];
  for (const p of projects) {
    const f = await projectFinance(p.id);
    if (f) rows.push({ ...p, summary: f.summary });
  }
  return rows;
}
