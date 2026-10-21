"use client";

import { useActionState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { overrunReviewAction, setRemainingAction } from "@/app/(app)/temps/actions";
import { overrunReasonLabels } from "@/features/time/estimate-rules";
import { initialFormState } from "@/lib/forms";

/** Temps restant estimé, modifiable à tout moment (vide = estimation − temps suivi). */
export function RemainingForm({ taskId, current }: { taskId: string; current: string }) {
  const [state, action] = useActionState(setRemainingAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <FormMessages state={state} />
      <input type="hidden" name="taskId" value={taskId} />
      <Label htmlFor="champ-remaining">Temps restant estimé</Label>
      <div className="flex gap-2">
        <Input
          id="champ-remaining"
          name="remaining"
          defaultValue={current}
          placeholder="Ex. 1h30"
          aria-describedby="champ-remaining-aide"
          className="max-w-36"
        />
        <SubmitButton variant="outline">Enregistrer le restant</SubmitButton>
      </div>
      <p id="champ-remaining-aide" className="text-xs text-muted-foreground">
        Vide : calculé à partir de l&apos;estimation et du temps suivi.
      </p>
    </form>
  );
}

/**
 * Mini-bilan proposé quand le réel dépasse nettement l'estimation. Facultatif, en un clic,
 * pour mieux estimer la prochaine fois : rien n'est noté, rien n'est comparé entre associés.
 */
export function OverrunReview({ taskId, summary }: { taskId: string; summary: string }) {
  const [state, action] = useActionState(overrunReviewAction, initialFormState);
  if (state.status === "success") return <FormAlert tone="success" title={state.message ?? "Noté."} />;
  return (
    <section
      aria-labelledby="bilan-titre"
      className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-ink p-4"
    >
      <div>
        <h3 id="bilan-titre" className="font-bold">
          Mini-bilan (facultatif)
        </h3>
        <p className="text-sm text-muted-foreground">{summary} Qu&apos;est-ce qui a pris plus de temps ?</p>
      </div>
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="taskId" value={taskId} />
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Raison principale</legend>
          {Object.entries(overrunReasonLabels).map(([value, label]) => (
            <label
              key={value}
              className="has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper flex min-h-tap cursor-pointer items-center rounded-full border border-input px-3 text-[13px] font-bold"
            >
              <input type="radio" name="reason" value={value} className="sr-only" />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-bold">
          Un mot pour la prochaine fois (facultatif)
          <Input name="note" maxLength={500} />
        </label>
        <div className="flex flex-wrap gap-2">
          <SubmitButton>Enregistrer</SubmitButton>
        </div>
      </form>
      <form action={action}>
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="reason" value="skip" />
        <SubmitButton variant="ghost">Passer</SubmitButton>
      </form>
    </section>
  );
}
