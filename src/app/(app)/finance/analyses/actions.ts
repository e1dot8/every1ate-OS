"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { parseMoney } from "@/lib/money";
import { MAX_YEAR, MIN_YEAR, saveObjective } from "@/features/finance/analytics";

const PATH = "/finance/analyses";

const fail = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});

const year = z
  .string()
  .optional()
  .transform((v, ctx) => {
    const y = v && /^\d{4}$/.test(v.trim()) ? Number(v.trim()) : NaN;
    if (!(y >= MIN_YEAR && y <= MAX_YEAR)) {
      ctx.addIssue({ code: "custom", message: `Année invalide (${MIN_YEAR} à ${MAX_YEAR}).` });
      return z.NEVER;
    }
    return y;
  });

/** Montant facultatif strictement positif (vide = pas d'objectif). */
const objectiveAmount = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return null;
    const cents = parseMoney(v);
    if (cents == null) {
      ctx.addIssue({ code: "custom", message: "Montant invalide (ex. 250 000)." });
      return z.NEVER;
    }
    if (cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Le montant doit être supérieur à 0." });
      return z.NEVER;
    }
    return cents;
  });

const objectiveSchema = z.object({
  year,
  revenue: objectiveAmount,
  margin: objectiveAmount,
  projectCount: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      const n = /^\d{1,4}$/.test(v.trim()) ? Number(v.trim()) : NaN;
      if (!(n >= 1)) {
        ctx.addIssue({ code: "custom", message: "Nombre entier de 1 à 9999." });
        return z.NEVER;
      }
      return n;
    }),
  /** Année affichée par la page : on y revient si une autre année est enregistrée. */
  pageYear: z.string().optional(),
});

export async function saveObjectiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = objectiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { pageYear, ...input } = parsed.data;
  const result = await saveObjective(input, user);
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(PATH);
  revalidatePath("/cockpit");
  if (pageYear !== String(input.year)) redirect(`${PATH}?annee=${input.year}#objectifs`);
  return { status: "success", message: `Objectifs ${input.year} enregistrés.` };
}
