import "server-only";
import { getDb } from "@/lib/db/client";

/** Listes pour le formulaire d'événement. */
export async function eventOptions() {
  const db = getDb();
  const [associates, projects, clients, opportunities] = await Promise.all([
    db.user.findMany({
      where: { role: "associe" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.project.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.client.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.opportunity.findMany({
      where: { archivedAt: null, stage: { notIn: ["GAGNE", "PERDU"] } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);
  return {
    associates: associates.map((a) => ({ value: a.id, label: a.name })),
    projects: projects.map((p) => ({ value: p.id, label: p.name })),
    clients: clients.map((c) => ({ value: c.id, label: c.name })),
    opportunities: opportunities.map((o) => ({ value: o.id, label: o.title })),
  };
}

/** Créneau proposé par défaut : la prochaine heure pleine, pendant une heure. */
export function nextHourSlot(now = new Date()) {
  const start = new Date(Math.ceil(now.getTime() / 3_600_000) * 3_600_000);
  return { start, end: new Date(start.getTime() + 3_600_000) };
}
