import Link from "next/link";
import type { Route } from "next";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Briques d'interface « façon Notion » partagées par les écrans V1.2 :
 * page avec icône, fil d'Ariane, bloc de propriétés, onglets de vue,
 * sections, blocs repliables et encadrés. Composants serveur, sans état.
 */

export type Crumb = { label: string; href?: string };

export function NotionPage({
  icon,
  crumbs,
  title,
  description,
  actions,
  children,
  className,
}: {
  icon?: string;
  crumbs?: Crumb[];
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <header className="flex flex-col gap-2">
        {crumbs?.length ? (
          <nav
            aria-label="Fil d'Ariane"
            className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
          >
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight aria-hidden="true" className="size-3.5" /> : null}
                {crumb.href ? (
                  <Link
                    href={crumb.href as Route}
                    className="rounded px-1 hover:bg-muted hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="px-1">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {icon ? (
              <span aria-hidden="true" className="text-4xl leading-none md:text-5xl">
                {icon}
              </span>
            ) : null}
            <h1 className="min-w-0 text-3xl leading-tight font-bold tracking-tight break-words md:text-4xl">
              {title}
            </h1>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {description ? <div className="text-muted-foreground">{description}</div> : null}
      </header>
      {children}
    </div>
  );
}

/** Bloc de propriétés (libellé à gauche, valeur à droite), comme l'en-tête d'une page Notion. */
export function Properties({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("flex flex-col gap-0.5 text-sm", className)}>{children}</dl>;
}

export function Property({
  icon: Icon,
  label,
  children,
}: {
  icon?: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(7rem,9.5rem)_1fr] items-start gap-2 rounded-md px-1 py-1.5 hover:bg-muted/60">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
        <span>{label}</span>
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export type ViewTab = { key: string; label: string; href: string; icon?: LucideIcon; count?: number };

/** Onglets de vue d'une base (Tableau, Table, Calendrier…), pilotés par l'URL. */
export function ViewTabs({
  views,
  current,
  label = "Vues",
}: {
  views: ViewTab[];
  current: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className="relative -mx-1 overflow-x-auto border-b">
      <ul className="flex min-w-max gap-1 px-1">
        {views.map((view) => {
          const active = view.key === current;
          const Icon = view.icon;
          return (
            <li key={view.key}>
              <Link
                href={view.href as Route}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-tap items-center gap-1.5 border-b-2 px-2.5 text-sm font-bold",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
                {view.label}
                {view.count !== undefined ? (
                  <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{view.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Titre de section (niveau 2) avec compteur et action facultatifs. */
export function Section({
  title,
  count,
  action,
  children,
  id,
  className,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const headingId = id ? `${id}-titre` : undefined;
  return (
    <section aria-labelledby={headingId} id={id} className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2 border-b pb-1.5">
        <h2 id={headingId} className="flex items-center gap-2 text-lg font-bold">
          {title}
          {count !== undefined ? (
            <span className="rounded bg-muted px-1.5 text-xs font-bold text-muted-foreground">{count}</span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Bloc repliable (« toggle » Notion), sans JavaScript. */
export function Toggle({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-md">
      <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 rounded-md px-1 hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform group-open:rotate-90"
        />
        <span className="min-w-0 flex-1 font-bold">{title}</span>
        {meta ? <span className="text-sm text-muted-foreground">{meta}</span> : null}
      </summary>
      <div className="pt-1 pb-2 pl-6">{children}</div>
    </details>
  );
}

const calloutTones = {
  neutral: "bg-muted border-border",
  info: "bg-info-soft border-info/30",
  success: "bg-success-soft border-success/30",
  warning: "bg-warning-soft border-warning/30",
  danger: "bg-danger-soft border-danger/30",
} as const;

/** Encadré avec icône (« callout » Notion). */
export function Callout({
  icon = "💡",
  tone = "neutral",
  children,
  className,
}: {
  icon?: string;
  tone?: keyof typeof calloutTones;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3 rounded-lg border p-3 text-sm", calloutTones[tone], className)}>
      <span aria-hidden="true" className="text-lg leading-none">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Ligne vide discrète, à la place d'une carte entière. */
export function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="px-1 py-2 text-sm text-muted-foreground">{children}</p>;
}
