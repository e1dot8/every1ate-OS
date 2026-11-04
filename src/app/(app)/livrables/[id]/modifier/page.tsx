import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, NotionPage } from "@/components/notion/blocks";
import { requireUser } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { formatEmojis } from "@/features/deliverables/rules";
import { DeliverableForm } from "@/features/deliverables/components/forms";
import { deliverableFormOptions, getDeliverable } from "@/features/deliverables/service";

export const metadata: Metadata = { title: "Modifier le livrable" };

async function EditDeliverable({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [d, options] = await Promise.all([getDeliverable(id), deliverableFormOptions()]);
  if (!d) notFound();
  const crumbs = [
    { label: "Livrables", href: "/livrables" },
    { label: d.title, href: `/livrables/${id}` },
  ];
  if (d.archivedAt || d.project.archivedAt)
    return (
      <NotionPage icon={formatEmojis[d.format]} crumbs={crumbs} title="Modifier le livrable">
        <Callout icon="🗄️" tone="warning">
          Ce livrable est archivé : restaurez-le depuis sa page pour le modifier.
        </Callout>
      </NotionPage>
    );
  return (
    <NotionPage icon={formatEmojis[d.format]} crumbs={crumbs} title="Modifier le livrable">
      <div className="max-w-2xl">
        <DeliverableForm
          deliverableId={id}
          initial={{
            projectId: d.projectId,
            workPackageId: d.workPackageId ?? "",
            title: d.title,
            format: d.format,
            channel: d.channel ?? "",
            ownerId: d.ownerId ?? "",
            dueDate: toDateInput(d.dueDate),
            publishDate: toDateInput(d.publishDate),
            link: d.link ?? "",
            notes: d.notes ?? "",
          }}
          projects={options.projects.map((p) => ({ value: p.id, label: p.name }))}
          lots={options.lots}
          associates={options.associates.map((a) => ({ value: a.id, label: a.name }))}
        />
      </div>
    </NotionPage>
  );
}

export default function EditDeliverablePage({ params }: PageProps<"/livrables/[id]/modifier">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditDeliverable params={params} />
    </Suspense>
  );
}
