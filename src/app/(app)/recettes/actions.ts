"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { validationError, type FormState } from "@/lib/forms";
import { archiveRecipe, markRecipeUsed, saveRecipe } from "@/features/recipes/service";

const schema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "Un titre parlant.").max(160),
  category: z.string().min(1, "Choisissez une catégorie."),
  summary: z.string().trim().min(5, "Une phrase : à quoi sert cette recette ?").max(300),
  body: z.string().trim().min(10, "Les étapes, même courtes.").max(20000),
  url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^https:\/\//.test(v)) ctx.addIssue({ code: "custom", message: "Lien https:// uniquement." });
      return v;
    }),
});

export async function saveRecipeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { id, ...input } = parsed.data;
  const result = await saveRecipe(id || null, input, user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/recettes");
  redirect(`/recettes/${result.data.id}`);
}

export async function archiveRecipeAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const result = await archiveRecipe(id, user);
  if (result.ok) {
    revalidatePath("/recettes");
    redirect("/recettes");
  }
}

export async function markUsedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      id: z.string().min(1),
      note: z
        .string()
        .trim()
        .max(300)
        .optional()
        .transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Message trop long." };
  const result = await markRecipeUsed(parsed.data.id, parsed.data.note, user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(`/recettes/${parsed.data.id}`);
  return { status: "success", message: "Merci : l'auteur est prévenu." };
}
