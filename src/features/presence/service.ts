import "server-only";
import { getDb } from "@/lib/db/client";
import type { ServiceResult } from "@/features/projects/service";
import { effectivePresence, type PresenceInfo, type PresenceValue } from "@/features/presence/rules";

const toInfo = (u: {
  presenceState: PresenceValue;
  presenceUntil: Date | null;
  presenceNote: string | null;
  presenceShared: boolean;
}): PresenceInfo => ({
  state: u.presenceState,
  until: u.presenceUntil,
  note: u.presenceNote,
  shared: u.presenceShared,
});

export const presenceSelect = {
  presenceState: true,
  presenceUntil: true,
  presenceNote: true,
  presenceShared: true,
} as const;

/** Statut de chaque associé, tel que le voit `viewerId`. */
export async function listPresence(viewerId: string, now = new Date()) {
  const users = await getDb().user.findMany({
    where: { role: "associe" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, ...presenceSelect },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    ...effectivePresence(toInfo(u), now, u.id === viewerId),
  }));
}

export async function getPresence(userId: string): Promise<PresenceInfo | null> {
  const u = await getDb().user.findUnique({ where: { id: userId }, select: presenceSelect });
  return u ? toInfo(u) : null;
}

/** Statut choisi par l'associé lui-même (pas de journal : ce n'est pas une donnée sensible). */
export async function setPresence(
  userId: string,
  input: { state: PresenceValue; until: Date | null; note: string | null; shared?: boolean },
): Promise<ServiceResult<null>> {
  if (input.until && input.until.getTime() <= Date.now())
    return { ok: false, error: "L'heure de fin est déjà passée." };
  if (input.note && input.note.length > 80) return { ok: false, error: "Statut trop long (80 caractères)." };
  await getDb().user.update({
    where: { id: userId },
    data: {
      presenceState: input.state,
      presenceUntil: input.state === "DISPO" ? null : input.until,
      presenceNote: input.note?.trim() || null,
      ...(input.shared === undefined ? {} : { presenceShared: input.shared }),
    },
  });
  return { ok: true, data: null };
}
