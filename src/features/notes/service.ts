import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { diff, recordAudit, type AuditAction } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import { getEvent } from "@/features/calendar/service";
import { addActivity } from "@/features/crm/service";
import { notify } from "@/features/notifications/service";
import { suggestPriority } from "@/features/planning/rules";
import type { ServiceResult } from "@/features/projects/service";
import { markLinesDone, parseActions, reconcileActions } from "@/features/notes/parse";
import { CLOSED_PROJECT_STATUSES, canReceiveTasks } from "@/features/notes/rules";

type Actor = { id: string };
const done = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
const failed = (error: string): ServiceResult<never> => ({ ok: false, error });

/** Action journalisée pour chaque lot de tâches créé depuis un compte rendu (sert aussi aux liens). */
const FROM_NOTE: AuditAction = "task.created_from_note";
const TASK_CREATED: AuditAction = "task.created";

const userSelect = { id: true, name: true } as const;
/** Jusqu'à 100 actions par envoi, et un second envoi simultané attend le verrou du premier. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

// ─── Lectures ───────────────────────────────────────────────────────────────

export type NoteFilter = {
  projectId?: string;
  clientId?: string;
  opportunityId?: string;
  eventId?: string;
  take?: number;
};

/** Comptes rendus non archivés, du plus récent au plus ancien, avec le nombre d'actions à traiter. */
export async function listNotes(filter: NoteFilter = {}) {
  const db = getDb();
  const people = await db.user.findMany({ where: { role: "associe" }, select: userSelect });
  const notes = await db.meetingNote.findMany({
    where: {
      archivedAt: null,
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
      ...(filter.opportunityId ? { opportunityId: filter.opportunityId } : {}),
      ...(filter.eventId ? { eventId: filter.eventId } : {}),
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: filter.take ?? 100,
    select: {
      id: true,
      title: true,
      body: true,
      occurredAt: true,
      createdTasks: true,
      author: { select: userSelect },
      project: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true } },
    },
  });
  const today = todayDate();
  // Le titre d'un événement privé n'est jamais exposé ici : seul le lien vers l'événement l'est.
  return notes.map(({ body, ...n }) => ({ ...n, pendingActions: parseActions(body, people, today).length }));
}

export async function getNote(id: string) {
  return getDb().meetingNote.findUnique({
    where: { id },
    include: {
      author: { select: userSelect },
      project: { select: { id: true, name: true, status: true, archivedAt: true } },
      client: { select: { id: true, name: true } },
      opportunity: { select: { id: true, title: true } },
    },
  });
}

/** Tâches créées depuis ce compte rendu (retrouvées via le journal, sans champ dédié). */
export async function tasksFromNote(noteId: string) {
  const db = getDb();
  const events = await db.auditEvent.findMany({
    where: { action: FROM_NOTE, targetType: "meeting_note", targetId: noteId },
    orderBy: { createdAt: "asc" },
    select: { after: true },
  });
  const ids = events.flatMap((e) => {
    const after = e.after as { taskIds?: unknown } | null;
    return Array.isArray(after?.taskIds)
      ? after.taskIds.filter((x): x is string => typeof x === "string")
      : [];
  });
  if (!ids.length) return [];
  const tasks = await db.task.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      archivedAt: true,
      owner: { select: { name: true } },
      project: { select: { id: true, name: true } },
    },
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return tasks.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

/** Listes des formulaires : associés, projets, entreprises et opportunités non archivés. */
export async function noteOptions() {
  const db = getDb();
  const [associates, projects, clients, opportunities] = await Promise.all([
    db.user.findMany({ where: { role: "associe" }, orderBy: { name: "asc" }, select: userSelect }),
    db.project.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true, archivedAt: true, clientId: true },
    }),
    db.client.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" }, select: userSelect }),
    db.opportunity.findMany({
      where: { archivedAt: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true, clientId: true },
    }),
  ]);
  return {
    associates,
    projects,
    /** Projets qui peuvent recevoir des tâches. */
    openProjects: projects.filter(canReceiveTasks),
    clients,
    opportunities,
  };
}

// ─── Écritures ──────────────────────────────────────────────────────────────

export type NoteInput = {
  title: string;
  body: string;
  occurredAt: Date;
  projectId: string | null;
  clientId: string | null;
  opportunityId: string | null;
  /** Lu seulement à la création (compte rendu d'une réunion du calendrier). */
  eventId: string | null;
  /** Modification : `updatedAt` lu à l'ouverture du formulaire ; null = pas de contrôle. */
  version?: Date | null;
};

const STALE_EDIT =
  "Le compte rendu a été modifié entre-temps (des tâches ont pu en être créées). " +
  "Copiez votre texte, rechargez la page, puis reportez vos changements.";

/** Vérifie les liens : ils existent, et un NOUVEAU lien ne vise pas une fiche archivée. */
async function checkLinks(
  input: NoteInput,
  current: { projectId: string | null; clientId: string | null; opportunityId: string | null } | null,
): Promise<string | null> {
  const db = getDb();
  if (input.projectId) {
    const p = await db.project.findUnique({ where: { id: input.projectId }, select: { archivedAt: true } });
    if (!p || (p.archivedAt && input.projectId !== current?.projectId)) return "Projet introuvable.";
  }
  if (input.clientId) {
    const c = await db.client.findUnique({ where: { id: input.clientId }, select: { archivedAt: true } });
    if (!c || (c.archivedAt && input.clientId !== current?.clientId)) return "Entreprise introuvable.";
  }
  if (input.opportunityId) {
    const o = await db.opportunity.findUnique({
      where: { id: input.opportunityId },
      select: { archivedAt: true },
    });
    if (!o || (o.archivedAt && input.opportunityId !== current?.opportunityId))
      return "Opportunité introuvable.";
  }
  return null;
}

export async function saveNote(
  id: string | null,
  input: NoteInput,
  actor: Actor,
): Promise<ServiceResult<{ id: string }>> {
  const db = getDb();
  const data = {
    title: input.title.trim(),
    body: input.body,
    occurredAt: input.occurredAt,
    projectId: input.projectId,
    clientId: input.clientId,
    opportunityId: input.opportunityId,
  };
  if (id) {
    const before = await db.meetingNote.findUnique({ where: { id } });
    if (!before || before.archivedAt) return failed("Compte rendu introuvable.");
    const error = await checkLinks(input, before);
    if (error) return failed(error);
    // Sans ce contrôle, un formulaire ouvert avant « Créer les tâches » remettrait les lignes « [ ] »
    // et les actions seraient proposées (puis créées) une seconde fois.
    if (input.version && input.version.getTime() !== before.updatedAt.getTime()) return failed(STALE_EDIT);
    const updated = await db.meetingNote.updateMany({
      where: { id, archivedAt: null, updatedAt: before.updatedAt },
      data,
    });
    if (!updated.count) return failed(STALE_EDIT);
    const changes = diff(
      {
        title: before.title,
        occurredAt: before.occurredAt,
        projectId: before.projectId,
        clientId: before.clientId,
        opportunityId: before.opportunityId,
        bodyLength: before.body.length,
      },
      {
        title: data.title,
        occurredAt: data.occurredAt,
        projectId: data.projectId,
        clientId: data.clientId,
        opportunityId: data.opportunityId,
        bodyLength: data.body.length,
      },
    );
    if (changes.changed)
      await recordAudit({
        action: "project.note_updated",
        actorId: actor.id,
        projectId: data.projectId ?? before.projectId,
        targetType: "meeting_note",
        targetId: id,
        before: changes.before,
        after: changes.after,
      });
    return done({ id });
  }
  const error = await checkLinks(input, null);
  if (error) return failed(error);
  if (input.eventId) {
    // Un événement privé d'un autre associé n'est pas lisible : on ne peut pas s'y rattacher.
    const event = await getEvent(input.eventId, actor.id);
    if (!event || event.busyOnly) return failed("Événement introuvable.");
  }
  const note = await db.meetingNote.create({
    data: { ...data, eventId: input.eventId, authorId: actor.id },
  });
  if (note.opportunityId) {
    // Trace dans l'historique commercial : une réunion, résumée par le titre du compte rendu.
    const today = todayDate();
    await addActivity(
      note.opportunityId,
      {
        kind: "REUNION",
        body: `Compte rendu : ${note.title}`,
        occurredAt: note.occurredAt.getTime() === today.getTime() ? new Date() : note.occurredAt,
        fileUrl: null,
      },
      actor,
    );
  }
  return done({ id: note.id });
}

/** Archive (masque) un compte rendu ; les tâches déjà créées restent. */
export async function archiveNote(id: string, actor: Actor): Promise<ServiceResult<null>> {
  const db = getDb();
  const note = await db.meetingNote.findUnique({
    where: { id },
    select: { archivedAt: true, title: true, projectId: true },
  });
  if (!note) return failed("Compte rendu introuvable.");
  if (!note.archivedAt) {
    await db.meetingNote.update({ where: { id }, data: { archivedAt: new Date() } });
    await recordAudit({
      action: "project.note_archived",
      actorId: actor.id,
      projectId: note.projectId,
      targetType: "meeting_note",
      targetId: id,
      before: { title: note.title },
    });
  }
  return done(null);
}

export type NoteActionInput = {
  /** Numéro de ligne (à partir de 1) dans le compte rendu. */
  line: number;
  /** Texte d'origine de la ligne : détecte un compte rendu modifié entre-temps. */
  raw: string;
  title: string;
  ownerId: string | null;
  dueDate: Date | null;
  /** Ignoré quand le compte rendu est rattaché à un projet en cours. */
  projectId: string | null;
};

type CreatedTask = { id: string; title: string; ownerId: string | null; projectId: string };

/**
 * Crée les tâches confirmées, en UNE transaction : tâches (mêmes valeurs par défaut que la création
 * habituelle), journal, puis lignes marquées « [x] » et compteur incrémenté. Idempotent : le compte
 * rendu est relu sous verrou et seules les lignes encore détectées sont retenues.
 */
export async function createTasksFromNote(
  noteId: string,
  actions: NoteActionInput[],
  actor: Actor,
): Promise<ServiceResult<{ created: { id: string; title: string; projectId: string }[]; skipped: number }>> {
  const db = getDb();
  if (!actions.length) return failed("Cochez au moins une action.");
  const associates = await db.user.findMany({ where: { role: "associe" }, select: userSelect });
  const associateIds = new Set(associates.map((a) => a.id));
  if (actions.some((a) => a.ownerId && !associateIds.has(a.ownerId))) return failed("Responsable invalide.");
  const today = todayDate();

  type Outcome = { error: string } | { created: CreatedTask[]; skipped: number; title: string };
  const outcome = await db.$transaction(async (tx): Promise<Outcome> => {
    // Verrou : deux envois simultanés ne créent pas deux fois les mêmes tâches.
    const rows = await tx.$queryRaw<
      { body: string; title: string; projectId: string | null; archivedAt: Date | null }[]
    >`SELECT "body", "title", "projectId", "archivedAt" FROM "meeting_note" WHERE "id" = ${noteId} FOR UPDATE`;
    const note = rows[0];
    if (!note || note.archivedAt) return { error: "Compte rendu introuvable." };

    const { accepted, skipped, stale } = reconcileActions(
      parseActions(note.body, associates, today),
      actions,
    );
    if (stale)
      return { error: "Le compte rendu a été modifié entre-temps : vérifiez les actions proposées." };
    if (!accepted.length) return { created: [], skipped, title: note.title };

    const noteProject = note.projectId
      ? await tx.project.findUnique({
          where: { id: note.projectId },
          select: { id: true, status: true, archivedAt: true },
        })
      : null;
    const forcedProjectId = noteProject && canReceiveTasks(noteProject) ? noteProject.id : null;
    const targets = accepted.map((a) => ({ ...a, projectId: forcedProjectId ?? a.projectId }));
    const missing = targets.find((a) => !a.projectId);
    if (missing) return { error: `Choisissez le projet de « ${missing.title} ».` };

    const projectIds = [...new Set(targets.map((a) => a.projectId!))];
    const open = await tx.project.findMany({
      where: { id: { in: projectIds }, archivedAt: null, status: { notIn: CLOSED_PROJECT_STATUSES } },
      select: { id: true },
    });
    if (open.length !== projectIds.length)
      return { error: "Seuls les projets en cours (ni terminés ni archivés) peuvent recevoir des tâches." };

    const positions = new Map<string, number>();
    for (const projectId of projectIds)
      positions.set(projectId, await tx.task.count({ where: { projectId } }));

    const created: CreatedTask[] = [];
    for (const a of targets) {
      const projectId = a.projectId!;
      const position = positions.get(projectId)!;
      positions.set(projectId, position + 1);
      // Mêmes valeurs que saveTask : à faire, impact moyen, priorité suggérée non verrouillée.
      const task = await tx.task.create({
        data: {
          projectId,
          title: a.title.trim(),
          description: `Issue du compte rendu « ${note.title} ».`,
          workPackageId: null,
          ownerId: a.ownerId,
          impact: "MOYEN",
          priorityLocked: false,
          priority: suggestPriority({
            impact: "MOYEN",
            dueDate: a.dueDate,
            today,
            blockingCount: 0,
            done: false,
          }).priority,
          startDate: null,
          dueDate: a.dueDate,
          estimatedMinutes: null,
          position,
          createdById: actor.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: TASK_CREATED,
          actorId: actor.id,
          projectId,
          targetType: "task",
          targetId: task.id,
          after: { title: task.title, ownerId: task.ownerId },
          reason: `Compte rendu « ${note.title} »`,
        },
      });
      created.push({ id: task.id, title: task.title, ownerId: task.ownerId, projectId });
    }

    await tx.meetingNote.update({
      where: { id: noteId },
      data: {
        body: markLinesDone(
          note.body,
          targets.map((a) => a.line),
        ),
        createdTasks: { increment: created.length },
      },
    });
    await tx.auditEvent.create({
      data: {
        action: FROM_NOTE,
        actorId: actor.id,
        targetType: "meeting_note",
        targetId: noteId,
        after: {
          taskIds: created.map((t) => t.id),
          lines: targets.map((a) => a.line),
        } satisfies Prisma.InputJsonObject,
      },
    });
    return { created, skipped, title: note.title };
  }, TX_OPTIONS);

  if ("error" in outcome) return failed(outcome.error);
  await notifyOwners(outcome.created, actor);
  return done({
    created: outcome.created.map(({ id, title, projectId }) => ({ id, title, projectId })),
    skipped: outcome.skipped,
  });
}

/** Comme une assignation habituelle : le responsable est prévenu, sauf s'il est l'auteur. */
async function notifyOwners(tasks: CreatedTask[], actor: Actor) {
  const assigned = tasks.filter((t) => t.ownerId && t.ownerId !== actor.id);
  if (!assigned.length) return;
  const author = await getDb().user.findUnique({ where: { id: actor.id }, select: { name: true } });
  for (const t of assigned)
    await notify({
      userId: t.ownerId!,
      kind: "assignation",
      title: `${author?.name ?? "Un associé"} vous a assigné « ${t.title} »`,
      href: `/taches/${t.id}`,
      projectId: t.projectId,
      taskId: t.id,
      dedupeKey: `assignation:${t.id}:${Date.now()}`,
    });
}
