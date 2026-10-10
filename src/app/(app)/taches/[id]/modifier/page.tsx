import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { TaskForm } from "@/features/projects/components/forms";
import { getTask, listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { toDateInput } from "@/lib/dates";

export const metadata: Metadata = { title: "Modifier la tâche" };

async function EditTask({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const task = await getTask(id);
  if (!task || task.archivedAt) notFound();
  const [associates, lots] = await Promise.all([
    listAssociates(),
    getDb().workPackage.findMany({
      where: { projectId: task.projectId, archivedAt: null },
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return (
    <>
      <BackLink href={`/taches/${id}`}>{task.title}</BackLink>
      <PageHeader
        title="Modifier la tâche"
        description="Les changements de dates et de responsable sont historisés."
      />
      <Card className="max-w-2xl">
        <TaskForm
          projectId={task.projectId}
          lots={lots.map((l) => ({ value: l.id, label: l.name }))}
          associates={associates.map((a) => ({ value: a.id, label: a.name }))}
          task={{
            id,
            title: task.title,
            description: task.description,
            workPackageId: task.workPackageId,
            ownerId: task.ownerId,
            contributorIds: task.contributors.map((c) => c.userId),
            priority: task.priority,
            priorityLocked: task.priorityLocked,
            impact: task.impact,
            startDate: toDateInput(task.startDate),
            dueDate: toDateInput(task.dueDate),
            estimatedHours: task.estimatedMinutes
              ? String(Math.round((task.estimatedMinutes / 60) * 10) / 10)
              : "",
          }}
        />
      </Card>
    </>
  );
}

export default function EditTaskPage({ params }: PageProps<"/taches/[id]/modifier">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <EditTask params={params} />
      </Suspense>
    </div>
  );
}
