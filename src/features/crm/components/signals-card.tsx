"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown, FileText, Plus } from "lucide-react";
import { EmptyState } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { DetectedSignal } from "@/features/crm/signals-service";
import { cn } from "@/lib/utils";

/** Signaux visibles avant « Afficher » : 3 sur téléphone, 6 sur ordinateur. */
const MOBILE_VISIBLE = 3;
const DESKTOP_VISIBLE = 6;

const kinds: Record<DetectedSignal["kind"], { label: string; tone: StatusTone }> = {
  renouvellement: { label: "Renouvellement", tone: "warning" },
  suite: { label: "Suite possible", tone: "success" },
  dormant: { label: "Client dormant", tone: "info" },
};

type SignalView = Pick<
  DetectedSignal,
  "key" | "kind" | "title" | "detail" | "clientName" | "clientHref" | "contractHref" | "createHref"
>;

/** « Opportunités détectées » en tête du CRM : signaux calculés, sans IA ni état enregistré. */
export function SignalsCard({ signals }: { signals: SignalView[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const count = signals.length;
  return (
    <section
      aria-labelledby="signaux-titre"
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="signaux-titre" className="text-lg font-bold">
          Opportunités détectées
        </h2>
        {count ? (
          <p className="text-sm text-muted-foreground">
            {count} {count > 1 ? "signaux" : "signal"}
          </p>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Préavis de contrat dans les 60 jours, projets réussis clôturés depuis moins de 4 mois, clients sans
        activité depuis 6 mois.
      </p>
      {count ? (
        <>
          <ul id={listId} className="flex flex-col">
            {signals.map((s, i) => {
              const kind = kinds[s.kind];
              return (
                <li
                  key={s.key}
                  className={cn(
                    "flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0 md:flex-row md:items-center md:justify-between md:gap-4",
                    !open && i >= DESKTOP_VISIBLE && "hidden",
                    !open && i >= MOBILE_VISIBLE && i < DESKTOP_VISIBLE && "hidden md:flex",
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={kind.tone} label={kind.label} />
                      {s.clientHref && s.clientName ? (
                        <Link
                          href={s.clientHref}
                          className="inline-flex min-h-tap items-center text-sm font-bold break-words hover:underline"
                        >
                          {s.clientName}
                        </Link>
                      ) : s.clientName ? (
                        <span className="text-sm font-bold break-words">{s.clientName}</span>
                      ) : null}
                    </div>
                    <p className="font-bold break-words">{s.title}</p>
                    <p className="text-sm break-words text-muted-foreground">{s.detail}</p>
                  </div>
                  {s.contractHref || s.createHref ? (
                    <div className="flex flex-wrap gap-2 md:shrink-0 md:justify-end">
                      {s.contractHref ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={s.contractHref}>
                            <FileText aria-hidden="true" /> Voir le contrat
                            {s.clientName ? <span className="sr-only"> de {s.clientName}</span> : null}
                          </Link>
                        </Button>
                      ) : null}
                      {s.createHref ? (
                        <Button asChild size="sm">
                          <Link href={s.createHref}>
                            <Plus aria-hidden="true" /> Créer une opportunité
                            {s.clientName ? <span className="sr-only"> pour {s.clientName}</span> : null}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {count > MOBILE_VISIBLE ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((v) => !v)}
              className={cn("w-fit", count <= DESKTOP_VISIBLE && "md:hidden")}
            >
              <ChevronDown aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
              {open ? "Réduire la liste" : `Afficher les ${count} signaux`}
            </Button>
          ) : null}
        </>
      ) : (
        <EmptyState title="Aucun signal pour l'instant.">
          Les renouvellements à anticiper, les suites à proposer et les clients à relancer apparaîtront ici.
        </EmptyState>
      )}
    </section>
  );
}
