import "server-only";
import { recordAudit } from "@/lib/audit/audit";
import { getDb } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { notificationEmail } from "@/lib/email/templates";
import { getServerEnv } from "@/lib/env";
import { formatDay, todayDate } from "@/lib/dates";
import { isDueSoon, overdueLevel, suggestPriority } from "@/features/planning/rules";

export type NotificationInput = {
  userId: string;
  kind: "assignation" | "echeance" | "retard" | "escalade" | "blocage" | "planning" | "action" | "import";
  title: string;
  body?: string;
  href?: string;
  projectId?: string | null;
  taskId?: string | null;
  /** Une même clé n'est jamais notifiée deux fois au même utilisateur (§13.3). */
  dedupeKey: string;
  /** Événement important : envoyé aussi par e-mail (§13.1). */
  email?: boolean;
};

/** Crée la notification si elle n'existe pas encore. Retourne true si elle est nouvelle. */
export async function notify(input: NotificationInput): Promise<boolean> {
  const db = getDb();
  const { email, ...data } = input;
  const created = await db.notification.createMany({ data: [data], skipDuplicates: true });
  if (!created.count) return false;
  if (email) {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    });
    if (user) {
      try {
        const url = input.href ? `${getServerEnv().appUrl}${input.href}` : getServerEnv().appUrl;
        await sendEmail(
          notificationEmail({ to: user.email, name: user.name, title: input.title, body: input.body, url }),
        );
        await db.notification.update({
          where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
          data: { emailedAt: new Date() },
        });
      } catch (error) {
        // L'alerte in-app reste ; l'échec d'envoi est visible dans les logs.
        console.error("[notify] e-mail non envoyé", error);
      }
    }
  }
  return true;
}

export async function listNotifications(userId: string) {
  return getDb().notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
}

export async function unreadCount(userId: string) {
  return getDb().notification.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, id: string | "all") {
  await getDb().notification.updateMany({
    where: { userId, readAt: null, ...(id === "all" ? {} : { id }) },
    data: { readAt: new Date() },
  });
}

const OPEN = { notIn: ["TERMINE", "ANNULE"] as ("TERMINE" | "ANNULE")[] };

/**
 * Passe planifiée (cron) :
 * 1. échéances proches → responsable de la tâche ;
 * 2. retard → responsable (ou responsable global si non assignée) ;
 * 3. plus de 48 h de retard → responsable global du projet, par e-mail aussi ;
 * 4. recalcul des priorités NON verrouillées (jamais celles fixées à la main).
 * Idempotente : relancée, elle ne renvoie aucune alerte déjà émise.
 */
export async function runScheduledScan(now = new Date()) {
  const db = getDb();
  const today = todayDate(now);
  const tasks = await db.task.findMany({
    where: { archivedAt: null, status: OPEN, project: { archivedAt: null } },
    include: {
      project: { select: { id: true, name: true, ownerId: true } },
      requiredBy: { select: { task: { select: { status: true } } } },
    },
  });
  const counts = { echeance: 0, retard: 0, escalade: 0, priorites: 0 };
  for (const t of tasks) {
    const due = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "";
    const href = `/taches/${t.id}`;
    const level = overdueLevel(t.dueDate, today);
    const ownerId = t.ownerId ?? t.project.ownerId;
    if (level === 0 && isDueSoon(t.dueDate, today) && t.ownerId) {
      if (
        await notify({
          userId: t.ownerId,
          kind: "echeance",
          title: `Échéance proche : ${t.title}`,
          body: `À rendre le ${formatDay(t.dueDate)} (${t.project.name}).`,
          href,
          projectId: t.projectId,
          taskId: t.id,
          dedupeKey: `echeance:${t.id}:${due}`,
        })
      )
        counts.echeance++;
    }
    if (level >= 1) {
      if (
        await notify({
          userId: ownerId,
          kind: "retard",
          title: `En retard : ${t.title}`,
          body: `Échéance dépassée depuis le ${formatDay(t.dueDate)} (${t.project.name}).`,
          href,
          projectId: t.projectId,
          taskId: t.id,
          dedupeKey: `retard:${t.id}:${due}`,
        })
      )
        counts.retard++;
    }
    if (level === 2) {
      if (
        await notify({
          userId: t.project.ownerId,
          kind: "escalade",
          title: `Retard de plus de 48 h : ${t.title}`,
          body: `Échéance du ${formatDay(t.dueDate)} dépassée sur « ${t.project.name} ». Vous êtes responsable global du projet.`,
          href,
          projectId: t.projectId,
          taskId: t.id,
          dedupeKey: `escalade:${t.id}:${due}`,
          email: true,
        })
      )
        counts.escalade++;
    }
    if (!t.priorityLocked) {
      const suggestion = suggestPriority({
        impact: t.impact,
        dueDate: t.dueDate,
        today,
        blockingCount: t.requiredBy.filter((r) => !["TERMINE", "ANNULE"].includes(r.task.status)).length,
        done: false,
      });
      if (suggestion.priority !== t.priority) {
        await db.task.update({ where: { id: t.id }, data: { priority: suggestion.priority } });
        await recordAudit({
          action: "task.priority_recalculated",
          actorId: null,
          projectId: t.projectId,
          targetType: "task",
          targetId: t.id,
          before: { priority: t.priority },
          after: { priority: suggestion.priority },
          reason: suggestion.reasons.join(" · "),
        });
        counts.priorites++;
      }
    }
  }
  return counts;
}
