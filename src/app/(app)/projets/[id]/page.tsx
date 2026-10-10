import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  AlertOctagon,
  CalendarDays,
  Check,
  GanttChart,
  Layers,
  ListChecks,
  Pencil,
  Plus,
} from "lucide-react";
import {
  Avatar,
  BackLink,
  EmptyState,
  Meta,
  PhaseSteps,
  ProjectStatusBadge,
  Tabs,
  TaskRow,
  TaskStatusBadge,
} from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/select";
import { OwnerForm, ProjectStatusForm } from "@/features/projects/components/forms";
import { journalDetail, journalLabel } from "@/features/projects/journal-labels";
import { getProject, listAssociates, projectJournal } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatDay } from "@/lib/dates";
import { saveReviewAction, toggleClosureAction } from "../actions";
import type { TaskStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Projet" };

const TABS = [
  { key: "vue", label: "Vue d'ensemble" },
  { key: "lots", label: "Lots" },
  { key: "taches", label: "Tâches" },
  { key: "cloture", label: "Clôture" },
  { key: "journal", label: "Journal" },
];

function lotStatus(tasks: { status: TaskStatus }[]): TaskStatus {
  const live = tasks.filter((t) => t.status !== "ANNULE");
  if (!live.length) return "A_FAIRE";
  if (live.every((t) => t.status === "TERMINE")) return "TERMINE";
  if (live.some((t) => t.status === "BLOQUE")) return "BLOQUE";
  if (live.some((t) => t.status !== "A_FAIRE")) return "EN_COURS";
  return "A_FAIRE";
}

async function ProjectView({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string; deja?: string }>;
}) {
  await requireUser();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const project = await getProject(id);
  if (!project) notFound();
  const tab = TABS.some((t) => t.key === sp.onglet) ? sp.onglet! : "vue";
  const tasks = project.tasks;
  const blocked = tasks.filter((t) => t.status === "BLOQUE");
  const done = tasks.filter((t) => t.status === "TERMINE").length;
  const live = tasks.filter((t) => t.status !== "ANNULE").length;
  const closureLeft = project.closureItems.filter((c) => !c.checked).length;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/projets">Projets</BackLink>
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.client?.name ?? "Sans client"}
            {project.archivedAt ? " · archivé" : ""}
          </p>
        </div>
        {!project.archivedAt ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/projets/${id}/roadmap`}>
                <GanttChart aria-hidden="true" /> Roadmap
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/projets/${id}/modifier`}>
                <Pencil aria-hidden="true" /> Modifier
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/projets/${id}/taches/nouvelle`}>
                <Plus aria-hidden="true" /> Tâche
              </Link>
            </Button>
          </div>
        ) : null}
      </header>
      {sp.deja ? (
        <FormAlert tone="info" title="Ce projet existait déjà pour cette opportunité : aucun doublon créé." />
      ) : null}
      {project.opportunity ? (
        <p className="text-sm text-muted-foreground">
          Issu de l&apos;opportunité{" "}
          <Link href={`/crm/opportunites/${project.opportunity.id}`} className="font-bold underline">
            {project.opportunity.title}
          </Link>
        </p>
      ) : null}
      <PhaseSteps phase={project.phase} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ProjectStatusBadge status={project.status} />
        <span className="inline-flex items-center gap-2 text-[13px]">
          <Avatar name={project.owner.name} /> {project.owner.name} · responsable global
        </span>
        <Meta icon={CalendarDays}>
          {formatDay(project.startDate)} → {formatDay(project.plannedEndDate)}
        </Meta>
        <Meta icon={ListChecks}>
          {done}/{live} tâches
        </Meta>
      </div>
      {project.statusReason ? (
        <FormAlert
          tone={project.status === "BLOQUE" ? "danger" : "warning"}
          title={`Projet ${project.status === "BLOQUE" ? "bloqué" : "en attente"}`}
        >
          {project.statusReason}
        </FormAlert>
      ) : null}
      <Tabs items={TABS.map((t) => ({ ...t, href: `/projets/${id}?onglet=${t.key}` }))} active={tab} />

      {tab === "vue" ? (
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {blocked.length ? (
              <FormAlert
                tone="danger"
                title={`${blocked.length} tâche${blocked.length > 1 ? "s" : ""} bloquée${blocked.length > 1 ? "s" : ""}`}
              >
                {blocked
                  .map((t) => `« ${t.title} » : ${t.blockedReason ?? "raison non précisée"}`)
                  .join(" · ")}
              </FormAlert>
            ) : null}
            {project.description ? <p className="max-w-prose">{project.description}</p> : null}
            <LotGrid projectId={id} lots={project.workPackages} />
          </div>
          {!project.archivedAt ? (
            <aside className="flex w-full flex-col gap-4 md:w-80">
              <Card className="gap-3">
                <CardTitle>Statut</CardTitle>
                <ProjectStatusForm projectId={id} status={project.status} />
              </Card>
              <Card className="gap-3">
                <CardTitle>Responsable global</CardTitle>
                <OwnerForm
                  projectId={id}
                  ownerId={project.ownerId}
                  associates={(await listAssociates()).map((a) => ({ value: a.id, label: a.name }))}
                />
              </Card>
            </aside>
          ) : null}
        </div>
      ) : null}

      {tab === "lots" ? (
        <div className="flex flex-col gap-4">
          <div>
            <Button asChild variant="outline">
              <Link href={`/projets/${id}/lots/nouveau`}>
                <Plus aria-hidden="true" /> Nouveau lot
              </Link>
            </Button>
          </div>
          <LotGrid projectId={id} lots={project.workPackages} />
        </div>
      ) : null}

      {tab === "taches" ? (
        tasks.length ? (
          <Card className="gap-0 py-1">
            <ul aria-label="Tâches du projet">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState title="Aucune tâche.">
            <Link className="font-bold underline" href={`/projets/${id}/taches/nouvelle`}>
              Ajouter une tâche
            </Link>
          </EmptyState>
        )
      ) : null}

      {tab === "cloture" ? (
        <div className="flex flex-col gap-4">
          {project.status === "TERMINE" || project.status === "ARCHIVE" ? (
            <FormAlert tone="success" title={`Projet clôturé le ${formatDay(project.closedAt)}.`} />
          ) : (
            <FormAlert
              tone={closureLeft ? "warning" : "success"}
              title={
                closureLeft
                  ? `${closureLeft} point${closureLeft > 1 ? "s" : ""} à traiter avant de clôturer.`
                  : "Checklist complète : le responsable global peut clôturer."
              }
            >
              Le statut « Terminé » n&apos;est possible qu&apos;avec la checklist complète. Le responsable
              global confirme la clôture (Vue d&apos;ensemble › Statut).
            </FormAlert>
          )}
          <Card className="gap-0 py-1">
            <ul aria-label="Checklist de clôture">
              {project.closureItems.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                  <form action={toggleClosureAction}>
                    <input type="hidden" name="projectId" value={id} />
                    <input type="hidden" name="itemId" value={c.id} />
                    <input type="hidden" name="checked" value={String(!c.checked)} />
                    <button
                      type="submit"
                      aria-label={`${c.checked ? "Décocher" : "Cocher"} : ${c.label}`}
                      aria-pressed={c.checked}
                      className={`flex size-tap items-center justify-center rounded-lg border ${c.checked ? "border-ink bg-ink text-paper" : "border-input"}`}
                    >
                      {c.checked ? <Check aria-hidden="true" className="size-4" /> : null}
                    </button>
                  </form>
                  <div className="flex flex-col">
                    <span className="font-bold">{c.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {c.checked
                        ? `${c.checkedBy?.name ?? "—"} · ${formatDateTime(c.checkedAt)}`
                        : c.key === "couts" || c.key === "facturation"
                          ? "À vérifier dans l'onglet Finance du projet"
                          : "À faire"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="gap-3">
            <CardHeader>
              <CardTitle>Bilan du projet</CardTitle>
              <CardDescription>Enseignements, points forts, points à améliorer.</CardDescription>
            </CardHeader>
            <form action={saveReviewAction} className="flex flex-col gap-3">
              <input type="hidden" name="projectId" value={id} />
              <Textarea
                name="review"
                rows={5}
                aria-label="Bilan du projet"
                defaultValue={project.closingReview ?? ""}
              />
              <div>
                <SubmitButton variant="outline">Enregistrer le bilan</SubmitButton>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      {tab === "journal" ? <Journal projectId={id} /> : null}
    </div>
  );
}

function LotGrid({
  projectId,
  lots,
}: {
  projectId: string;
  lots: {
    id: string;
    name: string;
    owner: { name: string } | null;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    tasks: { status: TaskStatus }[];
  }[];
}) {
  if (!lots.length)
    return (
      <EmptyState title="Aucun lot.">
        <Link className="font-bold underline" href={`/projets/${projectId}/lots/nouveau`}>
          Créer un lot
        </Link>
      </EmptyState>
    );
  return (
    <ul className="grid gap-3 md:grid-cols-2" aria-label="Lots">
      {lots.map((l) => {
        const live = l.tasks.filter((t) => t.status !== "ANNULE");
        return (
          <li key={l.id}>
            <Card className="h-full gap-2 p-4">
              <div className="flex items-center gap-2">
                <Layers aria-hidden="true" className="size-5" />
                <Link
                  href={`/projets/${projectId}/lots/${l.id}`}
                  className="flex-1 font-bold hover:underline"
                >
                  {l.name}
                </Link>
                <Avatar name={l.owner?.name} />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <TaskStatusBadge status={lotStatus(l.tasks)} />
                <Meta icon={ListChecks}>
                  {live.filter((t) => t.status === "TERMINE").length}/{live.length} tâches
                </Meta>
                {l.plannedStart ? (
                  <Meta icon={CalendarDays}>
                    {formatDay(l.plannedStart)} → {formatDay(l.plannedEnd)}
                  </Meta>
                ) : null}
                {l.tasks.some((t) => t.status === "BLOQUE") ? (
                  <Meta icon={AlertOctagon} tone="danger">
                    Blocage
                  </Meta>
                ) : null}
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

async function Journal({ projectId }: { projectId: string }) {
  const events = await projectJournal(projectId);
  if (!events.length) return <EmptyState title="Journal vide." />;
  return (
    <Card className="gap-0 py-1">
      <ol aria-label="Journal du projet">
        {events.map((e) => {
          const detail = journalDetail(e.before, e.after);
          return (
            <li key={e.id} className="flex flex-col border-b py-2.5 last:border-b-0">
              <span className="text-sm">
                <b>{e.actorName}</b> {journalLabel(e.action)}
              </span>
              <span className="text-[13px] text-muted-foreground">
                {formatDateTime(e.createdAt)}
                {detail ? ` · ${detail}` : ""}
                {e.reason ? ` · Motif : ${e.reason}` : ""}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export default function ProjectPage({ params, searchParams }: PageProps<"/projets/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProjectView
        params={params}
        searchParams={searchParams as Promise<{ onglet?: string; deja?: string }>}
      />
    </Suspense>
  );
}
