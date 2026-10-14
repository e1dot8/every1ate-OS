import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink, Search } from "lucide-react";
import { EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { listAllFiles } from "@/features/documents/service";
import { requireUser } from "@/lib/auth/session";
import { formatDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Documents" };

async function Files({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const files = await listAllFiles(sp.q?.trim() || undefined);
  return (
    <>
      <form
        role="search"
        action="/documents"
        className="flex min-h-tap items-center gap-2 rounded-lg border border-input px-3"
      >
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={sp.q}
          aria-label="Rechercher un document"
          placeholder="Rechercher un document"
          className="border-0 px-0 focus-visible:outline-none"
        />
      </form>
      {files.length ? (
        <Card className="gap-0 py-1">
          <ul>
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 border-b py-3 text-sm last:border-b-0">
                <div className="flex min-w-0 flex-1 flex-col">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold hover:underline"
                  >
                    {f.title} <ExternalLink aria-hidden="true" className="size-3" />
                  </a>
                  <span className="truncate text-muted-foreground">
                    {f.project ? (
                      <Link href={`/projets/${f.project.id}?onglet=docs`} className="underline">
                        {f.project.name}
                      </Link>
                    ) : f.client ? (
                      <Link href={`/crm/clients/${f.client.id}`} className="underline">
                        {f.client.name}
                      </Link>
                    ) : null}
                    {f.task ? ` · ${f.task.title}` : ""} · {f.addedBy.name} · {formatDay(f.createdAt)}
                  </span>
                </div>
                {f.status === "INTROUVABLE" ? <StatusBadge tone="danger" label="Lien supprimé" /> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Aucun document référencé.">
          Ajoutez des liens Drive depuis un projet, une tâche ou un client.
        </EmptyState>
      )}
      <p className="text-xs text-muted-foreground">
        Les fichiers restent dans Google Drive ; l&apos;accès est contrôlé par Google. Stockage des médias
        volumineux : bientôt disponible.
      </p>
    </>
  );
}

export default function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Documents"
        description="Références Google Drive rattachées aux projets, tâches et clients."
      />
      <Suspense fallback={<PageLoading />}>
        <Files searchParams={searchParams as Promise<{ q?: string }>} />
      </Suspense>
    </div>
  );
}
