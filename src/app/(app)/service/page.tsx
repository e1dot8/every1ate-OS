import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Chip, EmptyState } from "@/components/app/bits";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader, PageLoading } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { WeekNotesForm, WeeklyItemForm } from "@/features/briefing/components/weekly-forms";
import { getWeek, listWeeks, weekContext, weekOf } from "@/features/briefing/service";
import { formatMinutes } from "@/features/planning/rules";
import { listAssociates } from "@/features/projects/service";
import { requireUser } from "@/lib/auth/session";
import { addDays, formatDateTime, formatDay, parseDateInput, toDateInput, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { WeeklyItemKind, WeeklyItemStatus } from "@/generated/prisma/enums";
import {
  openWeekAction,
  removeWeeklyItemAction,
  setWeeklyItemStatusAction,
  validateWeekAction,
} from "./actions";

export const metadata: Metadata = { title: "Le menu de la semaine" };

type Item = {
  id: string;
  kind: WeeklyItemKind;
  title: string;
  detail: string | null;
  status: WeeklyItemStatus;
  dueDate: Date | null;
  owner: { name: string } | null;
};

const statusLabel: Record<WeeklyItemStatus, string> = {
  OUVERT: "En cours",
  ATTEINT: "Atteint",
  NON_ATTEINT: "Non atteint",
  FAIT: "Fait",
};

function StatusForm({ id, status, label }: { id: string; status: WeeklyItemStatus; label: string }) {
  return (
    <form action={setWeeklyItemStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        className="inline-flex min-h-tap items-center rounded-full border px-3 text-[13px] font-bold hover:bg-muted"
      >
        {label}
      </button>
    </form>
  );
}

function ItemRow({ item, editable }: { item: Item; editable: boolean }) {
  const closed = item.status !== "OUVERT";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t py-2.5 first:border-t-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("font-bold", closed && "text-muted-foreground")}>{item.title}</span>
        <span className="text-[13px] text-muted-foreground">
          {[item.detail, item.owner?.name, item.dueDate ? `pour le ${formatDay(item.dueDate)}` : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-bold",
          item.status === "ATTEINT" || item.status === "FAIT"
            ? "bg-success-soft text-success"
            : item.status === "NON_ATTEINT"
              ? "bg-muted text-muted-foreground"
              : "bg-highlight/60",
        )}
      >
        {statusLabel[item.status]}
      </span>
      {editable ? (
        <span className="flex flex-wrap gap-1">
          {item.kind === "OBJECTIF" ? (
            <>
              {item.status !== "ATTEINT" ? (
                <StatusForm id={item.id} status="ATTEINT" label="Atteint" />
              ) : null}
              {item.status !== "NON_ATTEINT" ? (
                <StatusForm id={item.id} status="NON_ATTEINT" label="Non atteint" />
              ) : null}
            </>
          ) : item.status !== "FAIT" ? (
            <StatusForm id={item.id} status="FAIT" label={item.kind === "BLOCAGE" ? "Levé" : "Fait"} />
          ) : null}
          {closed ? <StatusForm id={item.id} status="OUVERT" label="Rouvrir" /> : null}
          <form action={removeWeeklyItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <button
              type="submit"
              aria-label={`Retirer « ${item.title} »`}
              className="inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </form>
        </span>
      ) : null}
    </li>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3">
      <div>
        <p className="font-annotation text-sm text-pen-strong">{String(n).padStart(2, "0")}</p>
        <CardTitle>{title}</CardTitle>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </Card>
  );
}

async function Menu({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayDate();
  const current = weekOf(today);
  const weekStart = weekOf(parseDateInput(sp.semaine) ?? today);
  const [week, ctx, associates, history] = await Promise.all([
    getWeek(weekStart),
    weekContext(weekStart),
    listAssociates(),
    listWeeks(),
  ]);
  const people = associates.map((a) => ({ value: a.id, label: a.name }));
  const items = (kind: WeeklyItemKind) => week?.items.filter((i) => i.kind === kind) ?? [];
  const isPast = weekStart < current;
  const nav = (d: Date) => `/menu-semaine?semaine=${toDateInput(d)}`;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={nav(addDays(weekStart, -7))}
          aria-label="Semaine précédente"
          className="inline-flex size-tap items-center justify-center rounded-full border hover:bg-muted"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Link>
        <p className="font-bold">
          Semaine du {formatDay(weekStart)} au {formatDay(addDays(weekStart, 6))}
        </p>
        <Link
          href={nav(addDays(weekStart, 7))}
          aria-label="Semaine suivante"
          className="inline-flex size-tap items-center justify-center rounded-full border hover:bg-muted"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
        {weekStart.getTime() !== current.getTime() ? <Chip href="/menu-semaine">Cette semaine</Chip> : null}
        {week?.validatedAt ? (
          <span className="rounded-full bg-success-soft px-3 py-1 text-sm font-bold text-success">
            Validé le {formatDateTime(week.validatedAt)}
          </span>
        ) : null}
      </div>

      {!week ? (
        <Card className="items-start gap-2 border-2 border-ink">
          <CardTitle>Le menu n&apos;est pas encore ouvert</CardTitle>
          <p className="text-sm text-muted-foreground">
            La synthèse ci-dessous est prête. Ouvrez le menu pour noter objectifs, blocages et décisions (20 à
            30 minutes à trois).
          </p>
          <form action={openWeekAction}>
            <input type="hidden" name="weekStart" value={toDateInput(weekStart)} />
            <SubmitButton>Ouvrir le menu de la semaine</SubmitButton>
          </form>
        </Card>
      ) : null}

      <Section n={1} title="Le bilan" hint="Les 7 jours précédant la semaine, préparés par l'OS.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Tâches terminées", ctx.review.doneTasks],
            ["Projets livrés", ctx.review.closedProjects.length],
            ["Jalons franchis", ctx.review.milestones.length],
            ["XP de la brigade", ctx.review.xp],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="text-2xl font-bold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        {ctx.review.closedProjects.length ? (
          <p className="text-sm">
            Livrés :{" "}
            {ctx.review.closedProjects.map((p, i) => (
              <span key={p.id}>
                {i ? ", " : ""}
                <Link href={`/projets/${p.id}`} className="font-bold hover:underline">
                  {p.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
        {ctx.review.previousGoals.length ? (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold">Objectifs de la semaine dernière : prévu vs réel</p>
            <ul className="flex flex-col">
              {ctx.review.previousGoals.map((g) => (
                <ItemRow key={g.id} item={g} editable />
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section
        n={2}
        title="Projets en cours"
        hint="Échéances des deux prochaines semaines, retards et risques."
      >
        <div className="flex flex-wrap gap-2 text-sm">
          <span
            className={cn(
              "rounded-full px-3 py-1 font-bold",
              ctx.late ? "bg-danger-soft text-danger" : "bg-muted",
            )}
          >
            {ctx.late} tâche{ctx.late > 1 ? "s" : ""} en retard
          </span>
          <span
            className={cn(
              "rounded-full px-3 py-1 font-bold",
              ctx.blocked.length ? "bg-warning-soft text-warning" : "bg-muted",
            )}
          >
            {ctx.blocked.length} bloquée{ctx.blocked.length > 1 ? "s" : ""}
          </span>
          <span
            className={cn(
              "rounded-full px-3 py-1 font-bold",
              ctx.decisions.length ? "bg-info-soft text-info" : "bg-muted",
            )}
          >
            {ctx.decisions.length} décision{ctx.decisions.length > 1 ? "s" : ""} en attente
          </span>
        </div>
        {ctx.upcoming.length ? (
          <ul className="flex flex-col">
            {ctx.upcoming.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-t py-2 text-sm first:border-t-0">
                <span className="w-16 shrink-0 text-muted-foreground">{formatDay(t.dueDate)}</span>
                <Link href={`/taches/${t.id}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                  {t.title}
                </Link>
                <span className="hidden truncate text-muted-foreground sm:inline">{t.project.name}</span>
                <span className="text-muted-foreground">{t.owner?.name ?? "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Aucune échéance dans les deux semaines." />
        )}
        {ctx.decisions.length ? (
          <p className="text-sm">
            En attente d&apos;avis :{" "}
            {ctx.decisions.map((d, i) => (
              <span key={d.id}>
                {i ? ", " : ""}
                <Link href={`/gouvernance/${d.id}`} className="font-bold hover:underline">
                  {d.title}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </Section>

      <Section
        n={3}
        title="La charge"
        hint="Temps restant estimé des tâches à échéance cette semaine, face à la capacité de chacun. Pour répartir, pas pour évaluer."
      >
        <ul className="flex flex-col gap-3">
          {ctx.load.map((p) => (
            <li key={p.id} className="flex flex-col gap-1">
              <div className="flex justify-between gap-2 text-sm">
                <b>{p.name}</b>
                <span className="tabular-nums">
                  {formatMinutes(p.minutes)} / {p.capacityHours} h
                  {p.capacityIsDefault ? " (capacité agence)" : ""} · {p.pct} %
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className={cn(
                    "h-full",
                    p.tone === "danger" ? "bg-danger" : p.tone === "warning" ? "bg-warning" : "bg-ink",
                  )}
                  style={{ width: `${Math.min(100, p.pct)}%` }}
                />
              </div>
              {p.unplannedMinutes ? (
                <span className="text-xs text-muted-foreground">
                  + {formatMinutes(p.unplannedMinutes)} estimées sans échéance
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {week ? (
        <>
          <Section n={4} title="Les blocages" hint="Trois au plus : à traiter ou à confier.">
            {items("BLOCAGE").length ? (
              <ul>
                {items("BLOCAGE").map((i) => (
                  <ItemRow key={i.id} item={i} editable />
                ))}
              </ul>
            ) : null}
            {ctx.blocked.length ? (
              <p className="text-xs text-muted-foreground">
                Tâches bloquées repérées : {ctx.blocked.map((b) => b.title).join(", ")}
              </p>
            ) : null}
            <WeeklyItemForm briefingId={week.id} kind="BLOCAGE" associates={people} />
          </Section>

          <Section
            n={5}
            title="Les objectifs de la semaine"
            hint="Trois résultats collectifs au plus, avec un responsable et un critère de réussite."
          >
            {items("OBJECTIF").length ? (
              <ul>
                {items("OBJECTIF").map((i) => (
                  <ItemRow key={i.id} item={i} editable />
                ))}
              </ul>
            ) : (
              <EmptyState title="Aucun objectif pour l'instant." />
            )}
            <WeeklyItemForm briefingId={week.id} kind="OBJECTIF" associates={people} />
          </Section>

          <Section n={6} title="La progression">
            <WeekNotesForm
              briefingId={week.id}
              progressFocus={week.progressFocus ?? ""}
              notes={week.notes ?? ""}
            />
          </Section>

          <Section n={7} title="Décisions et actions" hint="Qui fait quoi, pour quand.">
            {[...items("DECISION"), ...items("ACTION")].length ? (
              <ul>
                {[...items("DECISION"), ...items("ACTION")].map((i) => (
                  <ItemRow key={i.id} item={i} editable />
                ))}
              </ul>
            ) : null}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <WeeklyItemForm briefingId={week.id} kind="DECISION" associates={people} />
              <WeeklyItemForm briefingId={week.id} kind="ACTION" associates={people} />
            </div>
          </Section>

          {!week.validatedAt && !isPast ? (
            <form action={validateWeekAction}>
              <input type="hidden" name="briefingId" value={week.id} />
              <SubmitButton>Valider le menu de la semaine</SubmitButton>
            </form>
          ) : null}
        </>
      ) : null}

      <Card className="gap-2">
        <CardTitle>Les semaines passées</CardTitle>
        {history.length ? (
          <ul className="flex flex-col">
            {history.map((w) => {
              const goals = w.items.length;
              const reached = w.items.filter((i) => i.status === "ATTEINT").length;
              return (
                <li key={w.id} className="border-t first:border-t-0">
                  <Link
                    href={nav(w.weekStart)}
                    className="flex min-h-tap items-center justify-between gap-3 py-2 text-sm hover:underline"
                  >
                    <b>Semaine du {formatDay(w.weekStart)}</b>
                    <span className="text-muted-foreground">
                      {goals
                        ? `${reached}/${goals} objectif${goals > 1 ? "s" : ""} atteint${goals > 1 ? "s" : ""}`
                        : "sans objectif"}
                      {w.validatedAt ? " · validé" : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Le premier menu ouvert apparaîtra ici.</p>
        )}
      </Card>
    </>
  );
}

export default function WeeklyMenuPage({ searchParams }: PageProps<"/menu-semaine">) {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumb="20 à 30 minutes, à trois"
        title="Le menu de la semaine"
        description="L'OS prépare la synthèse ; la brigade décide."
      />
      <Suspense fallback={<PageLoading />}>
        <Menu searchParams={searchParams as Promise<{ semaine?: string }>} />
      </Suspense>
    </div>
  );
}
