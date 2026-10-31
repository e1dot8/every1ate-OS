import Form from "next/form";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { estimateFromHistory, type Stat } from "@/features/finance/estimate";
import {
  compareToHistory,
  historyFromOverview,
  type HistoryPosition,
  type OverviewProject,
} from "@/features/finance/export";
import { templateHistory } from "@/features/finance/service";
import { formatMinutes } from "@/features/planning/rules";
import { getTemplate, TEMPLATES } from "@/features/projects/templates";
import { formatMoney } from "@/lib/money";

/** Ce qui est comparé aux repères : montants en centimes, face aux revenus ou aux coûts passés. */
type Comparison = {
  items: { label: string; value: number | null; against: "revenue" | "costs" }[];
  /** Message quand il n'y a encore rien à comparer. */
  missing: string;
};

const TITLE_ID = "chiffrage-indicatif";
const money = (c: number) => formatMoney(c, { round: true });
// Espace insécable avant « % » et « j » : pas de retour à la ligne entre le nombre et l'unité.
const pct = (v: number) => `${v.toLocaleString("fr-FR")}\u00a0%`;
const days = (v: number) => `${v}\u00a0j`;
const hours = (v: number) => formatMinutes(v);
const projects = (n: number) => `${n} projet${n > 1 ? "s" : ""}`;
const sourceText = (key: string | null) =>
  key
    ? `Repères tirés des projets du modèle « ${getTemplate(key)?.name ?? "Modèle inconnu"} ».`
    : "Repères tirés des projets créés sans modèle.";

function Frame({ description, children }: { description: ReactNode; children: ReactNode }) {
  return (
    <Card role="region" aria-labelledby={TITLE_ID} className="gap-3">
      <div className="flex flex-col gap-1">
        <CardTitle id={TITLE_ID}>Chiffrage indicatif</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      {children}
    </Card>
  );
}

function Figure({ label, stat, format }: { label: string; stat: Stat; format: (v: number) => string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-col">
        {stat ? (
          <>
            <b className="tabular-nums">{format(stat.median)}</b>
            <span className="text-xs text-muted-foreground">
              médiane
              {stat.count > 1 ? ` · ${format(stat.min)} – ${format(stat.max)}` : " · 1 seul projet"}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">pas de donnée</span>
        )}
      </dd>
    </div>
  );
}

const positionLabels: Record<HistoryPosition["kind"], string> = {
  dessous: "en dessous de la fourchette",
  dans: "dans la fourchette",
  dessus: "au-dessus de la fourchette",
};

function positionText(p: HistoryPosition) {
  const delta =
    p.deltaPct == null ? "" : ` (${p.deltaPct > 0 ? "+" : ""}${pct(p.deltaPct)} par rapport à la médiane)`;
  return `${positionLabels[p.kind]}${delta}`;
}

function EstimateBody({
  templateKey,
  excludeId,
  compare,
  rows,
}: {
  templateKey: string | null;
  excludeId?: string;
  compare?: Comparison;
  rows: OverviewProject[];
}) {
  const e = estimateFromHistory(historyFromOverview(rows), templateKey, excludeId);
  const n = e.projects.length;
  if (!n)
    return (
      <p className="text-sm text-muted-foreground">
        Pas encore d&apos;historique pour ce modèle. Les repères apparaîtront dès qu&apos;
        {excludeId ? "un autre projet" : "un projet"} de ce modèle aura un budget, des coûts ou du temps
        saisis.
      </p>
    );
  const comparisons = (compare?.items ?? []).flatMap((c) => {
    const position = compareToHistory(c.value, c.against === "revenue" ? e.revenue : e.costs);
    return position && c.value != null ? [{ label: c.label, value: c.value, position }] : [];
  });
  // Rien de comparé : montant à saisir ici, ou historique sans revenus/coûts (seulement du temps).
  const ownValue = (compare?.items ?? []).some((c) => c.value != null && c.value > 0);
  return (
    <>
      <p className="text-sm">
        {e.basis === "clotures"
          ? `Basé sur ${projects(n)} terminés du même modèle.`
          : `Basé sur ${projects(n)} du même modèle, en cours inclus (moins de 2 projets terminés).`}
      </p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Figure label="Revenus HT" stat={e.revenue} format={money} />
        <Figure label="Coûts engagés HT" stat={e.costs} format={money} />
        <Figure label="Taux de marge" stat={e.marginRate} format={pct} />
        <Figure label="Durée (début → clôture)" stat={e.durationDays} format={days} />
        <Figure label="Temps passé" stat={e.minutes} format={hours} />
      </dl>
      {compare ? (
        comparisons.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Comparaison avec l'historique">
            {comparisons.map((c) => (
              <li key={c.label}>
                {c.label} : <b className="tabular-nums">{money(c.value)}</b>, {positionText(c.position)}.
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            {ownValue ? "Aucun montant comparable dans l'historique de ce modèle." : compare.missing}
          </p>
        )
      ) : null}
      <p className="font-annotation text-xs text-pen-strong">
        Indicatif, basé sur {projects(n)} : ni un devis, ni un engagement.
      </p>
    </>
  );
}

/**
 * Chiffrage par l'historique (sans IA : médianes des projets passés du même modèle),
 * pour un projet : comparé à ses propres revenus et coûts prévus, lui-même exclu des repères.
 * Seuls les projets du modèle sont chargés, archivés compris (projets clôturés puis archivés).
 */
export async function EstimateCard({
  projectId,
  templateKey,
  archived,
  revenue,
  costs,
}: {
  projectId: string;
  templateKey: string | null;
  archived: boolean;
  revenue: number;
  costs: number;
}) {
  // Projet archivé : rien à chiffrer, pas de repères à afficher.
  if (archived) return null;
  const rows = await templateHistory(templateKey);
  return (
    <Frame description={sourceText(templateKey)}>
      <EstimateBody
        templateKey={templateKey}
        excludeId={projectId}
        rows={rows}
        compare={{
          items: [
            { label: "Revenus prévus de ce projet", value: revenue, against: "revenue" },
            { label: "Coûts prévisionnels de ce projet", value: costs, against: "costs" },
          ],
          missing: "Saisissez un budget pour comparer ce projet aux repères.",
        }}
      />
    </Frame>
  );
}

/**
 * Chiffrage indicatif d'une opportunité : elle n'a pas de modèle, on le choisit (?modele=)
 * puis on compare son montant estimé à la médiane des projets de ce modèle.
 */
export async function OpportunityEstimate({
  opportunityId,
  amount,
  templateKey,
}: {
  opportunityId: string;
  amount: number | null;
  templateKey: string | undefined;
}) {
  const key = templateKey && getTemplate(templateKey) ? templateKey : null;
  const rows = key ? await templateHistory(key) : null;
  return (
    <Frame
      description={
        key
          ? sourceText(key)
          : "Choisissez le modèle de projet le plus proche pour voir des repères tirés des projets passés."
      }
    >
      {/* GET ?modele= : navigation client sans remonter en haut de page (carte en bas de fiche sur
          mobile) ; sans JavaScript, formulaire HTML classique. */}
      <Form
        action={`/crm/opportunites/${opportunityId}`}
        scroll={false}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1.5">
          <label htmlFor="modele" className="text-sm font-bold">
            Modèle de projet comparable
          </label>
          {/* key : remonté à chaque changement d'URL (retour arrière), defaultValue suit ?modele=. */}
          <Select key={key ?? ""} id="modele" name="modele" defaultValue={key ?? ""} required>
            <option value="" disabled>
              Choisir un modèle…
            </option>
            {TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="outline">
          Comparer
        </Button>
      </Form>
      {rows ? (
        <EstimateBody
          templateKey={key}
          rows={rows}
          compare={{
            items: [{ label: "Montant estimé de cette opportunité", value: amount, against: "revenue" }],
            missing: "Indiquez un montant estimé pour le comparer aux repères.",
          }}
        />
      ) : null}
    </Frame>
  );
}
