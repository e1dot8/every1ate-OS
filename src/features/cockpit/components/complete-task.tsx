"use client";

import { useActionState, useEffect, useState } from "react";
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

/** Les XP gagnés : un message bref en bas de l'écran, qui s'efface seul (jamais bloquant). */
function XpToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  const xp = /\+\d+ XP/.exec(message)?.[0];
  const rest = message
    .replace("Statut mis à jour.", "")
    .replace(xp ?? "", "")
    .replace(/^\s*\.?\s*/, "")
    .trim();
  return (
    <div
      role="status"
      className="fixed right-4 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] z-50 flex max-w-sm animate-in items-center gap-3 rounded-md bg-ink px-4 py-3 text-sm text-paper fade-in slide-in-from-bottom-2 md:bottom-6"
    >
      <Check aria-hidden="true" className="size-4 shrink-0 text-highlight" />
      <span>
        Tâche terminée.
        {xp ? <b className="ml-1 text-highlight">{xp}</b> : null}
        {rest ? <span className="block text-paper/80">{rest}</span> : null}
      </span>
    </div>
  );
}

/**
 * Terminer une tâche depuis le cockpit, sans ouvrir sa fiche. Reste monté une fois la tâche
 * terminée, pour afficher la petite célébration.
 */
export function CompleteTask({
  taskId,
  title,
  done = false,
}: {
  taskId: string;
  title: string;
  done?: boolean;
}) {
  const [state, action] = useActionState(changeTaskStatusAction, initialFormState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value="TERMINE" />
      {done ? (
        <span
          className="inline-flex size-tap shrink-0 items-center justify-center rounded-full bg-ink text-paper"
          aria-label="Terminée"
        >
          <Check aria-hidden="true" className="size-4" />
        </span>
      ) : (
        <Tick title={title} />
      )}
      {state.status === "success" && state.message ? (
        <XpToast key={state.message} message={state.message} />
      ) : null}
      {state.status === "error" && state.message ? (
        <p role="alert" className="max-w-56 text-right text-xs font-bold text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
