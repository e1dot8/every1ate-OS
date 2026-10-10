"use client";

import { FormAlert } from "@/components/forms/form-alert";
import type { FormState } from "@/lib/forms";

/** Message global d'un formulaire (erreur ou succès). */
export function FormMessages({ state }: { state: FormState }) {
  if (state.status === "error" && state.message) return <FormAlert tone="danger" title={state.message} />;
  if (state.status === "success" && state.message) return <FormAlert tone="success" title={state.message} />;
  return null;
}
