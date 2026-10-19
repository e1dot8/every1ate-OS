import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { listNotes, type NoteFilter } from "@/features/notes/service";
import { pendingActionsLabel, tasksCreatedLabel } from "@/features/notes/rules";
import { formatDay } from "@/lib/dates";

type NoteItem = Awaited<ReturnType<typeof listNotes>>[number];

/** Liste de comptes rendus : date, titre, auteur, tâches créées et actions encore à traiter. */
export function NoteList({ notes, showLinks }: { notes: NoteItem[]; showLinks?: boolean }) {
  return (
    <ul className="flex flex-col" aria-label="Comptes rendus">
      {notes.map((n) => {
        const links = showLinks
          ? [n.project?.name, n.client?.name, n.opportunity?.title].filter(Boolean).join(" · ")
          : "";
        return (
          <li key={n.id} className="flex flex-col gap-0.5 border-b py-2.5 text-sm last:border-b-0">
            <Link href={`/notes/${n.id}`} className="font-bold hover:underline">
              {n.title}
            </Link>
            <span className="text-[13px] text-muted-foreground">
              {formatDay(n.occurredAt)} · {n.author.name} · {tasksCreatedLabel(n.createdTasks)}
              {n.pendingActions ? (
                <b className="text-pen-strong"> · {pendingActionsLabel(n.pendingActions)}</b>
              ) : null}
            </span>
            {links ? <span className="text-[13px] text-muted-foreground">{links}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Section « Comptes rendus » d'une fiche (projet, entreprise, opportunité, événement) :
 * les comptes rendus rattachés, du plus récent au plus ancien, et le lien pour en rédiger un.
 */
export async function NotesSection({
  filter,
  newHref,
  newLabel = "Nouveau compte rendu",
  readOnly,
}: {
  filter: Omit<NoteFilter, "take">;
  newHref: string;
  newLabel?: string;
  readOnly?: boolean;
}) {
  const notes = await listNotes({ ...filter, take: 20 });
  return (
    <Card className="gap-3" id="comptes-rendus">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Comptes rendus</CardTitle>
        {!readOnly ? (
          <Button asChild variant="outline" size="sm">
            <Link href={newHref}>
              <NotebookPen aria-hidden="true" /> {newLabel}
            </Link>
          </Button>
        ) : null}
      </div>
      {notes.length ? (
        <NoteList notes={notes} />
      ) : (
        <p className="text-sm text-muted-foreground">Aucun compte rendu pour l&apos;instant.</p>
      )}
    </Card>
  );
}
