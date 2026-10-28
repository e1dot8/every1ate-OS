"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups, primaryNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavEntry({ item, active, layout }: { item: NavItem; active: boolean; layout: "bar" | "rail" }) {
  const Icon = item.icon;
  const base = cn(
    "flex min-h-tap items-center rounded-lg text-xs font-bold",
    layout === "bar" ? "flex-1 flex-col justify-center gap-0.5 px-1" : "gap-3 px-3 text-[13px]",
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
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        active && layout === "rail" && "bg-highlight text-ink",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-5", active && layout === "bar" && "text-pen")} />
      <span
        className={cn(
          active && layout === "bar" && "underline decoration-pen decoration-2 underline-offset-4",
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

/** Navigation active selon l'URL (lue côté client, sous Suspense). */
export function AppNav({ footer }: { footer?: React.ReactNode }) {
  return <AppNavShell pathname={usePathname()} footer={footer} />;
}

/** Barre fixe en bas sur mobile ; rail en trois niveaux sur ordinateur, profil discret en pied. */
export function AppNavShell({ pathname, footer }: { pathname: string; footer?: React.ReactNode }) {
  const isActive = (item: NavItem) =>
    item.href === "/"
      ? pathname === "/"
      : !!pathname && (item.match ?? [item.href]).some((prefix) => pathname.startsWith(prefix));

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex h-bottom-nav max-w-lg items-stretch px-2">
          {primaryNav.map((item) => (
            <NavEntry key={item.href} item={item} active={isActive(item)} layout="bar" />
          ))}
        </div>
      </nav>
      <nav
        aria-label="Navigation principale"
        className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-paper md:flex"
      >
        <p className="px-6 pt-6 pb-4 text-xl font-bold tracking-[-0.03em]">every1.ate</p>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
          {navGroups.map((group) => (
            <div key={group.title} className="flex flex-col">
              <p className="px-3 pb-1 font-annotation text-[11px] text-muted-foreground">
                {group.title.toLowerCase()}
              </p>
              {group.items.map((item) => (
                <NavEntry key={item.href} item={item} active={isActive(item)} layout="rail" />
              ))}
            </div>
          ))}
        </div>
        {footer ? <div className="border-t p-3">{footer}</div> : null}
      </nav>
    </>
  );
}
