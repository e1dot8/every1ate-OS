import Link from "next/link";
import { connection } from "next/server";
import { ListChecks } from "lucide-react";
import { EmptyLine, Section } from "@/components/notion/blocks";
import { formatDay, todayDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { myUpcomingDeliverables } from "@/features/deliverables/service";
import { DeliverableLine } from "@/features/deliverables/components/views";

const MAX_LINES = 6;

/**
 * Accueil : « Mes livrables » — ceux dont je suis responsable, en retard ou dus sous 7 jours,
 * et les points de checklist qui me sont confiés pour les 2 prochains jours.
 */
export async function UpcomingDeliverables({ userId }: { userId: string }) {
  // Rendu à la requête : la date du jour ne fait jamais partie d'un rendu préalable.
  await connection();
  const today = todayDate();
  const { deliverables, items } = await myUpcomingDeliverables(userId, today);
  const shownDeliverables = deliverables.slice(0, MAX_LINES);
  const shownItems = items.slice(0, Math.max(0, MAX_LINES - shownDeliverables.length));
  const total = deliverables.length + items.length;
  return (
    <Section
      id="mes-livrables"
      title="Mes livrables"
      count={total || undefined}
      action={
        <Link
          href="/livrables?responsable=moi"
          className="inline-flex min-h-tap items-center text-sm font-bold text-pen-strong hover:underline"
        >
          Tout voir
        </Link>
      }
    >
      {total ? (
        <ul className="flex flex-col" aria-label="Mes livrables à venir">
          {shownDeliverables.map((d) => (
            <DeliverableLine key={d.id} d={d} today={today} showProject />
          ))}
          {shownItems.map((i) => {
            const late = i.dueDate!.getTime() < today.getTime();
            return (
              <li
                key={i.id}
                className="flex min-h-tap items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/60"
              >
                <ListChecks aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link
                    href={`/livrables/${i.deliverable.id}`}
                    className="font-bold break-words hover:underline"
                  >
                    {i.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {i.deliverable.title} · {i.deliverable.project.name}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-xs whitespace-nowrap",
                    late ? "font-bold text-danger" : "text-muted-foreground",
                  )}
                >
                  {late ? "En retard · " : "Pour le "}
                  {formatDay(i.dueDate)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyLine>Rien à livrer cette semaine.</EmptyLine>
      )}
      {total > MAX_LINES ? (
        <p className="text-xs text-muted-foreground">+ {total - MAX_LINES} autre(s) dans Livrables.</p>
      ) : null}
    </Section>
  );
}
