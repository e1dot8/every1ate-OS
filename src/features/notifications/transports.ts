import "server-only";
import type { ServerEnv } from "@/lib/env";
import {
  PUSH_TTL_SECONDS,
  buildCallMeBotUrl,
  shortError,
  type PushMessage,
} from "@/features/notifications/external-rules";

/**
 * Transports réels des alertes. Ne lèvent jamais : chaque envoi renvoie un résultat
 * (succès, échec avec message court sans secret, abonnement expiré).
 */
export type SendOutcome = { ok: true } | { ok: false; error: string; gone?: boolean };

export const SEND_TIMEOUT_MS = 8_000;

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

const isTimeout = (error: unknown) =>
  error instanceof Error &&
  (error.name === "TimeoutError" || error.name === "AbortError" || /timeout/i.test(error.message));

/** Web Push (VAPID) vers un abonnement. 404/410 : l'abonnement n'existe plus. */
export async function sendWebPush(
  env: Pick<ServerEnv, "VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY" | "vapidSubject">,
  target: PushTarget,
  message: PushMessage,
  urgent = false,
): Promise<SendOutcome> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { ok: false, error: "Clés VAPID absentes." };
  try {
    const { sendNotification } = await import("web-push");
    await sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      {
        vapidDetails: {
          subject: env.vapidSubject,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
        TTL: PUSH_TTL_SECONDS,
        urgency: urgent ? "high" : "normal",
        timeout: SEND_TIMEOUT_MS,
      },
    );
    return { ok: true };
  } catch (error) {
    const status = (error as { statusCode?: unknown }).statusCode;
    if (status === 404 || status === 410)
      return { ok: false, gone: true, error: "Abonnement expiré : appareil retiré." };
    if (typeof status === "number") return { ok: false, error: `Service push : HTTP ${status}.` };
    if (isTimeout(error)) return { ok: false, error: "Service push : délai dépassé." };
    // Les erreurs de chiffrement (clés d'abonnement invalides) ont un message sans secret.
    if (error instanceof Error && /p256dh|auth|subscription/i.test(error.message))
      return { ok: false, error: shortError(`Abonnement invalide : ${error.message}`) };
    return { ok: false, error: "Service push injoignable." };
  }
}

/**
 * WhatsApp via CallMeBot (gratuit, usage personnel). L'URL contient la clé :
 * elle n'apparaît dans aucun message d'erreur ni journal.
 */
export async function sendCallMeBot(
  input: { phone: string; apikey: string; text: string },
  fetcher: typeof fetch = fetch,
): Promise<SendOutcome> {
  try {
    const response = await fetcher(buildCallMeBotUrl(input), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const text = await response.text().catch(() => "");
    if (!response.ok) return { ok: false, error: `CallMeBot : HTTP ${response.status}.` };
    // CallMeBot répond parfois 200 avec une page d'erreur (clé ou numéro refusés).
    if (/invalid|not allowed|error/i.test(text) && !/queued|sent/i.test(text))
      return { ok: false, error: "CallMeBot : clé API ou numéro refusés." };
    return { ok: true };
  } catch (error) {
    if (isTimeout(error)) return { ok: false, error: "CallMeBot : délai dépassé (8 s)." };
    return { ok: false, error: "CallMeBot injoignable." };
  }
}
