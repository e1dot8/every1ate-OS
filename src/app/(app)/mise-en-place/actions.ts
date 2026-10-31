"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { saveDailyBriefing } from "@/features/briefing/service";
import { MAX_PRIORITIES, setDayPriorities } from "@/features/cockpit/service";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const schema = z.object({
  mood: z
    .enum(["EN_FORME", "NORMAL", "CHARGE_ELEVEE", "BESOIN_ALLEGER", ""])
    .optional()
    .transform((v) => v || null),
  moodShared: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  blocker: text(500),
  helpWanted: z
    .string()
    .optional()
    .transform((v) => v === "on"),
  personalGoal: text(300),
  plannedMinutes: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60)
    .optional(),
});

export async function saveDailyBriefingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Vérifiez les champs." };
  // Priorités suggérées confirmées par le briefing (sans choix préalable).
  const confirm = formData.getAll("confirmTaskIds").map(String).slice(0, MAX_PRIORITIES);
  if (confirm.length) {
    const set = await setDayPriorities(user.id, confirm);
    if (!set.ok) return { status: "error", message: set.error };
  }
  const { plannedMinutes, ...rest } = parsed.data;
  await saveDailyBriefing(user, { ...rest, plannedMinutes: plannedMinutes ?? null });
  revalidatePath("/");
  revalidatePath("/mise-en-place");
  redirect("/mise-en-place?fait=1");
}
