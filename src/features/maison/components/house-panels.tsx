import Link from "next/link";
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  LifeBuoy,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import type { AvatarLook } from "@/features/maison/cosmetics";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Panneaux partagés entre La maison et Le bureau commun (lot G8) : même titre, même flèche,
 * mêmes lignes. Un seul composant par information, pour que les espaces se ressemblent.
 */
export function PanelTitle({ title, href, extra }: { title: string; href?: string; extra?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[19px] font-bold tracking-[-0.02em]">
        {title}
        {extra ? <span className="ml-2 text-base font-bold tabular-nums">{extra}</span> : null}
      </h2>
      {href ? (
        <Link
          href={href}
          aria-label={`Ouvrir : ${title}`}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-ink hover:text-paper"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

export type BrigadeRow = {
  id: string;
  name: string;
  look: AvatarLook;
  openTasks: number;
  /** Charge de la semaine en %. */
  load: number;
  status: string | null;
  statusTone: "focus" | "free" | "away" | null;
  href: string;
};

const dot = { focus: "bg-highlight ring-1 ring-ink/30", free: "bg-success", away: "bg-muted-foreground" };

export function BrigadeToday({ rows }: { rows: BrigadeRow[] }) {
  return (
    <ul className="flex flex-col">
      {rows.map((a) => (
        <li key={a.id} className="border-b last:border-b-0">
          <Link href={a.href} className="group flex min-h-16 items-center gap-3 py-2.5">
            <BrigadeAvatar look={a.look} size={44} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
              <b className="text-[14.5px]">{a.name}</b>
              <span className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                {a.statusTone ? (
                  <span aria-hidden="true" className={cn("size-2 rounded-full", dot[a.statusTone])} />
                ) : null}
                {a.openTasks} tâche{a.openTasks > 1 ? "s" : ""}
                {a.status ? ` · ${a.status}` : ""}
              </span>
            </span>
            <span
              className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
              title={`Charge de la semaine : ${a.load} %`}
            >
              <span
                className={cn("block h-full rounded-full", a.load > 100 ? "bg-danger" : "bg-ink")}
                style={{ width: `${Math.min(100, a.load)}%` }}
              />
            </span>
            <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground group-hover:text-ink" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type Goal = { id: string; title: string; reached: boolean };

/** Objectifs de la semaine : aplat jaune pâle, coches jaunes pour les objectifs atteints. */
export function WeekGoals({ goals, href = "/service" }: { goals: Goal[]; href?: string }) {
  const reached = goals.filter((g) => g.reached).length;
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-highlight-soft p-5">
      <PanelTitle
        title="Objectifs de la semaine"
        extra={goals.length ? `${reached} / ${goals.length}` : undefined}
        href={href}
      />
      {goals.length ? (
        <ul className="flex flex-col gap-2.5 text-[14px]">
          {goals.map((g) => (
            <li key={g.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full border",
                  g.reached ? "border-ink/20 bg-highlight" : "border-ink/40 bg-paper/60",
                )}
              >
                {g.reached ? <Check aria-hidden="true" strokeWidth={3} className="size-3" /> : null}
              </span>
              <span>{g.title}</span>
              {g.reached ? <span className="sr-only"> (atteint)</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm">Le point hebdo n&apos;a pas encore d&apos;objectifs.</p>
      )}
    </section>
  );
}

const FEED_ICONS: Record<string, LucideIcon> = {
  badge: Trophy,
  rang: Award,
  projet: FileText,
  objectif: Target,
  aide: LifeBuoy,
  recette: BookOpen,
};

export type FeedItem = { id: string; kind: string; title: string; href: string | null; createdAt: Date };

export function LatestActivity({ items, now }: { items: FeedItem[]; now: Date }) {
  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">
        Rien encore : la première réussite s&apos;affichera ici.
      </p>
    );
  return (
    <ul className="flex flex-col">
      {items.map((e) => {
        const Icon = FEED_ICONS[e.kind] ?? FileText;
        return (
          <li key={e.id} className="flex items-start gap-3 py-2.5">
            <Icon aria-hidden="true" strokeWidth={1.6} className="mt-0.5 size-5 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 text-[13.5px] leading-snug">
              {e.href ? (
                <Link href={e.href} className="hover:underline">
                  {e.title}
                </Link>
              ) : (
                <span>{e.title}</span>
              )}
              <span className="text-xs text-muted-foreground">{formatRelative(e.createdAt, now)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
