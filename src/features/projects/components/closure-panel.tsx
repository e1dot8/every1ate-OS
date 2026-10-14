import { Check, Sparkles } from "lucide-react";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/select";
import { SatisfactionForm } from "@/features/projects/components/satisfaction-form";
import { closureHints } from "@/features/projects/closure-auto";
import { closureFacts } from "@/features/projects/service";
import { projectFinance } from "@/features/finance/service";
import { formatMinutes } from "@/features/planning/rules";
import { daysBetween, formatDateTime, formatDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  checkVerifiedClosureAction,
  saveReviewAction,
  toggleClosureAction,
} from "@/app/(app)/projets/actions";

type Item = {
  id: string;
  key: string;
  label: string;
  checked: boolean;
  checkedAt: Date | null;
  note: string | null;
  checkedBy: { name: string } | null;
};

export async function ClosurePanel(props: {
  project: {
    id: string;
    status: string;
    closedAt: Date | null;
    closingReview: string | null;
    clientSatisfaction: number | null;
    satisfactionNote: string | null;
    startDate: Date | null;
    plannedEndDate: Date | null;
    baselineEndDate: Date | null;
  };
  items: Item[];
}) {
  const { project: p, items } = props;
  const [facts, finance] = await Promise.all([closureFacts(p.id), projectFinance(p.id)]);
  const hints = closureHints({ ...facts, hasReview: !!p.closingReview?.trim() });
  const ready = items.filter((c) => !c.checked && hints[c.key]?.verifiable && hints[c.key]?.ok);
  const left = items.filter((c) => !c.checked).length;
  const closed = p.status === "TERMINE" || p.status === "ARCHIVE";
  const s = finance?.summary;
  const end = p.closedAt ?? new Date();
  const keyFigures = s
    ? [
        [
          "Revenus",
          `prévus ${formatMoney(s.revenuePlanned, { round: true })} · facturés ${formatMoney(s.billingInvoiced, { round: true })}`,
        ],
        [
          "Coûts",
          `budget ${s.budgetCost == null ? "—" : formatMoney(s.budgetCost, { round: true })} · engagés ${formatMoney(s.costsCommitted, { round: true })}`,
        ],
        [
          "Marge",
          `prévue ${formatMoney(s.marginForecast, { round: true })} · réelle ${formatMoney(s.marginActual, { round: true })}${s.marginActualAfterTime != null ? ` · après temps ${formatMoney(s.marginActualAfterTime, { round: true })}` : ""}`,
        ],
        ["Temps", formatMinutes(finance!.minutes)],
        [
          "Délais",
          p.startDate
            ? `${daysBetween(p.startDate, end)} jours réels${p.baselineEndDate ? ` pour ${daysBetween(p.startDate, p.baselineEndDate)} prévus` : ""}`
            : "—",
        ],
      ]
    : [];
  return (
    <div className="flex flex-col gap-4">
      {closed ? (
        <FormAlert tone="success" title={`Projet clôturé le ${formatDay(p.closedAt)}.`} />
      ) : (
        <FormAlert
          tone={left ? "warning" : "success"}
          title={
            left
              ? `${left} point${left > 1 ? "s" : ""} à traiter avant de clôturer.`
              : "Checklist complète : le responsable global peut clôturer."
          }
        >
          Le statut « Terminé » n&apos;est possible qu&apos;avec la checklist complète. Le responsable global
          confirme la clôture.
        </FormAlert>
      )}
      {ready.length && !closed ? (
        <form
          action={checkVerifiedClosureAction}
          className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-ink p-3"
        >
          <input type="hidden" name="projectId" value={p.id} />
          {ready.map((c) => (
            <input key={c.key} type="hidden" name="key" value={c.key} />
          ))}
          <Sparkles aria-hidden="true" className="size-5" />
          <span className="flex-1 text-sm">
            <b>
              {ready.length} point{ready.length > 1 ? "s" : ""} vérifié{ready.length > 1 ? "s" : ""} par les
              données
            </b>{" "}
            : {ready.map((c) => c.label.toLowerCase()).join(", ")}.
          </span>
          <SubmitButton>Valider ces points</SubmitButton>
        </form>
      ) : null}
      <Card className="gap-0 py-1">
        <ul aria-label="Checklist de clôture">
          {items.map((c) => {
            const hint = hints[c.key];
            return (
              <li key={c.id} className="flex items-center gap-3 border-b py-3 last:border-b-0">
                <form action={toggleClosureAction}>
                  <input type="hidden" name="projectId" value={p.id} />
                  <input type="hidden" name="itemId" value={c.id} />
                  <input type="hidden" name="checked" value={String(!c.checked)} />
                  <button
                    type="submit"
                    aria-label={`${c.checked ? "Décocher" : "Cocher"} : ${c.label}`}
                    aria-pressed={c.checked}
                    className={`flex size-tap items-center justify-center rounded-lg border ${c.checked ? "border-ink bg-ink text-paper" : "border-input"}`}
                  >
                    {c.checked ? <Check aria-hidden="true" className="size-4" /> : null}
                  </button>
                </form>
                <div className="flex min-w-0 flex-col">
                  <span className="font-bold">{c.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {c.checked
                      ? `${c.checkedBy?.name ?? "—"} · ${formatDateTime(c.checkedAt)}${c.note ? ` · ${c.note}` : ""}`
                      : hint
                        ? hint.reason
                        : "À faire"}
                  </span>
                </div>
                {!c.checked && hint?.verifiable ? (
                  <span
                    className={`ml-auto shrink-0 text-xs font-bold ${hint.ok ? "text-success" : "text-warning"}`}
                  >
                    {hint.ok ? "Vérifié" : "Pas encore"}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Bilan du projet</CardTitle>
          <CardDescription>
            Enseignements, points forts, points à améliorer. Il nourrit le chiffrage des prochains projets.
          </CardDescription>
        </CardHeader>
        {keyFigures.length ? (
          <dl
            className="grid gap-x-4 gap-y-1 rounded-lg bg-muted/60 p-3 text-sm sm:grid-cols-[auto_1fr]"
            aria-label="Chiffres clés"
          >
            {keyFigures.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-bold">{k}</dt>
                <dd className="text-muted-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <form action={saveReviewAction} className="flex flex-col gap-3">
          <input type="hidden" name="projectId" value={p.id} />
          <Textarea
            name="review"
            rows={5}
            aria-label="Bilan du projet"
            defaultValue={p.closingReview ?? ""}
          />
          <div>
            <SubmitButton variant="outline">Enregistrer le bilan</SubmitButton>
          </div>
        </form>
      </Card>
      <Card className="gap-3">
        <CardTitle>Satisfaction client</CardTitle>
        <SatisfactionForm projectId={p.id} score={p.clientSatisfaction} note={p.satisfactionNote} />
      </Card>
    </div>
  );
}
