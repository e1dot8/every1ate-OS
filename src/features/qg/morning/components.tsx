import Link from "next/link";
import type { Route } from "next";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";
import { EmptyLine, Section } from "@/components/notion/blocks";
import { formatDay, formatWeekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  listEmoji,
  type MorningReportData,
  type ReportItem,
  type ReportList,
  type ReportSection,
} from "@/features/qg/morning/rules";
import { MORNING_HREF, todayMorningReport } from "@/features/qg/morning/service";

/** Affichage du point du matin : page /qg/point (point enregistré ou aperçu) et encart de l'accueil. */

const toneClass: Record<NonNullable<ReportItem["tone"]>, string> = {
  danger: "font-bold text-danger",
  warning: "font-bold text-warning",
  success: "text-success",
};

const dayOf = (iso: string) => new Date(`${iso}T00:00:00Z`);

function ItemRow({ item }: { item: ReportItem }) {
  const meta = [item.context, item.owner].filter(Boolean).join(" · ");
  return (
    <li>
      <Link
        href={item.href as Route}
        className="flex min-h-tap items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold break-words">{item.title}</span>
          {meta ? <span className="text-xs break-words text-muted-foreground">{meta}</span> : null}
          {item.detail ? (
            <span
              className={cn(
                "text-xs break-words",
                item.tone ? toneClass[item.tone] : "text-muted-foreground",
              )}
            >
              {item.detail}
            </span>
          ) : null}
        </span>
        <ChevronRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function ListBlock({ list }: { list: ReportList }) {
  const hidden = list.total - list.items.length;
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="flex items-center gap-1.5 px-1 text-sm font-bold text-muted-foreground">
        <span aria-hidden="true">{listEmoji[list.key] ?? "•"}</span>
        {list.label}
        <span className="rounded bg-muted px-1.5 text-xs">{list.total}</span>
      </h3>
      <ul className="flex flex-col" aria-label={list.label}>
        {list.items.map((item) => (
          <ItemRow key={`${list.key}-${item.id}`} item={item} />
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="px-1 text-xs text-muted-foreground">
          … et {hidden} {hidden > 1 ? "autres" : "autre"}
        </p>
      ) : null}
    </div>
  );
}

function SectionBlock({ section }: { section: ReportSection }) {
  const total = section.lists.reduce((n, l) => n + l.total, 0);
  return (
    <Section id={`point-${section.key}`} title={section.title} count={total}>
      {section.lists.length ? (
        <div className="flex flex-col gap-3">
          {section.lists.map((list) => (
            <ListBlock key={list.key} list={list} />
          ))}
        </div>
      ) : (
        <EmptyLine>{section.empty}</EmptyLine>
      )}
    </Section>
  );
}

function ProjectsBlock({ report }: { report: MorningReportData }) {
  const { items, total } = report.projects;
  const today = dayOf(report.date);
  return (
    <Section id="point-projets" title="Projets actifs" count={total}>
      {items.length ? (
        <ul className="flex flex-col" aria-label="Avancement des projets actifs">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={p.href as Route}
                className="flex min-h-tap flex-col gap-1.5 rounded-md px-1 py-2 hover:bg-muted/60"
              >
                <span className="flex min-w-0 items-baseline justify-between gap-2">
                  <span className="min-w-0 font-bold break-words">
                    {p.name}
                    {p.client ? (
                      <span className="font-normal text-muted-foreground"> · {p.client}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{p.percent} %</span>
                </span>
                <span
                  role="progressbar"
                  aria-label={`Avancement de ${p.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={p.percent}
                  aria-valuetext={`${p.tasksDone} tâches terminées sur ${p.tasksTotal}`}
                  className="block h-1.5 overflow-hidden rounded-full bg-muted"
                >
                  <span className="block h-full bg-ink" style={{ width: `${p.percent}%` }} />
                </span>
                <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  <span>
                    {p.tasksDone}/{p.tasksTotal} tâches
                  </span>
                  {p.deliverablesInProgress ? (
                    <span>
                      · {p.deliverablesInProgress} livrable{p.deliverablesInProgress > 1 ? "s" : ""} en cours
                    </span>
                  ) : null}
                  {p.nextDue ? <span>· prochaine échéance {formatDay(dayOf(p.nextDue), today)}</span> : null}
                </span>
                {p.status ? (
                  <span className="text-xs font-bold break-words text-warning">
                    {p.status}
                    {p.reason ? ` : ${p.reason}` : ""}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyLine>Aucun projet actif.</EmptyLine>
      )}
      {total > items.length ? (
        <p className="px-1 text-xs text-muted-foreground">
          … et {total - items.length} {total - items.length > 1 ? "autres" : "autre"}
        </p>
      ) : null}
    </Section>
  );
}

function Counters({ report }: { report: MorningReportData }) {
  const { counts } = report;
  const tiles = [
    { label: `terminée${counts.done > 1 ? "s" : ""} ${report.since}`, value: counts.done, tone: "" },
    { label: "pour aujourd'hui", value: counts.today, tone: "" },
    { label: "en retard", value: counts.late, tone: counts.late ? "text-danger" : "" },
    {
      label: `bloqué${counts.blocked > 1 ? "s" : ""}`,
      value: counts.blocked,
      tone: counts.blocked ? "text-warning" : "",
    },
  ];
  return (
    <ul aria-label="En chiffres" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <li key={t.label} className="flex min-w-0 flex-col rounded-lg bg-muted/60 px-3 py-2">
          <span className={cn("text-2xl font-bold tabular-nums", t.tone)}>{t.value}</span>
          <span className="text-xs break-words text-muted-foreground">{t.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Le point complet : titre, compteurs, rubriques, projets actifs, semaine. */
export function MorningReportView({ report }: { report: MorningReportData }) {
  const byKey = (key: ReportSection["key"]) => report.sections.find((s) => s.key === key);
  const before = [byKey("hier"), byKey("aujourdhui"), byKey("surveiller")];
  const after = [byKey("semaine")];
  return (
    <article aria-label={report.title} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xl font-bold">{report.title}</p>
        <p className="text-sm text-muted-foreground" data-testid="point-resume">
          {report.summary}
        </p>
        <Counters report={report} />
      </div>
      {before.map((s) => (s ? <SectionBlock key={s.key} section={s} /> : null))}
      <ProjectsBlock report={report} />
      {after.map((s) => (s ? <SectionBlock key={s.key} section={s} /> : null))}
    </article>
  );
}

/** Sélecteur : aperçu en direct, puis les derniers points publiés. */
export function ReportPicker({
  dates,
  today,
  current,
}: {
  dates: Date[];
  today: string;
  /** « apercu » ou la date affichée (AAAA-MM-JJ). */
  current: string;
}) {
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-tap items-center rounded-full border px-3 text-sm font-bold whitespace-nowrap",
      active ? "border-ink bg-ink text-paper" : "hover:bg-muted",
    );
  return (
    <nav aria-label="Points du matin" className="relative -mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-2 px-1 pb-1">
        <li>
          <Link
            href={`${MORNING_HREF}?vue=apercu` as Route}
            aria-current={current === "apercu" ? "page" : undefined}
            className={chip(current === "apercu")}
          >
            Aperçu en direct
          </Link>
        </li>
        {dates.map((d) => {
          const iso = d.toISOString().slice(0, 10);
          return (
            <li key={iso}>
              <Link
                href={`${MORNING_HREF}?date=${iso}` as Route}
                aria-current={current === iso ? "page" : undefined}
                className={chip(current === iso)}
              >
                {iso === today ? "Aujourd'hui" : formatWeekday(d)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Encart compact de l'accueil (QG) : le résumé chiffré du point du jour et un lien vers la page.
 * Rien tant que le point n'est pas publié ; s'il est dû et manquant, il part à cet affichage.
 */
export async function MorningReportBanner() {
  // Rendu à la requête : la date du jour ne fait jamais partie d'un rendu préalable.
  await connection();
  const report = await todayMorningReport(new Date());
  if (!report?.data) return null;
  return (
    <section
      aria-labelledby="point-matin-titre"
      className="flex items-center gap-3 rounded-lg border bg-highlight/30 px-3 py-2"
    >
      <span aria-hidden="true" className="text-2xl leading-none">
        ☀️
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id="point-matin-titre" className="text-sm font-bold">
          Le point du matin
        </h2>
        <p className="text-sm break-words" data-testid="point-matin-resume">
          {report.data.summary}
        </p>
      </div>
      <Link
        href={MORNING_HREF}
        className="inline-flex min-h-tap shrink-0 items-center gap-1 rounded-full border bg-background px-3 text-sm font-bold hover:bg-muted"
      >
        Lire<span className="sr-only"> le point du matin</span>
        <ChevronRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
