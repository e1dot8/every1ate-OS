import type { Config } from "@netlify/functions";

/**
 * Tâche planifiée quotidienne : vérifie que l'application et la base répondent.
 * Démontre l'exécution planifiée fiable (escalades, alertes : lots suivants).
 * Un échec apparaît dans les logs de fonctions Netlify ; l'alerte e-mail arrive avec Resend.
 */
export default async function dailyHealthCheck() {
  const baseUrl = process.env.URL;
  if (!baseUrl) {
    console.error("[daily-health-check] variable URL absente");
    return new Response("missing URL", { status: 500 });
  }

  const response = await fetch(new URL("/api/health", baseUrl), { cache: "no-store" });
  const body = await response.text();
  if (!response.ok) {
    console.error(`[daily-health-check] état dégradé (${response.status}) : ${body}`);
    return new Response("degraded", { status: 500 });
  }
  console.log(`[daily-health-check] ok : ${body}`);
  return new Response("ok");
}

export const config: Config = {
  schedule: "0 6 * * *", // 06:00 UTC chaque jour
};
