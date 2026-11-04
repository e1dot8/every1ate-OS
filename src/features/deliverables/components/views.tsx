import Link from "next/link";
import { Avatar } from "@/components/app/bits";
import { EmptyLine } from "@/components/notion/blocks";
import { addDays, formatDay, formatWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DeliverableRow } from "@/features/deliverables/service";
import {
  STAGES,
  calendarGroups,
  formatLabels,
  globalProgress,
  isLate,
  stageLabels,
  stageProgress,
} from "@/features/deliverables/rules";
import {
  BlockedBadge,
  DueDate,
  FormatEmoji,
  MiniProgress,
  StageBadge,
} from "@/features/deliverables/components/bits";

// ─── Bandeau résumé ─────────────────────────────────────────────────────────

export function SummaryBand({
  summary,
  href,
}: {
  summary: { late: number; week: number; blocked: number; deliveredMonth: number };
  href: (patch: Record<string, string | undefined>) => string;
}) {
  const stats = [
    {
      key: "late",
      label: "En retard",
      value: summary.late,
      to: href({ retard: "1", semaine: undefined, bloque: undefined, livres: undefined }),
      alert: summary.late > 0,
    },
    {
      key: "week",
      label: "À livrer cette semaine",
      value: summary.week,
      to: href({ semaine: "1", retard: undefined, bloque: undefined, livres: undefined }),
    },
    {
      key: "blocked",
      label: "Bloqués",
      value: summary.blocked,
      to: href({ bloque: "1", retard: undefined, semaine: undefined, livres: undefined }),
      alert: summary.blocked > 0,
    },
    {
      key: "delivered",
      label: "Livrés ce mois",
      value: summary.deliveredMonth,
      to: href({ livres: "mois", retard: undefined, semaine: undefined, bloque: undefined }),
    },
  ];
  return (
    <ul aria-label="Résumé" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {stats.map((s) => (
        <li key={s.key}>
          <Link
            href={s.to}
            className="flex min-h-tap flex-col rounded-lg border px-3 py-2 hover:bg-muted/60"
            aria-label={`${s.label} : ${s.value}`}
          >
            <span
              className={cn("text-2xl font-bold tabular-nums", s.alert && "text-danger")}
              aria-hidden="true"
            >
              {s.value}
            </span>
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              {s.label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ─── Tableau (kanban par étape) ─────────────────────────────────────────────

export function DeliverableCard({
  d,
  today,
  showProject = true,
}: {
  d: DeliverableRow;
  today: Date;
  showProject?: boolean;
}) {
  const progress = stageProgress(d.checkItems, d.stage);
  return (
    <li className="relative flex flex-col gap-2 rounded-lg border bg-card p-3 hover:bg-muted/60">
      <div className="flex items-start gap-2">
        <FormatEmoji format={d.format} className="pt-0.5 text-lg" />
        <Link
          href={`/livrables/${d.id}`}
          className="min-w-0 flex-1 leading-snug font-bold break-words after:absolute after:inset-0 after:rounded-lg"
        >
          {d.title}
        </Link>
      </div>
      {showProject ? <p className="truncate text-xs text-muted-foreground">{d.project.name}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Avatar name={d.owner?.name} className="size-6 text-[10px]" />
        {d.stage === "LIVRE" ? (
          <span className="text-xs text-success">Livré le {formatDay(d.deliveredAt ?? d.updatedAt)}</span>
        ) : (
          <DueDate dueDate={d.dueDate} stage={d.stage} today={today} />
        )}
        {d.blockedReason && d.stage !== "LIVRE" ? <BlockedBadge reason={d.blockedReason} /> : null}
      </div>
      {d.stage !== "LIVRE" && progress.total ? (
        <MiniProgress
          done={progress.done}
          total={progress.total}
          label={`${stageLabels[d.stage]} de « ${d.title} »`}
        />
      ) : null}
    </li>
  );
}

export function BoardView({ items, today, now }: { items: DeliverableRow[]; today: Date; now: Date }) {
  const recent = addDays(now, -30).getTime();
  return (
    <div className="relative overflow-x-auto pb-2" data-testid="tableau-livrables">
      <div className="flex min-w-max gap-3">
        {STAGES.map((stage) => {
          const cards = items.filter(
            (d) =>
              d.stage === stage && (stage !== "LIVRE" || (d.deliveredAt ?? d.updatedAt).getTime() >= recent),
          );
          const headingId = `colonne-${stage.toLowerCase()}`;
          return (
            <section
              key={stage}
              aria-labelledby={headingId}
              className="flex w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/50 p-2"
            >
              <h2 id={headingId} className="flex items-center gap-2 px-1 text-sm font-bold">
                {stageLabels[stage]}
                <span className="rounded bg-background px-1.5 text-xs text-muted-foreground">
                  {cards.length}
                </span>
                {stage === "LIVRE" ? (
                  <span className="text-xs font-normal text-muted-foreground">30 derniers jours</span>
                ) : null}
              </h2>
              {cards.length ? (
                <ul className="flex flex-col gap-2">
                  {cards.map((d) => (
                    <DeliverableCard key={d.id} d={d} today={today} />
                  ))}
                </ul>
              ) : (
                <EmptyLine>Aucun livrable.</EmptyLine>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─── Table ──────────────────────────────────────────────────────────────────

export function TableView({ items, today }: { items: DeliverableRow[]; today: Date }) {
  if (!items.length) return <EmptyLine>Aucun livrable ne correspond.</EmptyLine>;
  const th = "px-2 py-2 text-left text-xs font-bold whitespace-nowrap text-muted-foreground";
  return (
    <div className="relative overflow-x-auto" data-testid="table-livrables">
      <table className="w-full min-w-[56rem] border-collapse text-sm">
        <caption className="sr-only">Livrables triés par échéance</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className={th}>
              Titre
            </th>
            <th scope="col" className={th}>
              Projet
            </th>
            <th scope="col" className={th}>
              Format
            </th>
            <th scope="col" className={th}>
              Étape
            </th>
            <th scope="col" className={th}>
              Responsable
            </th>
            <th scope="col" className={th}>
              Échéance
            </th>
            <th scope="col" className={th}>
              Publication
            </th>
            <th scope="col" className={th}>
              Avancement
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((d) => {
            const progress = globalProgress(d.checkItems, d.stage);
            const late = isLate(d, today);
            return (
              <tr key={d.id} className="border-b align-top hover:bg-muted/60">
                <th scope="row" className="max-w-72 px-2 py-2.5 text-left font-bold">
                  <Link href={`/livrables/${d.id}`} className="hover:underline">
                    {d.title}
                  </Link>
                  {d.blockedReason && d.stage !== "LIVRE" ? (
                    <span className="ml-2 inline-block align-middle">
                      <BlockedBadge reason={d.blockedReason} />
                    </span>
                  ) : null}
                </th>
                <td className="px-2 py-2.5">
                  <Link href={`/projets/${d.project.id}`} className="hover:underline">
                    {d.project.name}
                  </Link>
                </td>
                <td className="px-2 py-2.5 whitespace-nowrap">
                  <FormatEmoji format={d.format} /> {formatLabels[d.format]}
                </td>
                <td className="px-2 py-2.5">
                  <StageBadge stage={d.stage} />
                </td>
                <td className="px-2 py-2.5 whitespace-nowrap">{d.owner?.name ?? "—"}</td>
                <td className={cn("px-2 py-2.5 whitespace-nowrap", late && "font-bold text-danger")}>
                  {late ? "En retard · " : ""}
                  {formatDay(d.dueDate)}
                </td>
                <td className="px-2 py-2.5 whitespace-nowrap">{formatDay(d.publishDate)}</td>
                <td className="w-40 px-2 py-2.5">
                  <MiniProgress
                    done={progress.done}
                    total={progress.total}
                    label={`Avancement de « ${d.title} » : ${progress.percent} %`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Calendrier ─────────────────────────────────────────────────────────────

function CalendarLine({
  d,
  date,
  kind,
}: {
  d: DeliverableRow;
  date: Date;
  kind: "echeance" | "publication" | "retard";
}) {
  return (
    <li className="flex min-h-tap items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60">
      <span
        className={cn(
          "w-24 shrink-0 text-xs font-bold",
          kind === "retard" ? "text-danger" : "text-muted-foreground",
        )}
      >
        {kind === "retard" ? formatDay(date) : formatWeekday(date)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <FormatEmoji format={d.format} />
          <Link href={`/livrables/${d.id}`} className="truncate font-bold hover:underline">
            {d.title}
          </Link>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {kind === "publication" ? "Publication" : kind === "retard" ? "Échéance dépassée" : "Livraison"} ·{" "}
          {d.project.name} · {stageLabels[d.stage]}
        </span>
      </span>
      {d.blockedReason && d.stage !== "LIVRE" ? <BlockedBadge reason={d.blockedReason} /> : null}
      <Avatar name={d.owner?.name} className="size-6 text-[10px]" />
    </li>
  );
}

export function CalendarView({ items, today }: { items: DeliverableRow[]; today: Date }) {
  const { late, weeks } = calendarGroups(items, today, 6);
  return (
    <div className="flex flex-col gap-5" data-testid="calendrier-livrables">
      <section aria-labelledby="cal-retard" className="flex flex-col gap-1">
        <h2 id="cal-retard" className="flex items-center gap-2 border-b pb-1.5 text-lg font-bold">
          En retard
          <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{late.length}</span>
        </h2>
        {late.length ? (
          <ul>
            {late.map((d) => (
              <CalendarLine key={d.id} d={d} date={d.dueDate!} kind="retard" />
            ))}
          </ul>
        ) : (
          <EmptyLine>Aucun livrable en retard.</EmptyLine>
        )}
      </section>
      {weeks.map((w, i) => {
        const headingId = `cal-semaine-${i}`;
        return (
          <section key={w.start.toISOString()} aria-labelledby={headingId} className="flex flex-col gap-1">
            <h2
              id={headingId}
              className="flex flex-wrap items-baseline gap-2 border-b pb-1.5 text-lg font-bold"
            >
              {i === 0 ? "Cette semaine" : i === 1 ? "Semaine prochaine" : `Semaine du ${formatDay(w.start)}`}
              <span className="text-xs font-normal text-muted-foreground">
                {formatDay(w.start)} → {formatDay(w.end)}
              </span>
            </h2>
            {w.entries.length ? (
              <ul>
                {w.entries.map((e) => (
                  <CalendarLine key={`${e.kind}-${e.item.id}`} d={e.item} date={e.date} kind={e.kind} />
                ))}
              </ul>
            ) : (
              <EmptyLine>Rien de prévu.</EmptyLine>
            )}
          </section>
        );
      })}
    </div>
  );
}

// ─── Ligne fine (onglet projet, accueil) ────────────────────────────────────

export function DeliverableLine({
  d,
  today,
  showProject = false,
}: {
  d: DeliverableRow;
  today: Date;
  showProject?: boolean;
}) {
  const progress = stageProgress(d.checkItems, d.stage);
  return (
    <li className="flex min-h-tap items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/60">
      <FormatEmoji format={d.format} className="text-lg" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link href={`/livrables/${d.id}`} className="font-bold break-words hover:underline">
          {d.title}
        </Link>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {showProject ? <span className="text-xs text-muted-foreground">{d.project.name}</span> : null}
          {d.stage === "LIVRE" ? (
            <span className="text-xs text-success">Livré le {formatDay(d.deliveredAt ?? d.updatedAt)}</span>
          ) : (
            <DueDate dueDate={d.dueDate} stage={d.stage} today={today} />
          )}
          {d.blockedReason && d.stage !== "LIVRE" ? <BlockedBadge reason={d.blockedReason} /> : null}
        </span>
      </span>
      {d.stage !== "LIVRE" && progress.total ? (
        <MiniProgress
          done={progress.done}
          total={progress.total}
          label={`${stageLabels[d.stage]} de « ${d.title} »`}
          className="hidden w-28 sm:flex"
        />
      ) : null}
      <Avatar name={d.owner?.name} className="size-6 text-[10px]" />
    </li>
  );
}
