import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, House } from "lucide-react";
import { redirect } from "next/navigation";
import { ensureInternalProject } from "@/features/projects/internal";
import { BackLink, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";

export const metadata: Metadata = { title: "Nouvelle tâche" };

/** Raccourci du bouton « + » : choisir le projet, puis le formulaire de tâche habituel. */
async function ChooseProject() {
  const user = await requireUser();
  const projects = await getDb().project.findMany({
    where: { archivedAt: null, internal: false, status: { notIn: ["TERMINE", "ARCHIVE"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, ownerId: true, client: { select: { name: true } } },
  });
  const mine = [...projects].sort((a, b) => Number(b.ownerId === user.id) - Number(a.ownerId === user.id));
  return (
    <>
      <form action={newInternalTaskAction}>
        <button
          type="submit"
          className="flex min-h-16 w-full items-center gap-3 rounded-xl border-2 border-ink bg-cream px-4 py-3 text-left hover:bg-highlight/40"
        >
          <House aria-hidden="true" className="size-5 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <b>Tâche interne, sans client</b>
            <span className="text-sm text-muted-foreground">
              Développement de l&apos;agence, gestion, visibilité, apprentissage, entraide
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
        </button>
      </form>
      {projects.length ? (
        <ProjectList projects={mine} />
      ) : (
        <EmptyState title="Aucun projet client en cours.">
          <Link href="/projets/nouveau" className="font-bold underline">
            Créer un projet
          </Link>
        </EmptyState>
      )}
    </>
  );
}

function ProjectList({
  projects: mine,
}: {
  projects: { id: string; name: string; client: { name: string } | null }[];
}) {
  return (
    <Card className="gap-0 py-1">
      <ul aria-label="Projets en cours">
        {mine.map((p) => (
          <li key={p.id}>
            <Link
              href={`/projets/${p.id}/taches/nouvelle`}
              className="flex min-h-14 items-center gap-3 border-b py-3 last:border-b-0 hover:bg-muted/60"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate">{p.name}</b>
                <span className="text-sm text-muted-foreground">{p.client?.name ?? "Sans client"}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

async function newInternalTaskAction() {
  "use server";
  const user = await requireUser();
  const id = await ensureInternalProject(user);
  redirect(`/projets/${id}/taches/nouvelle`);
}

export default function NewTaskShortcutPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/taches">Tâches</BackLink>
      <PageHeader title="Nouvelle tâche" description="Pour un projet client, ou pour la maison ?" />
      <Suspense fallback={<PageLoading />}>
        <ChooseProject />
      </Suspense>
    </div>
  );
}
