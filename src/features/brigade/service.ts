import "server-only";
import { getDb } from "@/lib/db/client";
import { notify } from "@/features/notifications/service";
import type { ServiceResult } from "@/features/projects/service";

/** Publie une réussite dans le fil (une seule fois par clé). */
export async function postBrigadeEvent(input: {
  userId: string | null;
  kind: "badge" | "rang" | "projet" | "objectif" | "aide";
  title: string;
  detail?: string;
  href?: string;
  dedupeKey: string;
}) {
  await getDb().brigadeEvent.createMany({ data: [input], skipDuplicates: true });
}

export async function listFeed(viewerId: string, take = 20) {
  const events = await getDb().brigadeEvent.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, name: true } },
      cheers: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  return events.map((e) => ({ ...e, cheeredByMe: e.cheers.some((c) => c.userId === viewerId) }));
}

/** Féliciter : une fois par réussite et par associé, avec un mot facultatif. */
export async function cheer(
  eventId: string,
  message: string | null,
  actor: { id: string },
): Promise<ServiceResult<null>> {
  const db = getDb();
  const event = await db.brigadeEvent.findUnique({ where: { id: eventId } });
  if (!event) return { ok: false, error: "Réussite introuvable." };
  if (event.userId === actor.id)
    return { ok: false, error: "On ne se félicite pas soi-même : la brigade s'en charge." };
  const created = await db.brigadeCheer.createMany({
    data: [{ eventId, userId: actor.id, message }],
    skipDuplicates: true,
  });
  if (created.count && event.userId) {
    const me = await db.user.findUnique({ where: { id: actor.id }, select: { name: true } });
    await notify({
      userId: event.userId,
      kind: "felicitations",
      title: `${me?.name ?? "Un associé"} vous félicite : ${event.title}`,
      body: message ?? undefined,
      href: "/bureau",
      dedupeKey: `bravo:${eventId}:${actor.id}`,
    });
  }
  return { ok: true, data: null };
}
