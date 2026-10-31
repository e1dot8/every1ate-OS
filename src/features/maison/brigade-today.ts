import "server-only";
import { getWeek, weekOf } from "@/features/briefing/service";
import type { BrigadeRow, Goal } from "@/features/maison/components/house-panels";
import { availabilities, availabilityLabels, avatarsOf } from "@/features/maison/service";
import { upcomingLoad } from "@/features/planning/load-service";
import { listAssociates } from "@/features/projects/service";
import { getDb } from "@/lib/db/client";
import { todayDate } from "@/lib/dates";

const tone = { CONCENTRE: "focus", DISPONIBLE: "free", ABSENT: "away" } as const;

/** La brigade du jour : tâches ouvertes, disponibilité déclarée et charge de la semaine. */
export async function brigadeToday(viewerId: string, today = todayDate()): Promise<BrigadeRow[]> {
  const associates = await listAssociates();
  const ids = associates.map((a) => a.id);
  const [looks, avail, load, counts] = await Promise.all([
    avatarsOf(ids),
    availabilities(today),
    upcomingLoad(1),
    getDb().task.groupBy({
      by: ["ownerId"],
      where: { archivedAt: null, status: { notIn: ["TERMINE", "ANNULE"] }, ownerId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  return associates.map((a) => {
    const status = avail.get(a.id) ?? null;
    return {
      id: a.id,
      name: a.name,
      look: looks.get(a.id)!,
      openTasks: counts.find((c) => c.ownerId === a.id)?._count._all ?? 0,
      load: load.rows.find((r) => r.id === a.id)?.cells[0]?.pct ?? 0,
      status: status ? availabilityLabels[status] : null,
      statusTone: status ? tone[status] : null,
      href: a.id === viewerId ? "/appartement" : `/appartement?associe=${a.id}`,
    };
  });
}

/** Objectifs du service de la semaine en cours. */
export async function weekGoals(today = todayDate()): Promise<Goal[]> {
  const week = await getWeek(weekOf(today));
  return (week?.items ?? [])
    .filter((i) => i.kind === "OBJECTIF")
    .map((g) => ({ id: g.id, title: g.title, reached: g.status === "ATTEINT" }));
}
