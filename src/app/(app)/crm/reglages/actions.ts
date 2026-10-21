"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { validationError, type FormState } from "@/lib/forms";
import { saveThresholds } from "@/features/crm/situations-service";

const days = (max: number) =>
  z.coerce.number().int("Nombre entier.").min(1, "Au moins 1.").max(max, `${max} au plus.`);

const schema = z.object({
  silenceDays: days(365),
  paymentTermDays: days(180),
  billingHorizonDays: days(90),
  lowSatisfaction: z.coerce.number().int().min(1).max(4, "Entre 1 et 4."),
});

export async function saveThresholdsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  await saveThresholds(parsed.data, user);
  revalidatePath("/crm/cuisine");
  revalidatePath("/crm/reglages");
  return { status: "success", message: "Seuils enregistrés." };
}
