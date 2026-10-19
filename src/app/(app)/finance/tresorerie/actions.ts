"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ChargeFrequency } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth/session";
import { parseDateInput, todayDate } from "@/lib/dates";
import { keptValues, validationError, type FormState } from "@/lib/forms";
import { parseMoney } from "@/lib/money";
import { CHARGE_FREQUENCIES, parseSignedMoney } from "@/features/finance/treasury-rules";
import { archiveCharge, saveCharge } from "@/features/finance/treasury";
import { saveCashBalance } from "@/features/settings/service";

const PATH = "/finance/tresorerie";

const fail = (error: string, formData: FormData): FormState => ({
  status: "error",
  message: error,
  values: keptValues(formData),
});
const text = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const date = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = parseDateInput(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Date invalide." });
    return d;
  });
const requiredDate = (message: string) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      const d = parseDateInput(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return d;
    });

// ─── Solde bancaire ─────────────────────────────────────────────────────────

const balanceSchema = z.object({
  balance: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) {
        ctx.addIssue({ code: "custom", message: "Indiquez le solde du compte." });
        return z.NEVER;
      }
      const cents = parseSignedMoney(v);
      if (cents == null) {
        ctx.addIssue({ code: "custom", message: "Montant invalide (ex. 24 500,00 ou -1 200)." });
        return z.NEVER;
      }
      return cents;
    }),
  balanceDate: requiredDate("Indiquez la date du solde.").refine((d) => d <= todayDate(), {
    message: "La date du solde ne peut pas être dans le futur.",
  }),
});

export async function saveCashBalanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = balanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const result = await saveCashBalance(
    { balanceCents: parsed.data.balance, date: parsed.data.balanceDate },
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(PATH);
  return { status: "success", message: "Solde bancaire enregistré." };
}

// ─── Charges fixes ──────────────────────────────────────────────────────────

const chargeSchema = z
  .object({
    chargeId: z.string().optional(),
    label: z.string().trim().min(1, "Libellé requis.").max(200),
    category: text(100),
    amount: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v?.trim()) {
          ctx.addIssue({ code: "custom", message: "Montant requis." });
          return z.NEVER;
        }
        const cents = parseMoney(v);
        if (cents == null) {
          ctx.addIssue({ code: "custom", message: "Montant invalide (ex. 1 250,00)." });
          return z.NEVER;
        }
        if (cents <= 0) {
          ctx.addIssue({ code: "custom", message: "Le montant doit être supérieur à 0." });
          return z.NEVER;
        }
        return cents;
      }),
    frequency: z.enum(CHARGE_FREQUENCIES, { error: "Choisissez la fréquence." }),
    nextDate: requiredDate("Indiquez la prochaine échéance."),
    endDate: date,
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.nextDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fin ne peut pas précéder la prochaine échéance.",
      });
  });

export async function saveChargeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = chargeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error, formData);
  const { chargeId, frequency, ...rest } = parsed.data;
  const result = await saveCharge(
    chargeId || null,
    { ...rest, frequency: frequency as ChargeFrequency },
    user,
  );
  if (!result.ok) return fail(result.error, formData);
  revalidatePath(PATH);
  redirect(PATH);
}

export async function archiveChargeAction(formData: FormData) {
  const user = await requireUser();
  const result = await archiveCharge(String(formData.get("chargeId") ?? ""), user);
  if (result.ok) {
    revalidatePath(PATH);
    redirect(PATH);
  }
}
