"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, FolderPlus, Handshake, ListPlus, NotebookPen, Plus, Timer, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/taches/nouvelle", label: "Tâche", icon: ListPlus },
  { href: "/temps", label: "Temps passé", icon: Timer },
  { href: "/notes/nouvelle", label: "Compte rendu", icon: NotebookPen },
  { href: "/calendrier/nouveau", label: "Réunion", icon: CalendarPlus },
  { href: "/crm/opportunites/nouvelle", label: "Opportunité", icon: Handshake },
  { href: "/projets/nouveau", label: "Projet", icon: FolderPlus },
];

/**
 * Bouton « + » toujours accessible : en bas à droite sur téléphone (au-dessus de la barre de
 * navigation, à portée de pouce), dans la barre du haut sur ordinateur.
 */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className="fixed right-4 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] z-40 md:static md:z-auto"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "Fermer le menu de création" : "Créer"}
        onClick={() => setOpen((v) => !v)}
        className="flex size-14 items-center justify-center rounded-full bg-ink text-paper shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:h-tap md:w-auto md:gap-2 md:px-4 md:shadow-none"
      >
        {open ? (
          <X aria-hidden="true" className="size-6 md:size-5" />
        ) : (
          <Plus aria-hidden="true" className="size-6 md:size-5" />
        )}
        <span className="hidden font-bold md:inline">Créer</span>
      </button>
      <ul
        id={menuId}
        hidden={!open}
        className={cn(
          "absolute right-0 bottom-16 w-56 rounded-xl border bg-card p-1 shadow-xl md:top-12 md:bottom-auto",
        )}
      >
        {ACTIONS.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex min-h-tap items-center gap-3 rounded-lg px-3 font-bold hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <a.icon aria-hidden="true" className="size-5" /> {a.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
