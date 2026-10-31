import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight, CircleDot, Coffee } from "lucide-react";
import type { BriefItem } from "@/features/brief/rules";
import { cn } from "@/lib/utils";

/** Le brief du jour, en tête de Mon espace : ce qui compte aujourd'hui, l'urgent d'abord. */
export function BriefCard({ brief }: { brief: { items: BriefItem[]; summary: string; urgent: number } }) {
  const shown = brief.items.slice(0, 7);
  return (
    <section
      aria-labelledby="brief-titre"
      className={cn(
        "flex flex-col gap-2 rounded-lg border-2 p-4",
        brief.urgent ? "border-ink bg-card" : "border-border bg-card",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="brief-titre" className="text-lg font-bold">
          Aujourd&apos;hui
        </h2>
        <p className="text-sm font-bold" data-testid="brief-summary">
          {brief.summary}
        </p>
      </div>
      {shown.length ? (
        <ul className="flex flex-col">
          {shown.map((i, n) => {
            const Icon = i.severity === 3 ? AlertTriangle : i.kind === "reunion" ? CalendarClock : CircleDot;
            return (
              <li key={`${i.href}-${n}`} className="border-t first:border-t-0">
                <Link href={i.href} className="flex min-h-tap items-center gap-3 py-2 hover:underline">
                  <Icon
                    aria-hidden="true"
                    className={cn("size-4 shrink-0", i.severity === 3 && "text-danger")}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-bold">{i.title}</span>
                    {i.detail ? (
                      <span className="truncate text-xs text-muted-foreground">{i.detail}</span>
                    ) : null}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coffee aria-hidden="true" className="size-4" /> Aucune action urgente : bonne journée.
        </p>
      )}
      {brief.items.length > shown.length ? (
        <p className="text-xs text-muted-foreground">
          + {brief.items.length - shown.length} autre(s) dans Tâches et CRM.
        </p>
      ) : null}
    </section>
  );
}
