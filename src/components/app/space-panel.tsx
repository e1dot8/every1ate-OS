import Link from "next/link";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * En-tête commun des espaces de la maison (lot G8, maquette) : pictogramme, titre de l'espace
 * et onglets en pastilles. Chaque onglet est un vrai lien ; l'onglet courant est marqué.
 */
export function SpaceTabs({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: { href: string; label: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul className="inline-flex gap-1 rounded-full bg-muted p-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.href === current ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full px-4 text-[13px] whitespace-nowrap",
                t.href === current
                  ? "border border-ink/10 bg-paper font-bold shadow-sm"
                  : "text-ink/70 hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SpaceTitle({
  title,
  as: Tag = "h1",
  children,
}: {
  title: React.ReactNode;
  as?: "h1" | "h2";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Menu aria-hidden="true" strokeWidth={1.6} className="size-5 text-ink/60" />
        <Tag className="text-[26px] leading-tight font-bold tracking-[-0.03em]">{title}</Tag>
      </div>
      {children}
    </div>
  );
}

/** Panneau blanc arrondi posé sur le fond de l'application. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-2xl bg-paper p-5", className)}>{children}</section>
  );
}
