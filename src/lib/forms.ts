import type { z } from "zod";

/** État renvoyé par une Server Action de formulaire. Les mots de passe ne sont jamais renvoyés. */
export type FormState = {
  status: "idle" | "error" | "success" | "blocked";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

const SECRET_FIELDS = new Set(["password", "confirm", "current", "token"]);

/** Valeurs saisies à réafficher après une erreur (sans les champs secrets). */
export function keptValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !SECRET_FIELDS.has(key) && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export function validationError(error: z.ZodError, formData: FormData): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return {
    status: "error",
    message: "Corrigez les champs signalés.",
    fieldErrors,
    values: keptValues(formData),
  };
}
