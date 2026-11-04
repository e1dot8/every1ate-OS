import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CalendarDays,
  CircleDot,
  ExternalLink,
  FolderKanban,
  Hash,
  Layers,
  Link2,
  MessagesSquare,
  Pencil,
  Shapes,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import {
  Callout,
  EmptyLine,
  NotionPage,
  Properties,
  Property,
  Section,
  Toggle,
} from "@/components/notion/blocks";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { requireUser } from "@/lib/auth/session";
import { formatDay, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { activityText, formatEmojis, formatLabels, isLate, stageLabels } from "@/features/deliverables/rules";
import { deliverableActivity, deliverableFormOptions, getDeliverable } from "@/features/deliverables/service";
import { BlockedBadge, StageBadge } from "@/features/deliverables/components/bits";
import { StageChecklists } from "@/features/deliverables/components/checklist";
import { BlockForm, NotesForm } from "@/features/deliverables/components/forms";
import { StageTrack } from "@/features/deliverables/components/stage-track";
import { SubjectDiscussion } from "@/features/discussions/components/subject-discussion";
import { archiveDeliverableAction, unblockDeliverableAction } from "../actions";

export const metadata: Metadata = { title: "Livrable" };

function ArchiveButton({ id, archived }: { id: string; archived: boolean }) {
  return (
    <form action={archiveDeliverableAction}>
      <input type="hidden" name="deliverableId" value={id} />
      <input type="hidden" name="archived" value={String(!archived)} />
      <SubmitButton variant="ghost" pendingLabel={archived ? "Restauration…" : "Archivage…"}>
        {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
        {archived ? "Restaurer" : "Archiver"}
      </SubmitButton>
    </form>
  );
}

async function DeliverableView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modifier?: string | string[] }>;
}) {
  const user = await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const editingId = typeof sp.modifier === "string" && sp.modifier ? sp.modifier : null;
  const d = await getDeliverable(id);
  if (!d) notFound();
  const [activity, options] = await Promise.all([deliverableActivity(id), deliverableFormOptions()]);
  const today = todayDate();
  const archived = !!d.archivedAt || !!d.project.archivedAt;
  const late = isLate(d, today);
  const blocked = !!d.blockedReason && d.stage !== "LIVRE";
  const associates = options.associates.map((a) => ({ value: a.id, label: a.name }));

  return (
    <NotionPage
      icon={formatEmojis[d.format]}
      crumbs={[
        { label: "Livrables", href: "/livrables" },
        { label: d.project.name, href: `/projets/${d.project.id}?onglet=livrables` },
      ]}
      title={d.title}
      actions={
        <>
          {!archived ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/livrables/${id}/modifier`}>
                <Pencil aria-hidden="true" /> Modifier
              </Link>
            </Button>
          ) : null}
          {!d.project.archivedAt ? <ArchiveButton id={id} archived={!!d.archivedAt} /> : null}
        </>
      }
    >
      {d.archivedAt ? (
        <Callout icon="🗄️" tone="warning">
          Livrable archivé le {formatDay(todayDate(d.archivedAt))} : il n&apos;apparaît plus dans la base.
          Restaurez-le pour le modifier.
        </Callout>
      ) : null}
      {blocked ? (
        <Callout icon="⛔" tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              <b>Bloqué</b> : {d.blockedReason}
            </p>
            {!archived ? (
              <form action={unblockDeliverableAction}>
                <input type="hidden" name="deliverableId" value={id} />
                <SubmitButton variant="outline" pendingLabel="Déblocage…">
                  Débloquer
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </Callout>
      ) : null}
      {late && !archived ? (
        <Callout icon="⏰" tone="warning">
          Échéance dépassée ({formatDay(d.dueDate)}).{" "}
          <Link href={`/livrables/${id}/modifier`} className="font-bold underline">
            Changer l&apos;échéance
          </Link>{" "}
          ou avancer la checklist ci-dessous.
        </Callout>
      ) : null}
      {d.stage === "LIVRE" ? (
        <Callout icon="🎉" tone="success">
          Livré le {formatDay(todayDate(d.deliveredAt ?? d.updatedAt))}.
        </Callout>
      ) : null}

      <Properties>
        <Property icon={FolderKanban} label="Projet">
          <Link href={`/projets/${d.project.id}`} className="font-bold hover:underline">
            {d.project.name}
          </Link>
        </Property>
        <Property icon={Layers} label="Lot">
          {d.workPackage ? (
            <Link href={`/projets/${d.project.id}/lots/${d.workPackage.id}`} className="hover:underline">
              {d.workPackage.name}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Property>
        <Property icon={Shapes} label="Format">
          {formatEmojis[d.format]} {formatLabels[d.format]}
        </Property>
        <Property icon={Hash} label="Canal">
          {d.channel ?? <span className="text-muted-foreground">—</span>}
        </Property>
        <Property icon={UserRound} label="Responsable">
          {d.owner ? (
            <span className="inline-flex items-center gap-2">
              <Avatar name={d.owner.name} className="size-6 text-[10px]" />
              {d.owner.name}
            </span>
          ) : (
            <span className="text-muted-foreground">Personne</span>
          )}
        </Property>
        <Property icon={CalendarDays} label="Échéance">
          <span className={cn(late && "font-bold text-danger")}>
            {late ? "En retard · " : ""}
            {formatDay(d.dueDate)}
          </span>
        </Property>
        <Property icon={CalendarClock} label="Publication">
          {formatDay(d.publishDate)}
        </Property>
        <Property icon={Link2} label="Lien">
          {d.link ? (
            <a
              href={d.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 break-all underline decoration-pen underline-offset-4"
            >
              {d.link.replace(/^https:\/\//, "")}
              <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Property>
        <Property icon={CircleDot} label="Statut">
          <span className="inline-flex flex-wrap items-center gap-2" role="status">
            <StageBadge stage={d.stage} />
            {blocked ? <BlockedBadge reason={d.blockedReason} /> : null}
            <span className="sr-only">Étape : {stageLabels[d.stage]}</span>
          </span>
        </Property>
      </Properties>

      <TextLink href="#discussion" className="w-fit">
        <MessagesSquare aria-hidden="true" className="size-4" />
        Discuter de ce livrable
      </TextLink>

      <Section id="etapes" title="Étapes">
        <StageTrack deliverableId={id} stage={d.stage} items={d.checkItems} readOnly={archived} />
        {!archived && !blocked && d.stage !== "LIVRE" ? (
          <Toggle title="Signaler un blocage">
            <BlockForm deliverableId={id} />
          </Toggle>
        ) : null}
      </Section>

      <Section id="checklist" title="Checklist">
        <StageChecklists deliverable={d} associates={associates} readOnly={archived} />
      </Section>

      <Section id="notes" title="Notes">
        {archived ? (
          d.notes ? (
            <p className="whitespace-pre-line">{d.notes}</p>
          ) : (
            <EmptyLine>Aucune note.</EmptyLine>
          )
        ) : (
          <NotesForm deliverableId={id} notes={d.notes ?? ""} />
        )}
      </Section>

      <SubjectDiscussion subject={{ type: "deliverable", id }} viewerId={user.id} editingId={editingId} />

      <Section id="activite" title="Activité" count={activity.length || undefined}>
        {activity.length ? (
          <ol aria-label="Activité du livrable" className="flex flex-col">
            {activity.map((e) => (
              <li key={e.id} className="rounded-md px-1 py-1.5 text-sm hover:bg-muted/60">
                <b>{e.actorName}</b> {activityText(e.action, e.before, e.after)}{" "}
                <span className="text-muted-foreground">· {formatDay(todayDate(e.createdAt))}</span>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyLine>Aucune activité pour l&apos;instant.</EmptyLine>
        )}
      </Section>
    </NotionPage>
  );
}

export default function DeliverablePage({ params, searchParams }: PageProps<"/livrables/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <DeliverableView
        params={params}
        searchParams={searchParams as Promise<{ modifier?: string | string[] }>}
      />
    </Suspense>
  );
}
