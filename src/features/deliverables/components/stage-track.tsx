import { ArrowLeft, ArrowRight } from "lucide-react";
import type { DeliverableStage } from "@/generated/prisma/enums";
import { Callout } from "@/components/notion/blocks";
import { SubmitButton } from "@/components/forms/submit-button";
import { cn } from "@/lib/utils";
import {
  STAGES,
  nextStage,
  previousStage,
  shouldAutoAdvance,
  stageIndex,
  stageLabels,
  stageProgress,
  type CheckLike,
} from "@/features/deliverables/rules";
import { changeStageAction } from "@/app/(app)/livrables/actions";

function StageForm({
  deliverableId,
  stage,
  children,
  className,
  label,
}: {
  deliverableId: string;
  stage: DeliverableStage;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <form action={changeStageAction} className={className}>
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <input type="hidden" name="stage" value={stage} />
      <button
        type="submit"
        aria-label={label}
        className="flex min-h-tap w-full cursor-pointer flex-col gap-1 rounded-md p-1.5 text-left hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {children}
      </button>
    </form>
  );
}

/** Frise des six étapes : l'étape courante en rouge stylo ; chaque autre étape est un bouton. */
export function StageTrack({
  deliverableId,
  stage,
  items,
  readOnly,
}: {
  deliverableId: string;
  stage: DeliverableStage;
  items: CheckLike[];
  readOnly: boolean;
}) {
  const current = stageIndex(stage);
  const next = nextStage(stage);
  const previous = previousStage(stage);
  const complete = shouldAutoAdvance(items, stage);
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Étapes du livrable" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {STAGES.map((s, i) => {
          const p = stageProgress(items, s);
          const body = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 rounded-full",
                  i < current ? "bg-ink" : i === current ? "bg-pen" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "text-xs leading-tight font-bold",
                  i === current
                    ? "text-pen-strong"
                    : i < current
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {i + 1}. {stageLabels[s]}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {s === "LIVRE" ? (i <= current ? "✓" : "\u00a0") : p.total ? `${p.done}/${p.total}` : "—"}
              </span>
            </>
          );
          return (
            <li key={s} aria-current={i === current ? "step" : undefined}>
              {i === current || readOnly ? (
                <div
                  className={cn("flex flex-col gap-1 rounded-md p-1.5", i === current && "bg-highlight/40")}
                >
                  {body}
                  {i === current ? <span className="sr-only">Étape en cours</span> : null}
                </div>
              ) : (
                <StageForm
                  deliverableId={deliverableId}
                  stage={s}
                  label={`Passer à l'étape ${stageLabels[s]}`}
                >
                  {body}
                </StageForm>
              )}
            </li>
          );
        })}
      </ol>
      {readOnly ? null : (
        <>
          {complete && next ? (
            <Callout icon="✅" tone="success">
              Tous les points de l&apos;étape « {stageLabels[stage]} » sont cochés.
            </Callout>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {next ? (
              <form action={changeStageAction}>
                <input type="hidden" name="deliverableId" value={deliverableId} />
                <input type="hidden" name="stage" value={next} />
                <SubmitButton variant={complete ? "default" : "outline"} pendingLabel="Changement…">
                  {next === "LIVRE" ? "Marquer comme livré" : `Passer en ${stageLabels[next]}`}
                  <ArrowRight aria-hidden="true" />
                </SubmitButton>
              </form>
            ) : null}
            {previous ? (
              <form action={changeStageAction}>
                <input type="hidden" name="deliverableId" value={deliverableId} />
                <input type="hidden" name="stage" value={previous} />
                <SubmitButton variant="ghost" pendingLabel="Changement…">
                  <ArrowLeft aria-hidden="true" />
                  Revenir en {stageLabels[previous]}
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
