"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { saveDailyBriefingAction } from "@/app/(app)/mise-en-place/actions";
import { moodLabels } from "@/features/briefing/rules";
import { initialFormState } from "@/lib/forms";

type Initial = {
  mood: string | null;
  moodShared: boolean;
  blocker: string | null;
  helpWanted: boolean;
  personalGoal: string | null;
};

const chip =
  "has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper flex min-h-tap cursor-pointer items-center rounded-full border border-input px-3 text-[13px] font-bold";

/** Le formulaire tient en un écran : tout est facultatif, l'OS a déjà rempli le reste. */
export function DailyForm({
  initial,
  confirmTaskIds,
  plannedMinutes,
}: {
  initial: Initial | null;
  confirmTaskIds: string[];
  plannedMinutes: number;
}) {
  const [state, action] = useActionState(saveDailyBriefingAction, initialFormState);
  const [blocker, setBlocker] = useState(initial?.blocker ?? "");
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      {confirmTaskIds.map((id) => (
        <input key={id} type="hidden" name="confirmTaskIds" value={id} />
      ))}
      <input type="hidden" name="plannedMinutes" value={plannedMinutes} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">État du jour (facultatif)</legend>
        <div className="flex flex-wrap gap-2">
          <label className={chip}>
            <input type="radio" name="mood" value="" defaultChecked={!initial?.mood} className="sr-only" />
            Je préfère ne pas dire
          </label>
          {Object.entries(moodLabels).map(([value, label]) => (
            <label key={value} className={chip}>
              <input
                type="radio"
                name="mood"
                value={value}
                defaultChecked={initial?.mood === value}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <label className="flex min-h-tap items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="moodShared"
            defaultChecked={initial?.moodShared ?? false}
            className="size-5 accent-[var(--ink)]"
          />
          Partager mon état avec la brigade (sinon, il reste privé)
        </label>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="champ-blocker" className="text-sm font-bold">
          Un blocage ou une aide dont j&apos;ai besoin (facultatif)
        </label>
        <textarea
          id="champ-blocker"
          name="blocker"
          rows={2}
          maxLength={500}
          value={blocker}
          onChange={(e) => setBlocker(e.target.value)}
          className="rounded-lg border border-input px-3 py-2"
        />
        {blocker.trim() ? (
          <label className="flex min-h-tap items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="helpWanted"
              defaultChecked={initial?.helpWanted ?? false}
              className="size-5 accent-[var(--ink)]"
            />
            Demander un coup de main à la brigade (elle est prévenue dans son courrier)
          </label>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="champ-goal" className="text-sm font-bold">
          Ce que je travaille pour moi aujourd&apos;hui (facultatif)
        </label>
        <Input
          id="champ-goal"
          name="personalGoal"
          maxLength={300}
          defaultValue={initial?.personalGoal ?? ""}
          placeholder="Ex. une compétence, une publication, un apprentissage"
        />
      </div>
      <div>
        <SubmitButton>{initial ? "Mettre à jour" : "C'est parti"}</SubmitButton>
      </div>
    </form>
  );
}
