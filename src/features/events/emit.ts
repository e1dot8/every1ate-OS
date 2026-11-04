import "server-only";
import { getDb } from "@/lib/db/client";
import type { NotificationInput } from "@/features/notifications/service";
import { deliverExternal } from "@/features/notifications/channels";
import { postSystemMessage } from "@/features/discussions/system";
import type { EventKind } from "@/features/events/kinds";

export type AppEvent = {
  kind: EventKind;
  /** Auteur de l'action : jamais notifié de sa propre action. */
  actorId: string | null;
  title: string;
  body?: string;
  href?: string;
  projectId?: string | null;
  taskId?: string | null;
  /** Destinataires ; par défaut tous les associés sauf l'auteur. */
  recipients?: string[];
  /** Une même clé n'est jamais notifiée deux fois à la même personne. */
  dedupeKey: string;
  /** Publier aussi un message du QG dans le salon du projet (ou #général). Par défaut : oui. */
  channelPost?: boolean;
  /** Urgent : envoyé même pendant un focus. */
  urgent?: boolean;
};

const NOTIFICATION_KIND: Record<EventKind, NotificationInput["kind"]> = {
  "livrable.coche": "livrable",
  "livrable.assigne": "assignation",
  "livrable.etape": "livrable",
  "livrable.livre": "livrable",
  "livrable.bloque": "blocage",
  "tache.terminee": "equipe",
  "passation.demandee": "passation",
  "passation.repondue": "passation",
  mention: "mention",
  "message.direct": "discussion",
  "standup.bloque": "standup",
  rappel: "rappel",
  "opportunite.gagnee": "equipe",
};

/**
 * Point d'entrée unique des automatisations : notification dans l'app, puis push et WhatsApp
 * selon les préférences de chacun, puis message du QG dans le salon. Une étape qui échoue
 * n'empêche jamais l'action d'origine (elle est seulement journalisée).
 */
export async function emitEvent(e: AppEvent): Promise<void> {
  try {
    const recipients =
      e.recipients ??
      (await getDb().user.findMany({ where: { role: "associe" }, select: { id: true } })).map((u) => u.id);
    const targets = [...new Set(recipients)].filter((id) => id !== e.actorId);
    // Un seul INSERT pour tous les destinataires ; seules les lignes réellement créées (pas de
    // doublon sur userId + dedupeKey) déclenchent ensuite push et WhatsApp.
    const created = targets.length
      ? await getDb().notification.createManyAndReturn({
          data: targets.map((userId) => ({
            userId,
            kind: NOTIFICATION_KIND[e.kind],
            title: e.title,
            body: e.body,
            href: e.href,
            projectId: e.projectId ?? null,
            taskId: e.taskId ?? null,
            dedupeKey: e.dedupeKey,
          })),
          skipDuplicates: true,
          select: { userId: true },
        })
      : [];
    const fresh = created.map((row) => row.userId);
    if (fresh.length)
      await deliverExternal(fresh, {
        kind: e.kind,
        title: e.title,
        body: e.body,
        href: e.href,
        urgent: e.urgent,
      });
  } catch (error) {
    console.error("[événement] notification", e.kind, error);
  }
  if (e.channelPost === false) return;
  try {
    await postSystemMessage({
      projectId: e.projectId ?? null,
      text: e.body ? `${e.title} · ${e.body}` : e.title,
      href: e.href,
    });
  } catch (error) {
    console.error("[événement] salon", e.kind, error);
  }
}
