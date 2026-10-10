import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArchiveRestore } from "lucide-react";
import { EmptyState } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { listArchives } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/dates";
import { archiveAction, restoreProjectAction } from "../../projets/actions";

export const metadata: Metadata = { title: "Archives" };

function Restore({ kind, id }: { kind: "lot" | "task"; id: string }) {
  return (
    <form action={archiveAction}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value="false" />
      <SubmitButton variant="ghost">
        <ArchiveRestore aria-hidden="true" /> Restaurer
      </SubmitButton>
    </form>
  );
}

async function Archives() {
  await requireUser();
  const { projects, lots, tasks } = await listArchives();
  if (!projects.length && !lots.length && !tasks.length) return <EmptyState title="Rien n'est archivé." />;
  const Row = ({ title, sub, action }: { title: React.ReactNode; sub: string; action: React.ReactNode }) => (
    <li className="flex flex-wrap items-center gap-3 border-b py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">{title}</span>
        <span className="text-[13px] text-muted-foreground">{sub}</span>
      </div>
      {action}
    </li>
  );
  return (
    <>
      {projects.length ? (
        <Card className="gap-1">
          <CardTitle>Projets</CardTitle>
          <ul>
            {projects.map((p) => (
              <Row
                key={p.id}
                title={
                  <Link href={`/projets/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                }
                sub={`Archivé ${formatDateTime(p.archivedAt)}`}
                action={
                  <form action={restoreProjectAction}>
                    <input type="hidden" name="projectId" value={p.id} />
                    <SubmitButton variant="ghost">
                      <ArchiveRestore aria-hidden="true" /> Restaurer
                    </SubmitButton>
                  </form>
                }
              />
            ))}
          </ul>
        </Card>
      ) : null}
      {lots.length ? (
        <Card className="gap-1">
          <CardTitle>Lots</CardTitle>
          <ul>
            {lots.map((l) => (
              <Row
                key={l.id}
                title={l.name}
                sub={`${l.project.name} · archivé ${formatDateTime(l.archivedAt)}`}
                action={<Restore kind="lot" id={l.id} />}
              />
            ))}
          </ul>
        </Card>
      ) : null}
      {tasks.length ? (
        <Card className="gap-1">
          <CardTitle>Tâches</CardTitle>
          <ul>
            {tasks.map((t) => (
              <Row
                key={t.id}
                title={
                  <Link href={`/taches/${t.id}`} className="hover:underline">
                    {t.title}
                  </Link>
                }
                sub={`${t.project.name} · archivée ${formatDateTime(t.archivedAt)}`}
                action={<Restore kind="task" id={t.id} />}
              />
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

export default function ArchivesPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumb="Plus › Archives"
        title="Archives"
        description="Rien n'est supprimé : tout ce qui est archivé peut être restauré."
      />
      <Suspense fallback={<PageLoading />}>
        <Archives />
      </Suspense>
    </div>
  );
}
