"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Flag } from "lucide-react";
import { questAction } from "@/app/(app)/quetes/actions";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Intent = "accepter" | "abandonner" | "valider";

function Submit({ label, intent, disabled }: { label: string; intent: Intent; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "inline-flex min-h-tap items-center justify-center rounded-full px-4 text-sm font-bold disabled:opacity-50",
        intent === "valider" && "border border-ink bg-highlight text-ink hover:bg-highlight/80",
        intent === "accepter" && "bg-ink text-paper hover:bg-ink/85",
        intent === "abandonner" && "text-muted-foreground underline hover:text-ink",
      )}
    >
      {pending ? "…" : label}
    </button>
  );
}

/** Célébration d'une quête accomplie : un message en bas de l'écran, qui s'efface seul. */
function QuestToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  const xp = /\+\d+ XP/.exec(message)?.[0];
  return (
    <div
      role="status"
      className="fixed right-4 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+1rem)] z-50 flex max-w-sm animate-in items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-paper fade-in slide-in-from-bottom-2 md:bottom-6"
    >
      <Flag aria-hidden="true" className="size-5 shrink-0 text-highlight" />
      <span>
        {message.replace(xp ?? "", "").trim()}
        {xp ? <b className="ml-1 text-highlight">{xp}</b> : null}
      </span>
    </div>
  );
}

/** Un bouton de quête (accepter, abandonner, valider) avec son retour. */
export function QuestButton({
  questKey,
  intent,
  label,
  disabled,
  done = false,
}: {
  questKey: string;
  intent: Intent;
  label: string;
  disabled?: boolean;
  /** Quête validée : le formulaire reste monté pour afficher la célébration. */
  done?: boolean;
}) {
  const [state, action] = useActionState(questAction, initialFormState);
  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="questKey" value={questKey} />
      <input type="hidden" name="intent" value={intent} />
      {done ? (
        <span className="inline-flex min-h-tap items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-paper">
          <Check aria-hidden="true" className="size-4 text-highlight" /> Accomplie
        </span>
      ) : (
        <Submit label={label} intent={intent} disabled={disabled} />
      )}
      {state.status === "error" ? (
        <p role="alert" className="text-xs font-bold text-danger">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" && intent === "valider" && state.message ? (
        <QuestToast message={state.message} />
      ) : null}
    </form>
  );
}
