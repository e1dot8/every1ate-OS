import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Archive, ArchiveRestore, Link2, Pencil, X } from "lucide-react";
import { Avatar, BackLink, TaskStatusBadge } from "@/components/app/bits";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageLoading } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DependencyForm, TaskStatusForm } from "@/features/projects/components/forms";
import { priorityLabels } from "@/features/projects/labels";
import { journalDetail, journalLabel } from "@/features/projects/journal-labels";
import { getTask } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { formatDateTime, formatDay } from "@/lib/dates";
import { archiveAction, removeDependencyAction } from "../../projets/actions";

export const metadata: Metadata = { title: "Tâche" };

async function TaskView({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const task = await getTask(id);
  if (!task) notFound();
  const db = getDb();
  const [others, history] = await Promise.all([
    db.task.findMany({
      where: { projectId: task.projectId, archivedAt: null, id: { not: id } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    db.auditEvent.findMany({
      where: { targetType: "task", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);
  const names = new Map(
    (await db.user.findMany({ select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );
  const waiting = task.dependsOn.filter((d) => !["TERMINE", "ANNULE"].includes(d.dependsOn.status));
  const linked = new Set(task.dependsOn.map((d) => d.dependsOnId));

  return (
    <>
      <BackLink
        href={
          task.workPackage
            ? `/projets/${task.projectId}/lots/${task.workPackage.id}`
            : `/projets/${task.projectId}`
        }
      >
        {task.project.name}
        {task.workPackage ? ` › ${task.workPackage.name}` : ""}
      </BackLink>
      <h1 className="text-3xl leading-tight font-bold tracking-tight md:text-4xl">{task.title}</h1>
      {task.archivedAt ? <FormAlert tone="warning" title="Tâche archivée." /> : null}
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <aside className="order-first flex w-full flex-col gap-4 md:order-last md:w-80">
          <Card className="gap-0 py-2">
            {[
              ["Statut", <TaskStatusBadge key="s" status={task.status} />],
              [
                "Responsable",
                <span key="o" className="inline-flex items-center gap-2">
                  <Avatar name={task.owner?.name} />
                  {task.owner?.name ?? "Non assignée"}
                </span>,
              ],
              ["Contributeurs", task.contributors.map((c) => c.user.name).join(", ") || "—"],
              ["Lot", task.workPackage?.name ?? "—"],
              ["Début", formatDay(task.startDate)],
              ["Échéance", formatDay(task.dueDate)],
              [
                "Durée estimée",
                task.estimatedMinutes ? `${Math.round((task.estimatedMinutes / 60) * 10) / 10} h` : "—",
              ],
              ["Priorité", priorityLabels[task.priority]],
            ].map(([k, v]) => (
              <div
                key={String(k)}
                className="flex items-center justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{k}</span>
                <b className="text-right">{v}</b>
              </div>
            ))}
          </Card>
          {!task.archivedAt ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`/taches/${id}/modifier`}>
                  <Pencil aria-hidden="true" /> Modifier
                </Link>
              </Button>
              <form action={archiveAction}>
                <input type="hidden" name="kind" value="task" />
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="archived" value="true" />
                <SubmitButton variant="ghost">
                  <Archive aria-hidden="true" /> Archiver
                </SubmitButton>
              </form>
            </div>
          ) : (
            <form action={archiveAction}>
              <input type="hidden" name="kind" value="task" />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="archived" value="false" />
              <SubmitButton variant="outline">
                <ArchiveRestore aria-hidden="true" /> Restaurer
              </SubmitButton>
            </form>
          )}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {task.status === "BLOQUE" ? (
            <FormAlert tone="danger" title={`Bloquée : ${task.blockedReason ?? "raison non précisée"}`}>
              {task.blockedNextAction ? `Prochaine action : ${task.blockedNextAction}. ` : ""}
              {task.blockedReviewDate ? `Réexamen le ${formatDay(task.blockedReviewDate)}.` : ""}
            </FormAlert>
          ) : null}
          {waiting.length ? (
            <FormAlert
              tone="warning"
              title={`En attente de ${waiting.map((w) => `« ${w.dependsOn.title} »`).join(", ")}`}
            >
              Elle ne peut pas passer à « Terminé » avant la fin de{" "}
              {waiting.length > 1 ? "ces tâches" : "cette tâche"}.
            </FormAlert>
          ) : null}
          {task.description ? (
            <Card className="gap-2">
              <CardTitle>Description</CardTitle>
              <p className="whitespace-pre-line">{task.description}</p>
            </Card>
          ) : null}
          {!task.archivedAt ? (
            <Card className="gap-3">
              <CardTitle>Changer le statut</CardTitle>
              <TaskStatusForm taskId={id} status={task.status} />
            </Card>
          ) : null}
          <Card className="gap-3">
            <CardTitle>Dépendances</CardTitle>
            <ul className="flex flex-col gap-2">
              {task.dependsOn.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
                  <Link href={`/taches/${d.dependsOnId}`} className="flex-1 hover:underline">
                    Attend : {d.dependsOn.title}
                  </Link>
                  <TaskStatusBadge status={d.dependsOn.status} />
                  <form action={removeDependencyAction}>
                    <input type="hidden" name="taskId" value={id} />
                    <input type="hidden" name="dependsOnId" value={d.dependsOnId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer la dépendance à ${d.dependsOn.title}`}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </form>
                </li>
              ))}
              {task.requiredBy.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
                  <Link href={`/taches/${d.taskId}`} className="flex-1 hover:underline">
                    Bloque : {d.task.title}
                  </Link>
                  <TaskStatusBadge status={d.task.status} />
                </li>
              ))}
              {!task.dependsOn.length && !task.requiredBy.length ? (
                <li className="text-sm text-muted-foreground">Aucune dépendance.</li>
              ) : null}
            </ul>
            {!task.archivedAt ? (
              <DependencyForm
                taskId={id}
                candidates={others
                  .filter((o) => !linked.has(o.id))
                  .map((o) => ({ value: o.id, label: o.title }))}
              />
            ) : null}
          </Card>
          <Card className="gap-2">
            <CardTitle>Historique</CardTitle>
            <ol className="flex flex-col gap-1.5 text-sm">
              {history.map((h) => {
                const detail = journalDetail(h.before, h.after);
                return (
                  <li key={h.id}>
                    <span className="text-muted-foreground">{formatDateTime(h.createdAt)} · </span>
                    <b>{h.actorId ? names.get(h.actorId) : "Système"}</b> {journalLabel(h.action)}
                    {detail ? <span className="text-muted-foreground"> ({detail})</span> : null}
                    {h.reason ? <span className="text-muted-foreground"> — {h.reason}</span> : null}
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function TaskPage({ params }: PageProps<"/taches/[id]">) {
  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<PageLoading />}>
        <TaskView params={params} />
      </Suspense>
    </div>
  );
}
