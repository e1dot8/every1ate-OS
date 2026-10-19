import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { BackLink, EmptyState } from "@/components/app/bits";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NoteList } from "@/features/notes/components/notes-section";
import { SyntaxHelp } from "@/features/notes/components/syntax-help";
import { listNotes } from "@/features/notes/service";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Comptes rendus" };

async function Notes() {
  await requireUser();
  const notes = await listNotes({ take: 200 });
  if (!notes.length)
    return (
      <EmptyState title="Aucun compte rendu pour l'instant.">
        <div className="flex flex-col gap-3">
          <p>
            Écrivez vos notes de réunion comme d&apos;habitude : les lignes d&apos;action deviennent des
            tâches en un clic, après votre confirmation.
          </p>
          <SyntaxHelp />
          <Link href="/notes/nouvelle" className="font-bold text-foreground underline">
            Rédiger un premier compte rendu
          </Link>
        </div>
      </EmptyState>
    );
  return (
    <Card className="gap-0 py-1">
      <NoteList notes={notes} showLinks />
    </Card>
  );
}

export default function NotesPage() {
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/plus">Plus</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Comptes rendus" description="Notes de réunion transformées en tâches, sans IA." />
        <Button asChild>
          <Link href="/notes/nouvelle">
            <Plus aria-hidden="true" /> Compte rendu
          </Link>
        </Button>
      </div>
      <Suspense fallback={<PageLoading />}>
        <Notes />
      </Suspense>
    </div>
  );
}
