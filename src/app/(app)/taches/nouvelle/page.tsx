import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
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
    where: { archivedAt: null, status: { notIn: ["TERMINE", "ARCHIVE"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, ownerId: true, client: { select: { name: true } } },
  });
  const mine = [...projects].sort((a, b) => Number(b.ownerId === user.id) - Number(a.ownerId === user.id));
  if (!projects.length)
    return (
      <EmptyState title="Aucun projet en cours.">
        <Link href="/projets/nouveau" className="font-bold underline">
          Créer un projet
        </Link>
      </EmptyState>
    );
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

export default function NewTaskShortcutPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/taches">Tâches</BackLink>
      <PageHeader title="Nouvelle tâche" description="Dans quel projet ?" />
      <Suspense fallback={<PageLoading />}>
        <ChooseProject />
      </Suspense>
    </div>
  );
}
