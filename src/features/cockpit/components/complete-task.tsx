"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { useFormStatus } from "react-dom";
import { changeTaskStatusAction } from "@/app/(app)/projets/actions";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

function Tick({ title }: { title: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Terminer « ${title} »`}
      title="Marquer comme terminée"
      className="inline-flex size-tap shrink-0 items-center justify-center rounded-full border-2 border-ink hover:bg-highlight disabled:opacity-50"
    >
      <Check aria-hidden="true" className={cn("size-4", pending ? "text-ink" : "text-muted-foreground")} />
    </button>
  );
}

/** Terminer une tâche depuis le cockpit, sans ouvrir sa fiche. Les XP s'affichent juste après. */
export function CompleteTask({ taskId, title }: { taskId: string; title: string }) {
  const [state, action] = useActionState(changeTaskStatusAction, initialFormState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value="TERMINE" />
      <Tick title={title} />
      {state.status === "error" && state.message ? (
        <p role="alert" className="max-w-56 text-right text-xs font-bold text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
