"use client";

import { useActionState } from "react";
import { Field } from "@/components/forms/field";
import { SelectField, TextareaField } from "@/components/forms/controls";
import { FormMessages } from "@/components/forms/form-messages";
import { SubmitButton } from "@/components/forms/submit-button";
import { Input } from "@/components/ui/input";
import { markUsedAction, saveRecipeAction } from "@/app/(app)/recettes/actions";
import { initialFormState } from "@/lib/forms";

type Opt = { value: string; label: string };

export function RecipeForm({
  categories,
  recipe,
}: {
  categories: Opt[];
  recipe?: { id: string; title: string; category: string; summary: string; body: string; url: string | null };
}) {
  const [state, action] = useActionState(saveRecipeAction, initialFormState);
  const v = state.status === "error" ? (state.values ?? {}) : {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessages state={state} />
      {recipe ? <input type="hidden" name="id" value={recipe.id} /> : null}
      <Field
        name="title"
        label="Titre"
        defaultValue={v.title ?? recipe?.title}
        error={state.fieldErrors?.title}
      />
      <SelectField
        name="category"
        label="Catégorie"
        defaultValue={v.category ?? recipe?.category ?? ""}
        error={state.fieldErrors?.category}
        options={[{ value: "", label: "Choisir…" }, ...categories]}
      />
      <Field
        name="summary"
        label="À quoi sert-elle ?"
        hint="Une phrase, lue dans la liste."
        defaultValue={v.summary ?? recipe?.summary}
        error={state.fieldErrors?.summary}
      />
      <TextareaField
        name="body"
        label="Les étapes"
        rows={10}
        defaultValue={v.body ?? recipe?.body ?? ""}
        error={state.fieldErrors?.body}
      />
      <Field
        name="url"
        label="Modèle ou ressource (lien https, facultatif)"
        required={false}
        defaultValue={v.url ?? recipe?.url ?? ""}
        error={state.fieldErrors?.url}
      />
      <div>
        <SubmitButton>{recipe ? "Enregistrer la recette" : "Ajouter au carnet"}</SubmitButton>
      </div>
    </form>
  );
}

export function UsedForm({ id }: { id: string }) {
  const [state, action] = useActionState(markUsedAction, initialFormState);
  if (state.status === "success") return <FormMessages state={state} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <FormMessages state={state} />
      <input type="hidden" name="id" value={id} />
      <label className="flex flex-col gap-1 text-sm font-bold">
        Sur quel projet ? (facultatif)
        <Input name="note" maxLength={300} />
      </label>
      <div>
        <SubmitButton>Je l&apos;ai réutilisée</SubmitButton>
      </div>
    </form>
  );
}
