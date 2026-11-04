import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/layout/page-header";
import { Callout, NotionPage } from "@/components/notion/blocks";
import { TextLink } from "@/components/ui/text-link";
import { requireUser } from "@/lib/auth/session";
import { DeliverableForm } from "@/features/deliverables/components/forms";
import { deliverableFormOptions } from "@/features/deliverables/service";

export const metadata: Metadata = { title: "Nouveau livrable" };

type Search = Record<string, string | string[] | undefined>;

async function NewDeliverable({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const [sp, options] = await Promise.all([searchParams, deliverableFormOptions()]);
  const wanted = typeof sp.projet === "string" ? sp.projet : "";
  const projectId = options.projects.some((p) => p.id === wanted) ? wanted : "";
  if (!options.projects.length)
    return (
      <Callout icon="📁">
        Un livrable appartient toujours à un projet.{" "}
        <TextLink href="/projets/nouveau">Créer d&apos;abord un projet</TextLink>
      </Callout>
    );
  return (
    <div className="max-w-2xl">
      <DeliverableForm
        initial={{
          projectId,
          workPackageId: "",
          title: "",
          format: "VIDEO",
          channel: "",
          ownerId: user.id,
          dueDate: "",
          publishDate: "",
          link: "",
          notes: "",
        }}
        projects={options.projects.map((p) => ({ value: p.id, label: p.name }))}
        lots={options.lots}
        associates={options.associates.map((a) => ({ value: a.id, label: a.name }))}
      />
    </div>
  );
}

export default function NewDeliverablePage({ searchParams }: PageProps<"/livrables/nouveau">) {
  return (
    <NotionPage
      icon="✨"
      title="Nouveau livrable"
      crumbs={[{ label: "Livrables", href: "/livrables" }]}
      description="La checklist type du format est créée avec le livrable ; elle reste modifiable."
    >
      <Suspense fallback={<PageLoading />}>
        <NewDeliverable searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </NotionPage>
  );
}
