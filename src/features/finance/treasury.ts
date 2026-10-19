import "server-only";
import type { ChargeFrequency } from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { toDateInput, todayDate } from "@/lib/dates";
import { centsToDecimal, toCents } from "@/lib/money";
import { getAgencySettings } from "@/features/settings/service";
import type { ServiceResult } from "@/features/projects/service";
import {
  chargeIssue,
  chargeNextDate,
  chargesMonthlyTotal,
  monthlyEquivalent,
  treasuryForecast,
} from "@/features/finance/treasury-rules";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

// ─── Prévision ──────────────────────────────────────────────────────────────

/**
 * Trésorerie prévisionnelle sur 13 semaines, à partir des seules saisies manuelles :
 * solde bancaire, échéances non encaissées, coûts engagés non payés, contrats actifs et
 * charges fixes. Aucune connexion bancaire.
 */
export async function loadCashForecast(today: Date = todayDate()) {
  const db = getDb();
  const [settings, billing, costs, contracts, charges] = await Promise.all([
    getAgencySettings(),
    db.billingMilestone.findMany({
      where: { archivedAt: null, status: { not: "ANNULE" }, project: { archivedAt: null } },
      select: {
        id: true,
        label: true,
        amount: true,
        status: true,
        plannedDate: true,
        invoicedAt: true,
        project: { select: { name: true } },
        payments: { where: { deletedAt: null }, select: { amount: true } },
      },
    }),
    db.costItem.findMany({
      where: { archivedAt: null, status: { in: ["ENGAGE", "FACTURE"] }, project: { archivedAt: null } },
      select: {
        id: true,
        description: true,
        supplier: true,
        amount: true,
        status: true,
        dueDate: true,
        invoiceDate: true,
        project: { select: { name: true } },
      },
    }),
    db.recurringContract.findMany({
      where: { archivedAt: null, status: "ACTIF" },
      select: {
        id: true,
        label: true,
        monthlyAmount: true,
        startDate: true,
        endDate: true,
        status: true,
        client: { select: { name: true } },
      },
    }),
    db.recurringCharge.findMany({
      where: { archivedAt: null },
      select: { id: true, label: true, amount: true, frequency: true, nextDate: true, endDate: true },
    }),
  ]);
  const startBalance = settings.cashBalance == null ? null : toCents(settings.cashBalance);
  const forecast = treasuryForecast({
    today,
    startBalance,
    billing: billing.map((b) => ({
      id: b.id,
      label: b.label,
      projectName: b.project.name,
      amount: toCents(b.amount),
      status: b.status,
      plannedDate: b.plannedDate,
      invoicedAt: b.invoicedAt,
      paid: b.payments.reduce((n, p) => n + toCents(p.amount), 0),
    })),
    costs: costs.map((c) => ({
      id: c.id,
      description: c.description,
      supplier: c.supplier,
      projectName: c.project.name,
      amount: toCents(c.amount),
      status: c.status,
      dueDate: c.dueDate,
      invoiceDate: c.invoiceDate,
    })),
    contracts: contracts.map((c) => ({
      id: c.id,
      label: `${c.label} · ${c.client.name}`,
      monthlyAmount: toCents(c.monthlyAmount),
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
    })),
    charges: charges.map((c) => ({
      id: c.id,
      label: c.label,
      amount: toCents(c.amount),
      frequency: c.frequency,
      nextDate: c.nextDate,
      endDate: c.endDate,
    })),
  });
  return {
    today,
    forecast,
    balance: startBalance == null ? null : { cents: startBalance, date: settings.cashBalanceDate ?? null },
  };
}

// ─── Charges fixes ──────────────────────────────────────────────────────────

export type ChargeInput = {
  label: string;
  category: string | null;
  amount: number;
  frequency: ChargeFrequency;
  nextDate: Date;
  endDate: Date | null;
};

type ChargeRecord = {
  label: string;
  category: string | null;
  amount: { toString(): string };
  frequency: ChargeFrequency;
  nextDate: Date;
  endDate: Date | null;
};

/** Valeurs journalisées (montant en décimal, dates en AAAA-MM-JJ). */
const snapshot = (c: ChargeRecord) => ({
  label: c.label,
  category: c.category,
  amount: centsToDecimal(toCents(c.amount)),
  frequency: c.frequency,
  nextDate: toDateInput(c.nextDate),
  endDate: c.endDate ? toDateInput(c.endDate) : null,
});

export async function listCharges(today: Date = todayDate()) {
  const rows = await getDb().recurringCharge.findMany({
    where: { archivedAt: null },
    orderBy: { label: "asc" },
  });
  // Tri par prochaine échéance réelle (la date saisie peut être passée) ; terminées en dernier.
  const time = (d: Date | null) => d?.getTime() ?? Number.POSITIVE_INFINITY;
  const charges = rows.map((c) => {
    const amount = toCents(c.amount);
    const next = chargeNextDate(c, today);
    return {
      id: c.id,
      label: c.label,
      category: c.category,
      amount,
      frequency: c.frequency,
      nextDate: c.nextDate,
      endDate: c.endDate,
      upcoming: next,
      monthly: monthlyEquivalent(amount, c.frequency),
    };
  });
  charges.sort((a, b) => {
    const [x, y] = [time(a.upcoming), time(b.upcoming)];
    return x === y ? 0 : x < y ? -1 : 1;
  });
  return {
    charges,
    monthlyTotal: chargesMonthlyTotal(charges, today),
  };
}

export async function getCharge(id: string) {
  return getDb().recurringCharge.findUnique({ where: { id } });
}

export async function saveCharge(
  id: string | null,
  input: ChargeInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const issue = chargeIssue(input);
  if (issue) return failed(issue);
  const db = getDb();
  const data = { ...input, amount: centsToDecimal(input.amount) };
  if (id) {
    const before = await db.recurringCharge.findUnique({ where: { id } });
    if (!before || before.archivedAt) return failed("Charge introuvable.");
    const changes = diff(snapshot(before), snapshot(data));
    if (!changes.changed) return done({ id });
    await db.recurringCharge.update({ where: { id }, data });
    await recordAudit({
      action: "finance.recurring_charge_updated",
      actorId: actor.id,
      targetType: "recurring_charge",
      targetId: id,
      before: changes.before,
      after: changes.after,
    });
    return done({ id });
  }
  const created = await db.recurringCharge.create({ data });
  await recordAudit({
    action: "finance.recurring_charge_created",
    actorId: actor.id,
    targetType: "recurring_charge",
    targetId: created.id,
    after: snapshot(created),
  });
  return done({ id: created.id });
}

export async function archiveCharge(id: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const before = await db.recurringCharge.findUnique({ where: { id } });
  if (!before || before.archivedAt) return failed("Charge introuvable.");
  await db.recurringCharge.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({
    action: "finance.recurring_charge_archived",
    actorId: actor.id,
    targetType: "recurring_charge",
    targetId: id,
    before: snapshot(before),
  });
  return done(null);
}
