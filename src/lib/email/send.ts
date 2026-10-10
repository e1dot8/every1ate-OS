import "server-only";
import { getDb } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; text: string };

/**
 * Envoie un e-mail transactionnel.
 * - resend : envoi réel via l'API Resend (clé uniquement côté serveur) ;
 * - outbox : stockage en base pour le développement et les tests, rien ne part.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getServerEnv();
  if (env.emailTransport === "outbox") {
    await getDb().emailOutbox.create({ data: message });
    if (env.NODE_ENV === "development") {
      console.info(`[email:outbox] → ${message.to} · ${message.subject}\n${message.text}`);
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Le corps de réponse peut contenir des détails utiles, jamais la clé.
    throw new Error(`Envoi d'e-mail refusé par Resend (${response.status}) : ${await response.text()}`);
  }
}
