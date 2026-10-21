import "server-only";
import { getDb } from "@/lib/db/client";

export async function projectLots(projectId: string) {
  const lots = await getDb().workPackage.findMany({
    where: { projectId, archivedAt: null },
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });
  return lots.map((l) => ({ value: l.id, label: l.name }));
}

export async function projectOptions() {
  const projects = await getDb().project.findMany({
    where: { archivedAt: null, internal: false },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return projects.map((p) => ({ value: p.id, label: p.name }));
}
