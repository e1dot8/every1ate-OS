import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ProjectForm } from "@/features/projects/components/forms";
import { getProject, listClients } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";

export const metadata: Metadata = { title: "Modifier le projet" };

async function Edit({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [project, clients] = await Promise.all([getProject(id), listClients()]);
  if (!project || project.archivedAt) notFound();
  return (
    <>
      <BackLink href={`/projets/${id}`}>{project.name}</BackLink>
      <PageHeader
        title="Modifier le projet"
        description="Chaque modification de dates ou de périmètre est historisée."
      />
      <Card className="max-w-2xl">
        <ProjectForm
          clients={clients.map((c) => ({ value: c.id, label: c.name }))}
          project={{
            id,
            name: project.name,
            description: project.description,
            clientId: project.clientId,
            phase: project.phase,
            startDate: toDateInput(project.startDate),
            plannedEndDate: toDateInput(project.plannedEndDate),
          }}
        />
      </Card>
    </>
  );
}

export default function EditProjectPage({ params }: PageProps<"/projets/[id]/modifier">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <Edit params={params} />
      </Suspense>
    </div>
  );
}
