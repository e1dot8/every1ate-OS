import "server-only";
import { getDb } from "@/lib/db/client";
import { notify } from "@/features/notifications/service";
import { badgeLabels, currentWeek, earnedBadges } from "@/features/qg/quests";
import { questFacts } from "@/features/qg/service";

/**
 * Badges d'équipe de la semaine ISO en cours (appelé par la passe planifiée). Collectifs :
 * « huit-taches » dès 8 tâches terminées, les badges d'état (zéro relance, rien de bloqué,
 * passations traitées) à partir du vendredi 17 h, heure de Paris. Idempotent : un badge n'est
 * créé (et annoncé à chaque associé) qu'une fois par période. Renvoie le nombre de nouveaux badges.
 */
export async function recordTeamBadges(now: Date): Promise<number> {
  const db = getDb();
  const { period } = currentWeek(now);
  const keys = earnedBadges(await questFacts(now), now);
  if (!keys.length) return 0;
  let fresh = 0;
  for (const key of keys) {
    const created = await db.teamBadge.createMany({ data: [{ key, period }], skipDuplicates: true });
    if (!created.count) continue;
    fresh++;
    const associates = await db.user.findMany({ where: { role: "associe" }, select: { id: true } });
    for (const u of associates)
      await notify({
        userId: u.id,
        kind: "equipe",
        title: `Badge d'équipe : ${badgeLabels[key]}`,
        body: `Gagné ensemble cette semaine (${period}).`,
        href: "/#quetes",
        dedupeKey: `badge:${key}:${period}`,
      });
  }
  return fresh;
}
