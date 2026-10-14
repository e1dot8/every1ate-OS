import Link from "next/link";
import { AlertTriangle, Diamond } from "lucide-react";
import { TaskStatusBadge } from "@/components/app/bits";
import { addDays, formatDay, startOfWeek } from "@/lib/dates";
import type { TaskStatus } from "@/generated/prisma/enums";

type T = {
  id: string;
  title: string;
  status: TaskStatus;
  startDate: Date | null;
  dueDate: Date | null;
  owner: { name: string } | null;
};
type M = { id: string; name: string; date: Date; reachedAt: Date | null };

/** Roadmap pour téléphone : planning chronologique par semaine, sans glisser-déposer. */
export function RoadmapList({ tasks, milestones, today }: { tasks: T[]; milestones: M[]; today: Date }) {
  type Row =
    { key: string; date: Date; kind: "task"; t: T } | { key: string; date: Date; kind: "milestone"; m: M };
  const rows: Row[] = [
    ...tasks
      .filter((t) => t.dueDate || t.startDate)
      .map((t) => ({ key: t.id, date: (t.dueDate ?? t.startDate)!, kind: "task" as const, t })),
    ...milestones.map((m) => ({ key: m.id, date: m.date, kind: "milestone" as const, m })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());
  const undated = tasks.filter((t) => !t.dueDate && !t.startDate);
  const weeks = new Map<string, Row[]>();
  for (const r of rows) {
    const k = startOfWeek(r.date).toISOString().slice(0, 10);
    weeks.set(k, [...(weeks.get(k) ?? []), r]);
  }
  const thisWeek = startOfWeek(today).toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-4" aria-label="Planning par semaine">
      {[...weeks].map(([k, list]) => {
        const start = new Date(`${k}T00:00:00Z`);
        return (
          <section key={k} aria-label={`Semaine du ${formatDay(start)}`}>
            <h2 className={`mb-1 text-sm font-bold ${k === thisWeek ? "text-pen-strong" : ""}`}>
              Semaine du {formatDay(start)} au {formatDay(addDays(start, 6))}
              {k === thisWeek ? " · cette semaine" : ""}
            </h2>
            <ul className="flex flex-col rounded-xl border bg-card">
              {list.map((r) =>
                r.kind === "milestone" ? (
                  <li
                    key={r.key}
                    className="flex items-center gap-2 border-b px-3 py-2.5 text-sm last:border-b-0"
                  >
                    <Diamond aria-hidden="true" className="size-4 fill-highlight" />
                    <b className="flex-1">{r.m.name}</b>
                    <span className="text-muted-foreground">
                      {formatDay(r.m.date)}
                      {r.m.reachedAt ? " · atteint" : ""}
                    </span>
                  </li>
                ) : (
                  <li key={r.key} className="border-b last:border-b-0">
                    <Link
                      href={`/taches/${r.t.id}`}
                      className="flex flex-col gap-1 px-3 py-2.5 hover:bg-muted/60"
                    >
                      <span className="flex items-center gap-2">
                        {r.t.dueDate && r.t.dueDate < today && !["TERMINE", "ANNULE"].includes(r.t.status) ? (
                          <AlertTriangle aria-label="En retard" className="size-4 shrink-0 text-danger" />
                        ) : null}
                        <b className="flex-1">{r.t.title}</b>
                      </span>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <TaskStatusBadge status={r.t.status} />
                        {formatDay(r.t.startDate)} → {formatDay(r.t.dueDate)}
                        {r.t.owner ? ` · ${r.t.owner.name}` : ""}
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}
      {undated.length ? (
        <p className="text-sm text-muted-foreground">
          {undated.length} tâche(s) sans date : ouvrez-les pour les planifier.
        </p>
      ) : null}
    </div>
  );
}
