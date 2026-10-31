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
  splitPayments,
  treasuryForecast,
} from "@/features/finance/treasury-rules";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

// ─── Prévision ──────────────────────────────────────────────────────────────

/**
 * Trésorerie prévisionnelle sur 13 semaines, à partir des seules saisies manuelles :
 * solde bancaire, échéances non encaissées, coûts engagés non payés, contrats actifs et
 * charges fixes. Aucune connexion bancaire. Les mouvements postérieurs à la date du solde
 * (occurrences, encaissements reçus, coûts payés) s'ajoutent : ils ne sont pas dans le solde.
 * Les projets archivés restent compris : leurs échéances et coûts ouverts se règlent encore.
 */
export async function loadCashForecast(today: Date = todayDate()) {
  const db = getDb();
  const settings = await getAgencySettings();
  const startBalance = settings.cashBalance == null ? null : toCents(settings.cashBalance);
  const balanceDate = startBalance == null ? null : (settings.cashBalanceDate ?? null);
  const [billing, costs, contracts, charges] = await Promise.all([
    db.billingMilestone.findMany({
      where: { archivedAt: null, status: { not: "ANNULE" } },
      select: {
        id: true,
        label: true,
        amount: true,
        status: true,
        plannedDate: true,
        invoicedAt: true,
        project: { select: { name: true } },
        payments: { where: { deletedAt: null }, select: { amount: true, receivedAt: true } },
      },
    }),
    db.costItem.findMany({
      where: {
        archivedAt: null,
        OR: [
          { status: { in: ["ENGAGE", "FACTURE"] } },
          // Payé après la date du solde : sortie pas encore dans le solde saisi.
          ...(balanceDate ? [{ status: "PAYE" as const, paidAt: { gt: balanceDate } }] : []),
        ],
      },
      select: {
        id: true,
        description: true,
        supplier: true,
        amount: true,
        status: true,
        dueDate: true,
        invoiceDate: true,
        paidAt: true,
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
  const forecast = treasuryForecast({
    today,
    startBalance,
    balanceDate,
    billing: billing.map((b) => ({
      id: b.id,
      label: b.label,
      projectName: b.project.name,
      amount: toCents(b.amount),
      status: b.status,
      plannedDate: b.plannedDate,
      invoicedAt: b.invoicedAt,
      ...splitPayments(
        b.payments.map((p) => ({ amount: toCents(p.amount), receivedAt: p.receivedAt })),
        balanceDate,
      ),
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
      paidAt: c.paidAt,
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
    balance: startBalance == null ? null : { cents: startBalance, date: balanceDate },
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
    // Conditionnel : une charge archivée entre-temps n'est pas modifiée.
    const { count } = await db.recurringCharge.updateMany({ where: { id, archivedAt: null }, data });
    if (!count) return failed("Charge introuvable.");
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
  // Conditionnel : un double envoi n'archive (et ne journalise) qu'une seule fois.
  const { count } = await db.recurringCharge.updateMany({
    where: { id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (!count) return failed("Charge introuvable.");
  await recordAudit({
    action: "finance.recurring_charge_archived",
    actorId: actor.id,
    targetType: "recurring_charge",
    targetId: id,
    before: snapshot(before),
  });
  return done(null);
}
