import { expect, type Page } from "@playwright/test";

/** Suffixe unique : la base de test est partagée entre les tests. */
export const tag = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Date calendrier (AAAA-MM-JJ) à Paris, décalée de `days` jours. */
export function parisDay(days = 0): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Crée un livrable via le vrai formulaire et retourne son identifiant (la page du livrable est ouverte). */
export async function createDeliverable(
  page: Page,
  input: {
    projectId: string;
    title: string;
    format?: string;
    dueDate?: string;
    publishDate?: string;
  },
): Promise<string> {
  await page.goto(`/livrables/nouveau?projet=${input.projectId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Nouveau livrable" })).toBeVisible();
  await expect(page.getByLabel("Projet", { exact: true })).toHaveValue(input.projectId);
  await page.getByLabel("Titre", { exact: true }).fill(input.title);
  await page.getByLabel("Format", { exact: true }).selectOption(input.format ?? "POST");
  if (input.dueDate) await page.getByLabel("Échéance (livraison au client)").fill(input.dueDate);
  if (input.publishDate) await page.getByLabel("Date de publication").fill(input.publishDate);
  await page.getByRole("button", { name: "Créer le livrable" }).click();
  await expect(page.getByRole("heading", { level: 1, name: input.title })).toBeVisible({ timeout: 15_000 });
  return page.url().split("/livrables/")[1].split(/[?#]/)[0];
}

/** Aucun défilement horizontal de la page (les conteneurs défilants internes sont permis). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
