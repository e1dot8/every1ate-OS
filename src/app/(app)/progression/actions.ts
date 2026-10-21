"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { reverseXp } from "@/features/progression/service";

const schema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(3, "Indiquez la raison de la correction.").max(300),
});

export async function reverseXpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const result = await reverseXp(parsed.data.id, parsed.data.reason, user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath("/progression");
  revalidatePath("/");
  return { status: "success", message: "Attribution corrigée." };
}
