"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { primaryNav, secondaryNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function NavEntry({ item, active, layout }: { item: NavItem; active: boolean; layout: "bar" | "rail" }) {
  const Icon = item.icon;
  const base = cn(
    "flex min-h-tap items-center rounded-lg text-xs font-bold",
    layout === "bar" ? "flex-1 flex-col justify-center gap-0.5 px-1" : "gap-3 px-3 text-sm",
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
        active && layout === "rail" && "bg-muted",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-5", active && "text-pen")} />
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
export function AppNav() {
  return <AppNavShell pathname={usePathname()} />;
}

/** Barre fixe en bas sur mobile, rail latéral sur ordinateur. */
export function AppNavShell({ pathname }: { pathname: string }) {
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !!pathname && pathname.startsWith(href);

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto flex h-bottom-nav max-w-lg items-stretch px-2">
          {primaryNav.map((item) => (
            <NavEntry key={item.href} item={item} active={isActive(item.href)} layout="bar" />
          ))}
        </div>
      </nav>
      <nav
        aria-label="Navigation principale"
        className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r px-3 py-6 md:flex"
      >
        <p className="mb-4 px-3 text-lg font-bold tracking-tight">EVERY1.ATE OS</p>
        {primaryNav.map((item) => (
          <NavEntry key={item.href} item={item} active={isActive(item.href)} layout="rail" />
        ))}
        <p className="mt-5 mb-1 px-3 font-annotation text-xs text-muted-foreground">raccourcis</p>
        {secondaryNav.map((item) => (
          <NavEntry key={item.href} item={item} active={isActive(item.href)} layout="rail" />
        ))}
      </nav>
    </>
  );
}
