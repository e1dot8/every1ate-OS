"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups, primaryNav, utilityNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Compteurs affichés à côté d'une entrée du rail, indexés par href. */
export type NavBadges = Partial<Record<string, number>>;

function NavEntry({
  item,
  active,
  layout,
  count,
  dot,
}: {
  item: NavItem;
  active: boolean;
  layout: "bar" | "rail";
  count?: number;
  dot?: boolean;
}) {
  const Icon = item.icon;
  const base = cn(
    "flex items-center text-xs",
    layout === "bar" && "min-h-tap",
    layout === "bar"
      ? "flex-1 flex-col justify-center gap-0.5 rounded-lg px-1 font-bold"
      : "min-h-10 gap-3 rounded-xl px-3 text-[13.5px]",
  );

  if (item.comingInLot !== undefined) {
    return (
      <span
        aria-disabled="true"
        title={`Disponible au lot ${item.comingInLot}`}
        className={cn(base, "cursor-not-allowed text-muted-foreground/45")}
      >
        <Icon aria-hidden="true" className="size-5" />
        <span>{item.label}</span>
        <span className="sr-only"> — bientôt disponible</span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        base,
        layout === "bar" && (active ? "text-foreground" : "text-muted-foreground hover:text-foreground"),
        layout === "rail" &&
          (active ? "bg-highlight-soft font-bold text-ink" : "text-ink/80 hover:bg-muted hover:text-ink"),
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={layout === "rail" ? 1.6 : 2}
        className={cn("size-5 shrink-0", active && layout === "bar" && "text-pen")}
      />
      <span
        className={cn(
          layout === "rail" && "flex-1 truncate",
          active && layout === "bar" && "underline decoration-pen decoration-2 underline-offset-4",
        )}
      >
        {item.label}
      </span>
      {layout === "rail" && count ? (
        <span className="min-w-6 rounded-full bg-muted px-1.5 text-center text-[11px] leading-5 font-bold">
          {count > 99 ? "99+" : count}
          <span className="sr-only"> en cours</span>
        </span>
      ) : null}
      {layout === "rail" && dot ? (
        <span className="size-2 rounded-full bg-pen" aria-label="non lu" role="img" />
      ) : null}
    </Link>
  );
}

/** Navigation active selon l'URL (lue côté client, sous Suspense). */
export function AppNav({ footer, badges }: { footer?: React.ReactNode; badges?: NavBadges }) {
  return <AppNavShell pathname={usePathname()} footer={footer} badges={badges} />;
}

/**
 * Barre fixe en bas sur mobile ; sur ordinateur, un panneau arrondi : le logo, les trois
 * niveaux (travail, maison, outils), les utilitaires et la carte de profil (lot G8).
 */
export function AppNavShell({
  pathname,
  footer,
  badges = {},
}: {
  pathname: string;
  footer?: React.ReactNode;
  badges?: NavBadges;
}) {
  const isActive = (item: NavItem) =>
    item.href === "/"
      ? pathname === "/"
      : !!pathname && (item.match ?? [item.href]).some((prefix) => pathname.startsWith(prefix));

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex h-bottom-nav max-w-lg items-stretch px-2">
          {primaryNav.map((item) => (
            <NavEntry key={item.href} item={item} active={isActive(item)} layout="bar" />
          ))}
        </div>
      </nav>
      <nav
        aria-label="Navigation principale"
        className="sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-60 shrink-0 flex-col rounded-2xl bg-paper md:flex"
      >
        <Link href="/" className="px-6 pt-6 pb-5 text-2xl font-bold tracking-[-0.05em]">
          every1.ate
        </Link>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3">
          {navGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                {group.title}
              </p>
              {group.items.map((item) => (
                <NavEntry
                  key={item.href}
                  item={item}
                  active={isActive(item)}
                  layout="rail"
                  count={badges[item.href]}
                />
              ))}
            </div>
          ))}
        </div>
        <ul className="flex items-center gap-1 border-t px-3 py-2">
          {utilityNav.map((item) => {
            const Icon = item.icon;
            const unread = badges[item.href];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  aria-label={unread ? `${item.label}, ${unread} non lu${unread > 1 ? "s" : ""}` : item.label}
                  aria-current={isActive(item) ? "page" : undefined}
                  className={cn(
                    "relative inline-flex size-10 items-center justify-center rounded-xl hover:bg-muted",
                    isActive(item) && "bg-highlight-soft",
                  )}
                >
                  <Icon aria-hidden="true" strokeWidth={1.6} className="size-5" />
                  {unread ? (
                    <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-pen" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        {footer ? <div className="p-3 pt-0">{footer}</div> : null}
      </nav>
    </>
  );
}
