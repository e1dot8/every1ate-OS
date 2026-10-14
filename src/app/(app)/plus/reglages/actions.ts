"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DigestFrequency } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { parseMoney } from "@/lib/money";
import { saveAgencySettings, saveAssociateSettings, saveDigestPreference } from "@/features/settings/service";

const rate = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v?.trim()) return null;
    const cents = parseMoney(v);
    if (cents == null || cents > 100000)
      ctx.addIssue({ code: "custom", message: "Taux horaire invalide (ex. 45 ou 52,50)." });
    return cents;
  });
const hours = (required: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) {
        if (required) ctx.addIssue({ code: "custom", message: "Indiquez un nombre d'heures." });
        return null;
      }
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 80)
        ctx.addIssue({ code: "custom", message: "Entre 1 et 80 heures." });
      return n;
    });

const fail = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});

export async function saveAgencyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ defaultHourlyCost: rate, defaultWeeklyHours: hours(true) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await saveAgencySettings(
    {
      defaultHourlyCostCents: parsed.data.defaultHourlyCost,
      defaultWeeklyHours: parsed.data.defaultWeeklyHours!,
    },
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/", "layout");
  return { status: "success", message: "Réglages de l'agence enregistrés." };
}

export async function saveAssociateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ userId: z.string().min(1), hourlyCost: rate, weeklyHours: hours(false) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await saveAssociateSettings(
    {
      userId: parsed.data.userId,
      hourlyCostCents: parsed.data.hourlyCost,
      weeklyCapacityHours: parsed.data.weeklyHours,
    },
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath("/", "layout");
  return { status: "success", message: "Enregistré." };
}

export async function saveDigestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ frequency: z.enum(["AUCUN", "QUOTIDIEN", "HEBDOMADAIRE"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  await saveDigestPreference(parsed.data.frequency as DigestFrequency, user);
  revalidatePath("/plus/reglages");
  return {
    status: "success",
    message: parsed.data.frequency === "AUCUN" ? "Récapitulatif désactivé." : "Récapitulatif activé.",
  };
}
