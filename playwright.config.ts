import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
// Permet d'utiliser un Chromium déjà installé (ex. environnement sans téléchargement).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
// Secret de test pour /api/cron/scan (jamais utilisé hors tests).
const E2E_CRON_SECRET = "e2e-only-cron-secret-0123456789abcdef";
// Clés VAPID générées pour les tests uniquement (`web-push generate-vapid-keys`) ; en mode outbox,
// rien n'est envoyé. Ne jamais les réutiliser ailleurs.
const E2E_VAPID_PUBLIC_KEY =
  "BBmc6J7BEcRI9lLjk-FHHB9wro6bL1d9V5JKpq40NB1Ocf5ogrvsPCWFy3PjStuhVAf3htIOC12Bhmv4J84Fz-o";
const E2E_VAPID_PRIVATE_KEY = "mN78EGGwXA1DhLvPPQaSXJzfyxBC1TH_zbsdtP2Y144";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 45_000,
  // Actions serveur + rafraîchissement sous 4 navigateurs en parallèle : 5 s par défaut est trop
  // juste depuis que chaque action déclenche aussi notifications et messages de salon (V1.2).
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", launchOptions: { executablePath } },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  // Sert le build de production (lancer `pnpm build` avant) sauf si une URL distante est fournie.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm start --port ${port}`,
        url: `${baseURL}/api/health`,
        // Jamais de réutilisation : un serveur déjà lancé n'aurait pas la configuration de test.
        reuseExistingServer: false,
        timeout: 60_000,
        // Configuration de test : e-mails stockés localement, aucun appel réseau externe.
        env: {
          APP_URL: baseURL,
          BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "e2e-only-secret-0123456789abcdef0123456789",
          EMAIL_TRANSPORT: "outbox",
          PASSWORD_BREACH_CHECK: "off",
          CRON_SECRET: E2E_CRON_SECRET,
          // Alertes : journalisées dans external_delivery, aucun appel aux services push ni à CallMeBot.
          PUSH_TRANSPORT: "outbox",
          WHATSAPP_TRANSPORT: "outbox",
          VAPID_PUBLIC_KEY: E2E_VAPID_PUBLIC_KEY,
          VAPID_PRIVATE_KEY: E2E_VAPID_PRIVATE_KEY,
          VAPID_SUBJECT: "mailto:e2e@example.test",
        },
      },
});
