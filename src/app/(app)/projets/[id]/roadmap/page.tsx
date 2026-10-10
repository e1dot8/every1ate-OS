import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Diamond, X } from "lucide-react";
import { BackLink, PhaseSteps, ProjectStatusBadge } from "@/components/app/bits";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Gantt } from "@/features/planning/components/gantt";
import { MilestoneForm } from "@/features/planning/components/milestone-form";
import { getRoadmap } from "@/features/planning/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay, toDateInput, todayDate } from "@/lib/dates";
import { archiveMilestoneAction } from "./actions";

export const metadata: Metadata = { title: "Roadmap" };

async function RoadmapView({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const data = await getRoadmap(id);
  if (!data) notFound();
  const { project, lots, tasks, milestones, edges } = data;
  const lotOptions = lots.map((l) => ({ value: l.id, label: l.name }));
  return (
    <>
      <BackLink href={`/projets/${id}`}>{project.name}</BackLink>
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">Roadmap</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ProjectStatusBadge status={project.status} />
          <span className="text-sm text-muted-foreground">
            {formatDay(project.startDate)} → {formatDay(project.plannedEndDate)}
          </span>
        </div>
        {/* La phase est affichée à part : elle ne se confond pas avec les statuts (§7.6). */}
        <PhaseSteps phase={project.phase} />
      </header>
      {tasks.length || milestones.length ? (
        <Gantt
          today={toDateInput(todayDate())}
          lots={lots.map((l) => ({ id: l.id, name: l.name }))}
          tasks={tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            start: t.startDate ? toDateInput(t.startDate) : null,
            due: t.dueDate ? toDateInput(t.dueDate) : null,
            lotId: t.workPackageId,
            owner: t.owner?.name ?? null,
          }))}
          milestones={milestones.map((m) => ({
            id: m.id,
            name: m.name,
            date: toDateInput(m.date),
            reached: !!m.reachedAt,
          }))}
          edges={edges}
        />
      ) : (
        <Card>
          <CardTitle>Rien à planifier</CardTitle>
          <CardDescription>Ajoutez des tâches datées ou un jalon pour voir la roadmap.</CardDescription>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-3">
          <CardTitle>Jalons</CardTitle>
          <ul className="flex flex-col gap-1">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm">
                <Diamond aria-hidden="true" className="size-4" />
                <span className="flex-1">
                  <b>{m.name}</b> · {formatDay(m.date)}
                  {m.reachedAt ? " · atteint" : ""}
                </span>
                <form action={archiveMilestoneAction}>
                  <input type="hidden" name="milestoneId" value={m.id} />
                  <Button type="submit" variant="ghost" size="icon" aria-label={`Retirer le jalon ${m.name}`}>
                    <X aria-hidden="true" />
                  </Button>
                </form>
              </li>
            ))}
            {!milestones.length ? <li className="text-sm text-muted-foreground">Aucun jalon.</li> : null}
          </ul>
        </Card>
        <Card className="gap-3">
          <CardTitle>Nouveau jalon</CardTitle>
          <MilestoneForm projectId={id} lots={lotOptions} />
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        Alternative sans glisser-déposer : ouvrez une tâche puis « Modifier » pour changer ses dates. Chaque
        déplacement est enregistré et visible dans le journal du projet.
      </p>
    </>
  );
}

export default function RoadmapPage({ params }: PageProps<"/projets/[id]/roadmap">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <RoadmapView params={params} />
      </Suspense>
    </div>
  );
}
