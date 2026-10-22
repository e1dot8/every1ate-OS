"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { placeItemAction, saveAvatarAction } from "@/app/(app)/appartement/actions";
import { BrigadeAvatar } from "@/features/maison/components/avatar";
import type { AvatarLook, AvatarPart } from "@/features/maison/cosmetics";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

type Choice = { value: string; label: string; unlocked: boolean; condition: string };

const PART_LABELS: Record<AvatarPart, string> = {
  skin: "Teint",
  hat: "Couvre-chef",
  apron: "Tablier",
  accessory: "Accessoire",
  backdrop: "Fond",
};

const chip =
  "has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-paper flex min-h-tap cursor-pointer items-center gap-1.5 rounded-full border border-input px-3 text-[13px] font-bold has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

/** Éditeur d'avatar : quelques options, aperçu immédiat, options verrouillées expliquées. */
export function AvatarEditor({ look, options }: { look: AvatarLook; options: Record<AvatarPart, Choice[]> }) {
  const [state, action] = useActionState(saveAvatarAction, initialFormState);
  const [draft, setDraft] = useState<AvatarLook>(look);
  return (
    <form action={action} className="grid grid-cols-1 gap-5 md:grid-cols-[10rem_1fr]">
      <div className="flex flex-col items-center gap-2">
        <BrigadeAvatar look={draft} size={150} label="Aperçu de mon avatar" />
        <span className="font-annotation text-xs text-pen-strong">aperçu</span>
      </div>
      <div className="flex flex-col gap-4">
        <FormMessages state={state} />
        {(Object.keys(options) as AvatarPart[]).map((part) => (
          <fieldset key={part} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-bold">{PART_LABELS[part]}</legend>
            <div className="flex flex-wrap gap-2">
              {options[part].map((o) => (
                <label
                  key={o.value}
                  className={chip}
                  title={o.unlocked ? undefined : `Se débloque : ${o.condition}`}
                >
                  <input
                    type="radio"
                    name={part}
                    value={o.value}
                    disabled={!o.unlocked}
                    checked={draft[part] === o.value}
                    onChange={() => setDraft({ ...draft, [part]: o.value })}
                    className="sr-only"
                  />
                  {!o.unlocked ? <Lock aria-hidden="true" className="size-3" /> : null}
                  {o.label}
                  {!o.unlocked ? <span className="sr-only"> (verrouillé : {o.condition})</span> : null}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div>
          <SubmitButton>Enregistrer mon avatar</SubmitButton>
        </div>
      </div>
    </form>
  );
}

/** Un emplacement de l'appartement : choisir parmi les objets débloqués. */
export function SlotPicker({
  slot,
  name,
  current,
  choices,
}: {
  slot: string;
  name: string;
  current: string | null;
  choices: Choice[];
}) {
  const [state, action] = useActionState(placeItemAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl border p-3">
      <input type="hidden" name="slot" value={slot} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-bold">{name}</legend>
        <div className="flex flex-wrap gap-2">
          {slot === "vitrine" ? (
            <label className={chip}>
              <input type="radio" name="itemKey" value="vide" defaultChecked={!current} className="sr-only" />
              Vide
            </label>
          ) : null}
          {choices.map((o) => (
            <label
              key={o.value}
              className={cn(chip)}
              title={o.unlocked ? undefined : `Se débloque : ${o.condition}`}
            >
              <input
                type="radio"
                name="itemKey"
                value={o.value}
                disabled={!o.unlocked}
                defaultChecked={current === o.value}
                className="sr-only"
              />
              {!o.unlocked ? <Lock aria-hidden="true" className="size-3" /> : null}
              {o.label}
              {!o.unlocked ? <span className="text-[11px] font-normal">· {o.condition}</span> : null}
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessages state={state} />
      <div>
        <SubmitButton variant="outline">Installer</SubmitButton>
      </div>
    </form>
  );
}
