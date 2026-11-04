"use client";

import { Check } from "lucide-react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Case à cocher d'un point de checklist : bouton d'envoi du formulaire parent (fonctionne sans
 * JavaScript), exposé comme une vraie case (role « checkbox »). Pendant l'envoi, la case affiche
 * déjà son nouvel état.
 */
export function CheckButton({ checked, label }: { checked: boolean; label: string }) {
  const { pending } = useFormStatus();
  const shown = pending ? !checked : checked;
  return (
    <button
      type="submit"
      role="checkbox"
      aria-checked={shown}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={pending}
      className="flex size-tap shrink-0 cursor-pointer items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 items-center justify-center rounded border-2 transition-colors",
          shown ? "border-ink bg-ink text-paper" : "border-input bg-background",
        )}
      >
        {shown ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </button>
  );
}
