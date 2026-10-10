import type { Metadata } from "next";
import { Suspense } from "react";
import { Chip, EmptyState, TaskRow, isLate } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { listTasksForUser } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { addDays, todayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Tâches" };

async function TaskList({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const team = sp.vue === "equipe";
  const tasks = await listTasksForUser(team ? null : user.id);
  const today = todayDate();
  const inAWeek = addDays(today, 7);
  const groups = [
    { title: "En retard ou bloquées", items: tasks.filter((t) => isLate(t) || t.status === "BLOQUE") },
    {
      title: "Cette semaine",
      items: tasks.filter((t) => !isLate(t) && t.status !== "BLOQUE" && t.dueDate && t.dueDate <= inAWeek),
    },
    {
      title: "Plus tard",
      items: tasks.filter((t) => !isLate(t) && t.status !== "BLOQUE" && t.dueDate && t.dueDate > inAWeek),
    },
    { title: "Sans échéance", items: tasks.filter((t) => t.status !== "BLOQUE" && !t.dueDate) },
  ].filter((g) => g.items.length);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Chip href="/taches" active={!team}>
          À moi
        </Chip>
        <Chip href="/taches?vue=equipe" active={team}>
          Équipe
        </Chip>
      </div>
      {groups.length === 0 ? (
        <EmptyState title={team ? "Aucune tâche ouverte dans l'équipe." : "Aucune tâche ouverte pour vous."}>
          Les tâches se créent depuis un projet.
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.title} className="flex flex-col gap-2" aria-label={g.title}>
            <h2 className="text-lg font-bold">
              {g.title} <span className="text-sm font-normal text-muted-foreground">({g.items.length})</span>
            </h2>
            <Card className="gap-0 py-1">
              <ul>
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} showProject />
                ))}
              </ul>
            </Card>
          </section>
        ))
      )}
    </>
  );
}

export default function TasksPage({ searchParams }: PageProps<"/taches">) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Tâches</h1>
      <Suspense fallback={<PageLoading />}>
        <TaskList searchParams={searchParams as Promise<{ vue?: string }>} />
      </Suspense>
    </div>
  );
}
