"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import {
  attachPushSubscriptionToSession,
  configureWhatsapp,
  removePushSubscription,
  removeWhatsapp,
  savePushSubscription,
  saveNotifyPrefs,
  sendTestAlert,
} from "@/features/notifications/alerts-service";
import {
  isAllowedPushEndpoint,
  isPlausibleApiKey,
  normalizePhone,
} from "@/features/notifications/external-rules";
import { prefsFromForm, recommendedPrefs } from "@/features/notifications/prefs";

const PATH = "/plus/alertes";

export type PushActionResult = { ok: boolean; message: string };

const endpointSchema = z
  .string()
  .max(2048)
  .refine(isAllowedPushEndpoint, { message: "Service de notification non reconnu." });

const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}={0,2}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}={0,2}$/),
  }),
});

/** Enregistre l'abonnement push de cet appareil (appelé après `pushManager.subscribe`). */
export async function subscribePushAction(input: unknown): Promise<PushActionResult> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Abonnement refusé : navigateur ou service de notification non reconnu." };
  const result = await savePushSubscription(
    { endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    (await headers()).get("user-agent"),
    user,
  );
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath(PATH);
  return { ok: true, message: "Notifications activées sur cet appareil." };
}

/**
 * Vrai si l'abonnement de ce navigateur est connu du serveur pour l'associé connecté ; il est
 * alors rattaché à la session en cours (les envois ne partent que vers une session valide).
 * Sans redirection : appelée en arrière-plan sur n'importe quelle page de l'application.
 */
export async function attachPushSessionAction(input: unknown): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || user.role !== "associe") return false;
  const parsed = z.object({ endpoint: z.string().min(1).max(2048) }).safeParse(input);
  if (!parsed.success) return false;
  return attachPushSubscriptionToSession(user.id, user.sessionId, parsed.data.endpoint);
}

export async function unsubscribePushAction(input: unknown): Promise<PushActionResult> {
  const user = await requireUser();
  const parsed = z.object({ endpoint: z.string().min(1).max(2048) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Appareil inconnu." };
  const result = await removePushSubscription({ endpoint: parsed.data.endpoint }, user);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath(PATH);
  return { ok: true, message: "Notifications désactivées sur cet appareil." };
}

/** Retire un appareil de la liste (ex. téléphone perdu ou remplacé). */
export async function removeDeviceAction(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({ deviceId: z.string().min(1).max(64) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await removePushSubscription({ id: parsed.data.deviceId }, user);
  revalidatePath(PATH);
}

export async function sendTestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ channel: z.enum(["push", "whatsapp"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Canal inconnu." };
  const result = await sendTestAlert(parsed.data.channel, user);
  revalidatePath(PATH);
  return result.ok ? { status: "success", message: result.data } : { status: "error", message: result.error };
}

const whatsappSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, { message: "Indiquez votre numéro WhatsApp." })
    .transform((value, ctx) => {
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "Format international attendu, ex. +33 6 12 34 56 78." });
        return z.NEVER;
      }
      return phone;
    }),
  apikey: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      if (!isPlausibleApiKey(value)) {
        ctx.addIssue({ code: "custom", message: "Clé API invalide : recopiez celle reçue de CallMeBot." });
        return z.NEVER;
      }
      return value;
    }),
});

export async function saveWhatsappAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const phoneInput = String(formData.get("phone") ?? "");
  const parsed = whatsappSchema.safeParse({
    phone: phoneInput,
    apikey: formData.get("apikey") ?? undefined,
  });
  // La clé n'est jamais renvoyée au navigateur, même après une erreur.
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return {
      status: "error",
      message: "Corrigez les champs signalés.",
      fieldErrors,
      values: { phone: phoneInput },
    };
  }
  const result = await configureWhatsapp(parsed.data, user);
  if (!result.ok)
    return {
      status: "error",
      message: result.error,
      fieldErrors: { apikey: result.error },
      values: { phone: phoneInput },
    };
  revalidatePath(PATH);
  return { status: "success", message: "WhatsApp enregistré. Envoyez-vous un test pour vérifier." };
}

export async function removeWhatsappAction(): Promise<FormState> {
  const user = await requireUser();
  const result = await removeWhatsapp(user);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(PATH);
  return { status: "success", message: "Numéro et clé WhatsApp supprimés." };
}

export async function savePrefsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const intent = z.enum(["save", "reset"]).catch("save").parse(formData.get("intent"));
  const prefs =
    intent === "reset" ? recommendedPrefs() : prefsFromForm((field) => formData.get(field) === "on");
  const result = await saveNotifyPrefs(prefs, user, intent === "reset" ? "Réglages recommandés" : undefined);
  if (!result.ok) return { status: "error", message: result.error };
  revalidatePath(PATH);
  return {
    status: "success",
    message: intent === "reset" ? "Réglages recommandés rétablis." : "Préférences enregistrées.",
  };
}
