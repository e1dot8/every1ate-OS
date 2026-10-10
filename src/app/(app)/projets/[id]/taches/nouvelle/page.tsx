import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { TaskForm } from "@/features/projects/components/forms";
import { getProject, listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nouvelle tâche" };

async function NewTask({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lot?: string }>;
}) {
  await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [project, associates] = await Promise.all([getProject(id), listAssociates()]);
  if (!project || project.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/projets/${id}`}>{project.name}</BackLink>
      <PageHeader title="Nouvelle tâche" />
      <Card className="max-w-2xl">
        <TaskForm
          projectId={id}
          defaultLotId={sp.lot}
          lots={project.workPackages.map((l) => ({ value: l.id, label: l.name }))}
          associates={associates.map((a) => ({ value: a.id, label: a.name }))}
        />
      </Card>
    </>
  );
}

export default function NewTaskPage({ params, searchParams }: PageProps<"/projets/[id]/taches/nouvelle">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <NewTask params={params} searchParams={searchParams as Promise<{ lot?: string }>} />
      </Suspense>
    </div>
  );
}
