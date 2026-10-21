"use client";

import { useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { setPrioritiesAction } from "@/app/(app)/priorites/actions";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Option = { id: string; title: string; detail: string };

/** Choix des priorités du jour : trois au plus, l'ordre de coche fait l'ordre d'affichage. */
export function PriorityPicker({
  options,
  selected,
  max,
}: {
  options: Option[];
  selected: string[];
  max: number;
}) {
  const [state, action] = useActionState(setPrioritiesAction, initialFormState);
  const [picked, setPicked] = useState<string[]>(selected);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < max ? [...p, id] : p));
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status === "error" && state.message ? <FormAlert tone="danger" title={state.message} /> : null}
      {picked.map((id) => (
        <input key={id} type="hidden" name="taskIds" value={id} />
      ))}
      <fieldset className="flex flex-col">
        <legend className="mb-2 text-sm font-bold">
          {picked.length} / {max} choisie{picked.length > 1 ? "s" : ""}
        </legend>
        {options.map((o) => {
          const position = picked.indexOf(o.id);
          const full = position < 0 && picked.length >= max;
          return (
            <label
              key={o.id}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 border-b py-2 last:border-b-0",
                full && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="checkbox"
                className="size-5 accent-[var(--ink)]"
                checked={position >= 0}
                disabled={full}
                onChange={() => toggle(o.id)}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{o.title}</span>
                <span className="truncate text-sm text-muted-foreground">{o.detail}</span>
              </span>
              {position >= 0 ? (
                <span className="font-annotation text-sm font-bold text-pen-strong">n°{position + 1}</span>
              ) : null}
            </label>
          );
        })}
      </fieldset>
      <div>
        <SubmitButton>Valider mes priorités</SubmitButton>
      </div>
    </form>
  );
}
