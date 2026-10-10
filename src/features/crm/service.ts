import "server-only";
import type { ActivityKind, LeadSource, Prisma } from "@/generated/prisma/client";
import { diff, recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { centsToDecimal, toCents } from "@/lib/money";
import {
  DEFAULT_PROBABILITIES,
  STAGES,
  checkStageChange,
  forecast,
  stageLabels,
  type Stage,
} from "@/features/crm/rules";
import type { ServiceResult } from "@/features/projects/service";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });
const userSelect = { id: true, name: true } as const;

// ─── Réglages ───────────────────────────────────────────────────────────────

export async function getStageSettings(): Promise<Record<Stage, number>> {
  const rows = await getDb().crmStageSetting.findMany();
  const settings = { ...DEFAULT_PROBABILITIES };
  for (const r of rows) settings[r.stage] = r.probability;
  return settings;
}

export async function saveStageSettings(
  values: Partial<Record<Stage, number>>,
  actor: Actor,
): Promise<ServiceResult<null>> {
  const before = await getStageSettings();
  const after = { ...before, ...values, GAGNE: 100, PERDU: 0 };
  if (Object.values(after).some((p) => !Number.isInteger(p) || p < 0 || p > 100))
    return failed("Probabilités entre 0 et 100.");
  const db = getDb();
  await db.$transaction(
    STAGES.map((stage) =>
      db.crmStageSetting.upsert({
        where: { stage },
        create: { stage, probability: after[stage] },
        update: { probability: after[stage] },
      }),
    ),
  );
  const changes = diff(before, after);
  if (changes.changed)
    await recordAudit({
      action: "settings.crm_probabilities",
      actorId: actor.id,
      targetType: "crm_settings",
      ...changes,
    });
  return done(null);
}

// ─── Entreprises et contacts ────────────────────────────────────────────────

export async function listCrmClients(q?: string) {
  const clients = await getDb().client.findMany({
    where: { archivedAt: null, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { contacts: { where: { archivedAt: null } }, projects: true } },
      opportunities: { where: { archivedAt: null }, select: { stage: true, amount: true } },
    },
  });
  return clients.map((c) => ({
    ...c,
    openOpps: c.opportunities.filter((o) => !["GAGNE", "PERDU"].includes(o.stage)).length,
    openAmount: c.opportunities
      .filter((o) => !["GAGNE", "PERDU"].includes(o.stage))
      .reduce((n, o) => n + toCents(o.amount), 0),
  }));
}

export async function getClient(id: string) {
  return getDb().client.findUnique({
    where: { id },
    include: {
      contacts: { where: { archivedAt: null }, orderBy: { lastName: "asc" } },
      opportunities: {
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        include: { owner: { select: userSelect } },
      },
      projects: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true } },
    },
  });
}

export type ClientInput = {
  name: string;
  website: string | null;
  sector: string | null;
  address: string | null;
  notes: string | null;
};

export async function saveClient(
  id: string | null,
  input: ClientInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (id) {
    const before = await db.client.findUnique({ where: { id } });
    if (!before) return failed("Entreprise introuvable.");
    const changes = diff(before, input);
    await db.client.update({ where: { id }, data: input });
    if (changes.changed)
      await recordAudit({
        action: "client.updated",
        actorId: actor.id,
        targetType: "client",
        targetId: id,
        ...changes,
      });
    return done({ id });
  }
  const existing = await db.client.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" }, archivedAt: null },
  });
  if (existing) return failed(`L'entreprise « ${existing.name} » existe déjà.`);
  const client = await db.client.create({ data: input });
  await recordAudit({
    action: "client.created",
    actorId: actor.id,
    targetType: "client",
    targetId: client.id,
    after: { name: client.name },
  });
  return done({ id: client.id });
}

export type ContactInput = {
  firstName: string;
  lastName: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export async function saveContact(
  clientId: string,
  id: string | null,
  input: ContactInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (!(await db.client.findUnique({ where: { id: clientId } }))) return failed("Entreprise introuvable.");
  if (id) {
    const before = await db.clientContact.findFirst({ where: { id, clientId } });
    if (!before) return failed("Contact introuvable.");
    const changes = diff(before, input);
    await db.clientContact.update({ where: { id }, data: input });
    if (changes.changed)
      await recordAudit({
        action: "client.contact_updated",
        actorId: actor.id,
        targetType: "client_contact",
        targetId: id,
        ...changes,
      });
    return done({ id });
  }
  const contact = await db.clientContact.create({ data: { ...input, clientId } });
  await recordAudit({
    action: "client.contact_created",
    actorId: actor.id,
    targetType: "client_contact",
    targetId: contact.id,
    after: { name: `${input.firstName} ${input.lastName}`, clientId },
  });
  return done({ id: contact.id });
}

export async function getContact(id: string) {
  return getDb().clientContact.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } } },
  });
}

export async function archiveContact(id: string, actor: Actor): Promise<ServiceResult<{ clientId: string }>> {
  const db = getDb();
  const c = await db.clientContact.findUnique({ where: { id } });
  if (!c) return failed("Contact introuvable.");
  await db.clientContact.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({
    action: "client.contact_archived",
    actorId: actor.id,
    targetType: "client_contact",
    targetId: id,
  });
  return done({ clientId: c.clientId });
}

// ─── Opportunités ───────────────────────────────────────────────────────────

export type OpportunityFilter = { mine?: string; q?: string; closed?: boolean };

export async function listOpportunities(filter: OpportunityFilter = {}) {
  const where: Prisma.OpportunityWhereInput = { archivedAt: null };
  if (filter.mine) where.ownerId = filter.mine;
  if (filter.q)
    where.OR = [
      { title: { contains: filter.q, mode: "insensitive" } },
      { client: { name: { contains: filter.q, mode: "insensitive" } } },
    ];
  return getDb().opportunity.findMany({
    where,
    orderBy: [{ nextActionDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    include: { client: { select: { id: true, name: true } }, owner: { select: userSelect } },
  });
}

export async function getOpportunity(id: string) {
  return getDb().opportunity.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      contact: true,
      owner: { select: userSelect },
      project: { select: { id: true, name: true } },
      activities: { orderBy: { occurredAt: "desc" }, include: { author: { select: userSelect } } },
    },
  });
}

export type OpportunityInput = {
  title: string;
  clientId: string;
  contactId: string | null;
  ownerId: string;
  source: LeadSource | null;
  amountCents: number | null;
  probability: number | null;
  expectedCloseDate: Date | null;
  nextAction: string | null;
  nextActionDate: Date | null;
};

export async function saveOpportunity(
  id: string | null,
  input: OpportunityInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  if (!(await db.user.findFirst({ where: { id: input.ownerId, role: "associe" } })))
    return failed("Responsable commercial invalide.");
  if (!(await db.client.findUnique({ where: { id: input.clientId } })))
    return failed("Entreprise introuvable.");
  if (
    input.contactId &&
    !(await db.clientContact.findFirst({ where: { id: input.contactId, clientId: input.clientId } }))
  )
    return failed("Ce contact n'appartient pas à l'entreprise choisie.");
  if (input.nextAction && !input.nextActionDate)
    return failed("Indiquez la date de relance de la prochaine action.");
  const { amountCents, ...rest } = input;
  const data = { ...rest, amount: amountCents == null ? null : centsToDecimal(amountCents) };
  if (id) {
    const before = await db.opportunity.findUnique({ where: { id } });
    if (!before) return failed("Opportunité introuvable.");
    const changes = diff({ ...before, amount: before.amount?.toString() ?? null }, data);
    await db.opportunity.update({ where: { id }, data });
    if (changes.changed)
      await recordAudit({
        action: "opportunity.updated",
        actorId: actor.id,
        targetType: "opportunity",
        targetId: id,
        ...changes,
      });
    return done({ id });
  }
  const opp = await db.opportunity.create({
    data: {
      ...data,
      createdById: actor.id,
      activities: {
        create: { kind: "ETAPE", toStage: "A_CONTACTER", authorId: actor.id, body: "Opportunité créée" },
      },
    },
  });
  await recordAudit({
    action: "opportunity.created",
    actorId: actor.id,
    targetType: "opportunity",
    targetId: opp.id,
    after: { title: opp.title },
  });
  return done({ id: opp.id });
}

export async function changeStage(
  id: string,
  to: Stage,
  details: { lossReason: string | null; note: string | null },
  actor: Actor,
): Promise<ServiceResult<{ suggestConversion: boolean }>> {
  const db = getDb();
  const opp = await db.opportunity.findUnique({ where: { id } });
  if (!opp || opp.archivedAt) return failed("Opportunité introuvable.");
  if (opp.stage === to) return done({ suggestConversion: to === "GAGNE" && !opp.projectId });
  const check = checkStageChange(opp.stage, to, { converted: !!opp.projectId });
  if (!check.ok) return failed(check.error);
  const closing = to === "GAGNE" || to === "PERDU";
  await db.$transaction([
    db.opportunity.update({
      where: { id },
      data: {
        stage: to,
        closedAt: closing ? new Date() : null,
        lossReason: to === "PERDU" ? details.lossReason : null,
      },
    }),
    db.opportunityActivity.create({
      data: {
        opportunityId: id,
        kind: "ETAPE",
        fromStage: opp.stage,
        toStage: to,
        authorId: actor.id,
        body:
          [to === "PERDU" && details.lossReason ? `Motif : ${details.lossReason}` : null, details.note]
            .filter(Boolean)
            .join(" — ") || null,
      },
    }),
  ]);
  await recordAudit({
    action: "opportunity.stage_changed",
    actorId: actor.id,
    targetType: "opportunity",
    targetId: id,
    before: { stage: stageLabels[opp.stage] },
    after: { stage: stageLabels[to] },
    reason: details.lossReason ?? undefined,
  });
  return done({ suggestConversion: to === "GAGNE" && !opp.projectId });
}

export async function addActivity(
  id: string,
  input: { kind: ActivityKind; body: string; occurredAt: Date; fileUrl: string | null },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const opp = await db.opportunity.findUnique({ where: { id } });
  if (!opp || opp.archivedAt) return failed("Opportunité introuvable.");
  if (input.kind === "ETAPE") return failed("Utilisez le changement d'étape.");
  await db.opportunityActivity.create({ data: { ...input, opportunityId: id, authorId: actor.id } });
  await recordAudit({
    action: "opportunity.activity_added",
    actorId: actor.id,
    targetType: "opportunity",
    targetId: id,
    after: { kind: input.kind },
  });
  return done(null);
}

export async function setNextAction(
  id: string,
  input: { nextAction: string | null; nextActionDate: Date | null },
  actor: Actor,
): Promise<ServiceResult<null>> {
  const db = getDb();
  const opp = await db.opportunity.findUnique({ where: { id } });
  if (!opp) return failed("Opportunité introuvable.");
  if (input.nextAction && !input.nextActionDate) return failed("Indiquez la date de relance.");
  const changes = diff(opp, input);
  if (!changes.changed) return done(null);
  await db.opportunity.update({ where: { id }, data: input });
  await recordAudit({
    action: "opportunity.next_action",
    actorId: actor.id,
    targetType: "opportunity",
    targetId: id,
    ...changes,
  });
  return done(null);
}

export async function archiveOpportunity(id: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const opp = await db.opportunity.findUnique({ where: { id } });
  if (!opp) return failed("Opportunité introuvable.");
  await db.opportunity.update({ where: { id }, data: { archivedAt: new Date() } });
  await recordAudit({
    action: "opportunity.archived",
    actorId: actor.id,
    targetType: "opportunity",
    targetId: id,
    before: { title: opp.title },
  });
  return done(null);
}

export async function crmForecast(mine?: string) {
  const [opps, settings] = await Promise.all([listOpportunities({ mine }), getStageSettings()]);
  const f = forecast(
    opps.map((o) => ({
      id: o.id,
      stage: o.stage,
      amountCents: toCents(o.amount),
      probability: o.probability,
      nextActionDate: o.nextActionDate,
    })),
    settings,
    todayDate(),
  );
  return { ...f, opps, settings };
}

/** Opportunités dont la relance est due : utilisé par la passe planifiée. */
export async function dueFollowUps(today: Date) {
  return getDb().opportunity.findMany({
    where: { archivedAt: null, stage: { notIn: ["GAGNE", "PERDU"] }, nextActionDate: { lte: today } },
    select: { id: true, title: true, ownerId: true, nextAction: true, nextActionDate: true },
  });
}
