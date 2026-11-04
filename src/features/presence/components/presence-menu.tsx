"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";
import {
  PRESENCE_CHOICES,
  PRESENCE_NOTE_MAX,
  presenceDot,
  type PresenceValue,
} from "@/features/presence/rules";
import { setPresenceAction } from "@/app/(app)/qg/actions";

/**
 * Puce de présence (barre du haut) : le statut est choisi, jamais déduit de l'activité.
 * Aucun journal ni historique : seul l'état courant est enregistré.
 */
export function PresenceMenu({
  state,
  label,
  note,
  shared,
  currentChoice,
}: {
  state: PresenceValue;
  /** Libellé affiché (« En focus · jusqu'à 11:30 »). */
  label: string;
  note: string | null;
  shared: boolean;
  currentChoice: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, action] = useActionState(setPresenceAction, initialFormState);
  const root = useRef<HTMLDivElement>(null);
  const uid = useId();
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  const [lastResult, setLastResult] = useState(result);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  if (result !== lastResult) {
    setLastResult(result);
    if (result.status === "success") setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, [open]);
  const choice = result.values?.choice ?? currentChoice;
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${uid}-menu`}
        aria-label={`Mon statut : ${label}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-tap min-w-tap items-center justify-center gap-2 rounded-full border px-3 text-sm font-bold hover:bg-muted md:max-w-56"
      >
        <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", presenceDot[state])} />
        <span aria-hidden="true" className="hidden truncate md:inline">
          {label}
        </span>
      </button>
      <div
        id={`${uid}-menu`}
        hidden={!open}
        className="fixed inset-x-4 top-20 z-50 rounded-xl border bg-card p-3 shadow-xl md:absolute md:inset-x-auto md:top-12 md:right-0 md:w-80"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-bold">Mon statut</p>
          <button
            type="button"
            aria-label="Fermer le menu de statut"
            onClick={() => setOpen(false)}
            className="inline-flex size-tap items-center justify-center rounded-full hover:bg-muted"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <form action={action} className="flex flex-col gap-3" noValidate>
          <FormMessages state={result.status === "error" ? result : initialFormState} />
          <fieldset className="flex flex-col">
            <legend className="sr-only">Statut</legend>
            {PRESENCE_CHOICES.map((c) => (
              <label
                key={c.key}
                className="flex min-h-tap cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-muted/60"
              >
                <input
                  type="radio"
                  name="choice"
                  value={c.key}
                  defaultChecked={choice === c.key}
                  className="size-5 accent-ink"
                />
                <span aria-hidden="true" className={cn("size-2.5 rounded-full", presenceDot[c.state])} />
                {c.label}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${uid}-note`}>Note courte (facultatif)</Label>
            <Input
              id={`${uid}-note`}
              name="note"
              maxLength={PRESENCE_NOTE_MAX}
              placeholder="Montage teaser, rappel à 15 h…"
              defaultValue={result.values?.note ?? note ?? ""}
            />
          </div>
          <label className="flex min-h-tap items-center gap-3">
            <input
              type="checkbox"
              name="shared"
              defaultChecked={result.values ? result.values.shared === "on" : shared}
              className="size-5 accent-ink"
            />
            Partager mon statut
          </label>
          <p className="text-xs text-muted-foreground">
            Visible des associés seulement si vous le partagez. Il expire seul ; aucun historique n&apos;est
            gardé.
          </p>
          <div>
            <SubmitButton>Enregistrer mon statut</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
