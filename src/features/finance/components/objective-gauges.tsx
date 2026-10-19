import Link from "next/link";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { Gauge, GaugeStatus, ObjectiveProgress } from "@/features/finance/analytics";
import { formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const statusView: Record<GaugeStatus, { tone: StatusTone; label: string }> = {
  atteint: { tone: "success", label: "Atteint" },
  "non-atteint": { tone: "danger", label: "Non atteint" },
  "dans-le-rythme": { tone: "success", label: "Dans le rythme" },
  "en-retard": { tone: "warning", label: "En retard sur le rythme" },
};

const METRICS = [
  { key: "revenue", label: "CA facturé HT", money: true },
  { key: "margin", label: "Marge HT", money: true },
  { key: "projects", label: "Projets démarrés", money: false },
] as const;

function paceText(pace: number, today: Date) {
  if (pace <= 0) return "année pas encore commencée.";
  if (pace >= 1) return "année écoulée.";
  return `rythme attendu au ${formatDay(today)}, soit ${Math.round(pace * 100)} % de l'année écoulée.`;
}

function GaugeItem({ label, g, money, pace }: { label: string; g: Gauge; money: boolean; pace: number }) {
  const fmt = (n: number) => (money ? formatMoney(n, { round: true }) : String(n));
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{label}</span>
        {g.pct != null ? <span className="text-lg font-bold tabular-nums">{g.pct} %</span> : null}
      </div>
      {g.target != null ? (
        <div className="relative py-1">
          <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={g.barPct}
            aria-valuetext={`${g.pct} % de l'objectif : ${fmt(g.value)} sur ${fmt(g.target)}`}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full",
                g.status === "en-retard" ? "bg-warning" : g.status === "non-atteint" ? "bg-danger" : "bg-ink",
              )}
              style={{ width: `${g.barPct}%` }}
            />
          </div>
          {/* Repère du rythme attendu (part de l'année écoulée), décrit sous les jauges. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-pen"
            style={{ left: `${Math.round(pace * 100)}%` }}
          />
        </div>
      ) : null}
      <p className="text-[13px] text-muted-foreground tabular-nums">
        <b className="text-foreground">{fmt(g.value)}</b>
        {g.target != null ? ` / ${fmt(g.target)}` : " · pas d'objectif"}
      </p>
      {g.status ? (
        <div>
          <StatusBadge {...statusView[g.status]} />
        </div>
      ) : null}
    </li>
  );
}

/** Jauges des objectifs annuels : réalisé / objectif, % et repère du rythme de l'année. */
export function ObjectiveGauges({
  progress,
  today,
  editHref,
}: {
  progress: ObjectiveProgress;
  today: Date;
  /** Lien vers le réglage des objectifs (affiché quand aucun objectif n'est fixé). */
  editHref?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {!progress.hasObjective ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-4">
          <p className="font-bold">Aucun objectif fixé pour {progress.year}.</p>
          {editHref ? (
            <Button asChild variant="outline">
              <Link href={editHref}>
                <Target aria-hidden="true" /> Fixer les objectifs
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      <ul className="grid gap-5 md:grid-cols-3" aria-label={`Avancement des objectifs ${progress.year}`}>
        {METRICS.map((m) => (
          <GaugeItem key={m.key} label={m.label} g={progress[m.key]} money={m.money} pace={progress.pace} />
        ))}
      </ul>
      {progress.hasObjective ? (
        <p className="text-xs text-muted-foreground">
          <span aria-hidden="true" className="mr-1.5 inline-block h-3 w-0.5 bg-pen align-middle" />
          Trait rouge : {paceText(progress.pace, today)}
        </p>
      ) : null}
    </div>
  );
}

/** Définitions exactes des indicateurs suivis par les objectifs. */
export function ObjectiveDefinitions() {
  return (
    <dl className="grid gap-2 text-sm">
      <div>
        <dt className="inline font-bold">CA facturé HT : </dt>
        <dd className="inline text-muted-foreground">
          échéances de facturation non annulées au statut « Facturé » (ou déjà encaissées), datées dans
          l&apos;année (date de facturation, à défaut date prévue), tous projets, archivés compris.
        </dd>
      </div>
      <div>
        <dt className="inline font-bold">Marge HT : </dt>
        <dd className="inline text-muted-foreground">
          ce CA facturé moins les coûts engagés (statuts Engagé, Reçu / facturé ou Payé) datés dans
          l&apos;année (date de facture, à défaut de paiement, d&apos;échéance, puis d&apos;engagement).
          Hors temps interne valorisé et hors charges fixes de l&apos;agence.
        </dd>
      </div>
      <div>
        <dt className="inline font-bold">Projets démarrés : </dt>
        <dd className="inline text-muted-foreground">
          projets dont la date de début (à défaut le démarrage réel, puis la création) tombe dans
          l&apos;année.
        </dd>
      </div>
      <div>
        <dt className="inline font-bold">Rythme : </dt>
        <dd className="inline text-muted-foreground">
          le trait rouge marque la part de l&apos;année écoulée ; une jauge à sa gauche est en retard sur
          un rythme régulier.
        </dd>
      </div>
    </dl>
  );
}
