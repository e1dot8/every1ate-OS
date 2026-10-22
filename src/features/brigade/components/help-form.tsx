"use client";

import { useActionState, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { requestHelpAction } from "@/app/(app)/bureau/actions";
import { initialFormState } from "@/lib/forms";

type Opt = { value: string; label: string };

/** Demander un coup de main, relié à une tâche ou à une compétence. */
export function HelpForm({ taskId, skills }: { taskId?: string; skills?: Opt[] }) {
  const [state, action] = useActionState(requestHelpAction, initialFormState);
  const [open, setOpen] = useState(false);
  if (state.status === "success") return <FormMessages state={state} />;
  if (!open)
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <HeartHandshake aria-hidden="true" /> Demander un coup de main
      </Button>
    );
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border-2 border-dashed border-ink p-3">
      <FormMessages state={state} />
      {taskId ? <input type="hidden" name="taskId" value={taskId} /> : null}
      {skills?.length ? (
        <label className="flex flex-col gap-1 text-sm font-bold">
          Compétence concernée (facultatif)
          <select
            name="skillKey"
            className="min-h-tap rounded-lg border border-input bg-background px-3 font-normal"
          >
            <option value="">Aucune en particulier</option>
            {skills.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm font-bold">
        Ce qui coince
        <textarea
          name="message"
          rows={2}
          maxLength={500}
          className="rounded-lg border border-input px-3 py-2 font-normal"
        />
      </label>
      <div>
        <SubmitButton>Envoyer la demande</SubmitButton>
      </div>
    </form>
  );
}
