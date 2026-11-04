import "server-only";
import { getDb } from "@/lib/db/client";
import { emitEvent } from "@/features/events/emit";
import { accessChannel } from "@/features/discussions/channels";
import { canPostInChannel, permalink } from "@/features/discussions/rules";
import { publishMessage } from "@/features/discussions/service";

/** Au plus par passage : une passe suivante reprend le reste. */
const BATCH = 50;

/**
 * Rappels échus → notification au seul propriétaire ; messages programmés échus → publiés
 * (mentions comprises). Chaque élément est réservé atomiquement (`sentAt`) avant d'être traité :
 * deux passes simultanées (page affichée, rafraîchissement, tâche planifiée) ne l'envoient
 * jamais deux fois. Appelée à l'affichage des pages discussions : marche sans tâche planifiée.
 */
export async function processDueDiscussions(now: Date): Promise<{ reminders: number; scheduled: number }> {
  const db = getDb();
  let reminders = 0;
  let scheduled = 0;

  const dueReminders = await db.reminder.findMany({
    where: { sentAt: null, remindAt: { lte: now } },
    orderBy: { remindAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      userId: true,
      text: true,
      message: { select: { id: true, parentId: true, channel: { select: { slug: true } } } },
    },
  });
  for (const r of dueReminders) {
    const claimed = await db.reminder.updateMany({
      where: { id: r.id, sentAt: null },
      data: { sentAt: now },
    });
    if (!claimed.count) continue;
    await emitEvent({
      kind: "rappel",
      actorId: null,
      title: "Rappel",
      body: r.text,
      href: r.message ? permalink(r.message.channel.slug, r.message) : "/discussions/activite#rappels",
      recipients: [r.userId],
      dedupeKey: `rappel:${r.id}`,
      channelPost: false,
    });
    reminders += 1;
  }

  const dueMessages = await db.scheduledMessage.findMany({
    where: { sentAt: null, cancelledAt: null, sendAt: { lte: now } },
    orderBy: { sendAt: "asc" },
    take: BATCH,
    select: {
      id: true,
      channelId: true,
      parentId: true,
      body: true,
      author: { select: { id: true, name: true, role: true } },
    },
  });
  for (const s of dueMessages) {
    const claimed = await db.scheduledMessage.updateMany({
      where: { id: s.id, sentAt: null, cancelledAt: null },
      data: { sentAt: now },
    });
    if (!claimed.count) continue;
    // L'auteur doit encore avoir accès au salon (retiré d'un salon privé, salon archivé : annulé).
    const access = s.author.role === "associe" ? await accessChannel({ id: s.channelId }, s.author.id) : null;
    if (!access || !canPostInChannel(access.channel, !!access.member)) {
      await db.scheduledMessage.update({ where: { id: s.id }, data: { sentAt: null, cancelledAt: now } });
      continue;
    }
    const parent = s.parentId
      ? await db.message.findFirst({
          where: { id: s.parentId, channelId: s.channelId, parentId: null },
          select: { id: true },
        })
      : null;
    await publishMessage(s.author, access.channel, { body: s.body, parentId: parent?.id ?? null }, now);
    scheduled += 1;
  }
  return { reminders, scheduled };
}

/** Passe planifiée (appelée par runScheduledScan). */
export async function runDiscussionsScan(now: Date): Promise<{ reminders: number; scheduled: number }> {
  return processDueDiscussions(now);
}
