"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QUICK_DURATIONS, type EstimateHint } from "@/features/time/estimate-rules";
import { formatMinutes } from "@/features/planning/rules";
import { cn } from "@/lib/utils";

const hours = (minutes: number) => String(Math.round((minutes / 60) * 100) / 100).replace(".", ",");

/**
 * Durée estimée : saisie libre en heures, durées rapides, et une suggestion modifiable
 * (durée observée sur des tâches comparables, ou plage selon la complexité).
 */
export function EstimateField({
  defaultValue,
  error,
  hint,
}: {
  defaultValue: string;
  error?: string;
  hint?: EstimateHint;
}) {
  const [value, setValue] = useState(defaultValue);
  const id = "champ-estimatedHours";
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Durée estimée (h)</Label>
      <Input
        id={id}
        name="estimatedHours"
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erreur` : `${id}-aide`}
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Durées rapides">
        {QUICK_DURATIONS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setValue(hours(m))}
            className={cn(
              "inline-flex min-h-tap items-center rounded-full border border-input px-3 text-[13px] font-bold hover:bg-muted",
              value === hours(m) && "border-ink bg-ink text-paper hover:bg-ink",
            )}
          >
            {formatMinutes(m)}
          </button>
        ))}
        {hint?.kind === "history" ? (
          <button
            type="button"
            onClick={() => setValue(hours(hint.median))}
            className="inline-flex min-h-tap items-center rounded-full border-2 border-ink bg-highlight/50 px-3 text-[13px] font-bold"
          >
            Observé : {formatMinutes(hint.median)}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-erreur`} className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p id={`${id}-aide`} className="text-sm text-muted-foreground">
          {hint?.kind === "history"
            ? `Médiane de ${hint.samples} tâches comparables terminées (même catégorie et complexité). Une suggestion, pas une consigne.`
            : hint
              ? `Repère indicatif pour cette complexité : ${formatMinutes(hint.min)} à ${formatMinutes(hint.max)}. Il s'affinera avec vos tâches terminées.`
              : "Facultatif. Une estimation se corrige à tout moment."}
        </p>
      )}
    </div>
  );
}
