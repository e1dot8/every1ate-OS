import "server-only";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";
import type { ServiceResult } from "@/features/projects/service";
import { emitEvent } from "@/features/events/emit";

/** Stand-up asynchrone du jour (une entrée par associé et par jour, modifiable). */
export async function saveStandup(
  user: { id: string; name: string },
  input: { today: string | null; blocked: string | null },
  now = new Date(),
): Promise<ServiceResult<null>> {
  const today = input.today?.trim() || null;
  const blocked = input.blocked?.trim() || null;
  if (!today && !blocked)
    return { ok: false, error: "Écris ce que tu fais aujourd'hui ou ce qui te bloque." };
  if ((today?.length ?? 0) > 1000 || (blocked?.length ?? 0) > 1000)
    return { ok: false, error: "Texte trop long (1 000 caractères)." };
  const date = todayDate(now);
  const before = await getDb().standupEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  await getDb().standupEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, today, blocked },
    update: { today, blocked },
  });
  if (blocked && blocked !== before?.blocked)
    await emitEvent({
      kind: "standup.bloque",
      actorId: user.id,
      title: `${user.name} est bloqué`,
      body: blocked,
      href: "/qg/standup",
      dedupeKey: `standup-bloque:${user.id}:${date.toISOString().slice(0, 10)}:${blocked.slice(0, 40)}`,
    });
  return { ok: true, data: null };
}

export async function listStandups(date: Date) {
  return getDb().standupEntry.findMany({
    where: { date },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
}
