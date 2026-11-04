import { presenceLabels, type PresenceValue } from "@/features/presence/rules";
import { cn } from "@/lib/utils";

const tones: Record<PresenceValue, string> = {
  DISPO: "bg-success",
  FOCUS: "bg-pen",
  REUNION: "bg-warning",
  ABSENT: "border border-muted-foreground bg-background",
};

/** Pastille du statut choisi par l'associé (jamais d'heure de connexion), annoncée en texte. */
export function PresenceDot({ state, className }: { state: PresenceValue; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", className)}>
      <span aria-hidden="true" className={cn("size-2.5 rounded-full", tones[state])} />
      <span className="sr-only">{presenceLabels[state]}</span>
    </span>
  );
}
