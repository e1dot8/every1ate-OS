import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import type { ServiceResult } from "@/features/projects/service";
import { getAgencySettings } from "@/features/settings/service";
import { loadCommercialSignals } from "@/features/crm/signals-service";
import { detectSituations, type Thresholds } from "@/features/crm/situations";

export async function getThresholds(): Promise<Thresholds> {
  const s = await getAgencySettings();
  return {
    silenceDays: s.crmSilenceDays,
    paymentTermDays: s.crmPaymentTermDays,
    billingHorizonDays: s.crmBillingHorizonDays,
    lowSatisfaction: s.crmLowSatisfaction,
  };
}

export async function saveThresholds(t: Thresholds, actor: { id: string }): Promise<ServiceResult<null>> {
  const before = await getThresholds();
  await getDb().agencySetting.update({
    where: { id: "default" },
    data: {
      crmSilenceDays: t.silenceDays,
      crmPaymentTermDays: t.paymentTermDays,
      crmBillingHorizonDays: t.billingHorizonDays,
      crmLowSatisfaction: t.lowSatisfaction,
    },
  });
  await recordAudit({
    action: "settings.crm_situations",
    actorId: actor.id,
    targetType: "agency_setting",
    targetId: "default",
    before,
    after: t,
  });
  return { ok: true, data: null };
}

const person = { select: { id: true, name: true } } as const;

/** Les quatre vues de La Salle, calculées à partir des données existantes (aucune étiquette manuelle). */
export async function loadSituations(today = todayDate()) {
  const db = getDb();
  const [thresholds, opportunities, billing, closed, signals] = await Promise.all([
    getThresholds(),
    db.opportunity.findMany({
      where: { archivedAt: null, stage: { notIn: ["GAGNE", "PERDU"] } },
      select: {
        id: true,
        title: true,
        stage: true,
        nextAction: true,
        nextActionDate: true,
        expectedCloseDate: true,
        createdAt: true,
        client: { select: { name: true } },
        owner: person,
        activities: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
      },
    }),
    db.billingMilestone.findMany({
      where: { archivedAt: null, status: { in: ["ATTENDU", "FACTURE"] }, project: { internal: false } },
      select: {
        id: true,
        label: true,
        status: true,
        plannedDate: true,
        invoicedAt: true,
        amount: true,
        projectId: true,
        project: { select: { name: true, client: { select: { name: true } }, owner: person } },
        payments: { where: { deletedAt: null }, select: { amount: true } },
      },
    }),
    db.project.findMany({
      where: { internal: false, closedAt: { not: null }, clientSatisfaction: { not: null } },
      select: {
        id: true,
        name: true,
        closedAt: true,
        clientSatisfaction: true,
        client: { select: { name: true } },
        owner: person,
      },
    }),
    loadCommercialSignals(today),
  ]);

  // Responsable d'une suite commerciale : celui du dernier projet ou de la dernière opportunité du client.
  const clientIds = [...new Set(signals.map((s) => s.clientId).filter(Boolean) as string[])];
  const [lastProjects, lastOpps] = await Promise.all([
    db.project.findMany({
      where: { clientId: { in: clientIds } },
      orderBy: { updatedAt: "desc" },
      select: { clientId: true, owner: person },
    }),
    db.opportunity.findMany({
      where: { clientId: { in: clientIds } },
      orderBy: { updatedAt: "desc" },
      select: { clientId: true, owner: person },
    }),
  ]);
  const ownerOf = new Map<string, { id: string; name: string }>();
  for (const r of [...lastOpps, ...lastProjects])
    if (r.clientId && !ownerOf.has(r.clientId)) ownerOf.set(r.clientId, r.owner);

  const situations = detectSituations(
    {
      today,
      opportunities: opportunities.map((o) => ({
        ...o,
        client: o.client.name,
        lastActivityAt: o.activities[0]?.occurredAt ?? null,
      })),
      billing: billing.map((b) => ({
        id: b.id,
        label: b.label,
        projectId: b.projectId,
        project: b.project.name,
        client: b.project.client?.name ?? null,
        owner: b.project.owner,
        status: b.status,
        plannedDate: b.plannedDate,
        invoicedAt: b.invoicedAt,
        amount: Number(b.amount),
        paid: b.payments.reduce((n, p) => n + Number(p.amount), 0),
      })),
      closedProjects: closed.map((p) => ({
        id: p.id,
        name: p.name,
        client: p.client?.name ?? null,
        owner: p.owner,
        closedAt: p.closedAt!,
        satisfaction: p.clientSatisfaction,
      })),
      signals: signals.map((s) => ({
        key: s.key,
        kind: s.kind,
        title: s.title,
        detail: s.detail,
        client: s.clientName,
        owner: s.clientId ? (ownerOf.get(s.clientId) ?? null) : null,
        href: s.createHref ?? s.contractHref ?? s.clientHref ?? s.href,
        date: s.date,
      })),
    },
    thresholds,
  );
  return { thresholds, situations };
}
