"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput } from "@/lib/dates";
import type { FormState } from "@/lib/forms";
import { savePreferences, toggleStreakPause } from "@/features/badges/service";

const on = z
  .string()
  .optional()
  .transform((v) => v === "on");

export async function savePreferencesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      celebrations: on,
      streakEnabled: on,
      badgesPublic: on,
      streakDays: z.coerce.number().int().min(2, "Entre 2 et 5 jours.").max(5, "Entre 2 et 5 jours."),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  await savePreferences(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { status: "success", message: "Préférences enregistrées." };
}

export async function toggleStreakPauseAction(formData: FormData) {
  const user = await requireUser();
  const week = parseDateInput(String(formData.get("weekStart") ?? ""));
  if (week) await toggleStreakPause(user.id, week);
  revalidatePath("/", "layout");
}
