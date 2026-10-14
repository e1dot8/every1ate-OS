import "server-only";
import type { DigestFrequency } from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { centsToDecimal } from "@/lib/money";
import { rateResolver, type RateOf } from "@/features/finance/time-cost";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

export async function getAgencySettings() {
  return getDb().agencySetting.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
}

/** Résout le coût horaire de chaque associé (le sien, sinon celui de l'agence). */
export async function loadRates(): Promise<{ rateOf: RateOf; anyRate: boolean }> {
  const [settings, users] = await Promise.all([
    getAgencySettings(),
    getDb().user.findMany({ where: { role: "associe" }, select: { id: true, hourlyCostCents: true } }),
  ]);
  const rates = new Map(users.map((u) => [u.id, u.hourlyCostCents]));
  return {
    rateOf: rateResolver(rates, settings.defaultHourlyCostCents),
    anyRate: settings.defaultHourlyCostCents != null || users.some((u) => u.hourlyCostCents != null),
  };
}

export type AgencyInput = { defaultHourlyCostCents: number | null; defaultWeeklyHours: number };

export async function saveAgencySettings(input: AgencyInput, actor: Actor): Promise<ServiceResult<null>> {
  if (input.defaultWeeklyHours < 1 || input.defaultWeeklyHours > 80)
    return failed("Capacité entre 1 et 80 heures par semaine.");
  const before = await getAgencySettings();
  const changes = diff(before, input);
  if (!changes.changed) return done(null);
  await getDb().agencySetting.update({ where: { id: "default" }, data: input });
  await recordAudit({
    action: "settings.agency_updated",
    actorId: actor.id,
    targetType: "agency_settings",
    ...changes,
  });
  return done(null);
}

export async function saveCashBalance(
  input: { balanceCents: number; date: Date },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const before = await getAgencySettings();
  await getDb().agencySetting.update({
    where: { id: "default" },
    data: { cashBalance: centsToDecimal(input.balanceCents), cashBalanceDate: input.date },
  });
  await recordAudit({
    action: "finance.cash_balance_updated",
    actorId: actor.id,
    targetType: "agency_settings",
    before: {
      cashBalance: before.cashBalance?.toString() ?? null,
      date: before.cashBalanceDate?.toISOString().slice(0, 10) ?? null,
    },
    after: { cashBalance: centsToDecimal(input.balanceCents), date: input.date.toISOString().slice(0, 10) },
  });
  return done(null);
}

export type AssociateInput = {
  userId: string;
  hourlyCostCents: number | null;
  weeklyCapacityHours: number | null;
};

/** Coût horaire et capacité d'un associé : données sensibles, modification journalisée. */
export async function saveAssociateSettings(
  input: AssociateInput,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const user = await db.user.findFirst({
    where: { id: input.userId, role: "associe" },
    select: { id: true, hourlyCostCents: true, weeklyCapacityHours: true },
  });
  if (!user) return failed("Associé introuvable.");
  if (input.weeklyCapacityHours != null && (input.weeklyCapacityHours < 1 || input.weeklyCapacityHours > 80))
    return failed("Capacité entre 1 et 80 heures par semaine.");
  const data = { hourlyCostCents: input.hourlyCostCents, weeklyCapacityHours: input.weeklyCapacityHours };
  const changes = diff(user, data);
  if (!changes.changed) return done(null);
  await db.user.update({ where: { id: input.userId }, data });
  await recordAudit({
    action: "settings.associate_rates",
    actorId: actor.id,
    targetType: "user",
    targetId: input.userId,
    ...changes,
  });
  return done(null);
}

export async function saveDigestPreference(
  frequency: DigestFrequency,
  actor: Actor,
): Promise<ServiceResult<null>> {
  await getDb().user.update({ where: { id: actor.id }, data: { digestFrequency: frequency } });
  await recordAudit({
    action: "settings.digest",
    actorId: actor.id,
    targetType: "user",
    targetId: actor.id,
    after: { frequency },
  });
  return done(null);
}

export async function listAssociateSettings() {
  return getDb().user.findMany({
    where: { role: "associe" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, hourlyCostCents: true, weeklyCapacityHours: true, digestFrequency: true },
  });
}
