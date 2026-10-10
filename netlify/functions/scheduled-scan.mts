import type { Config } from "@netlify/functions";

/**
 * Toutes les heures : retards, escalade après 48 h, recalcul des priorités non verrouillées.
 * La logique vit dans l'application (/api/cron/scan) ; cette fonction ne fait que l'appeler.
 * Coût : une requête courte par heure (négligeable en crédits Netlify).
 */
export default async function scheduledScan() {
  const baseUrl = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!baseUrl || !secret) {
    console.error("[scheduled-scan] URL ou CRON_SECRET absente");
    return new Response("missing configuration", { status: 500 });
  }
  const response = await fetch(new URL("/api/cron/scan", baseUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) {
    console.error(`[scheduled-scan] échec (${response.status}) : ${body}`);
    return new Response("failed", { status: 500 });
  }
  console.log(`[scheduled-scan] ok : ${body}`);
  return new Response("ok");
}

export const config: Config = {
  schedule: "@hourly",
};
