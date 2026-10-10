import { expect, type Page } from "@playwright/test";

/** Crée un projet via le vrai assistant et retourne son identifiant. */
export async function createProjectFromTemplate(page: Page, name: string, template = "Campagne créative") {
  await page.goto("/projets/nouveau");
  await page.getByRole("radio", { name: new RegExp(template) }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.getByLabel("Nom du projet").fill(name);
  await page.getByLabel("Date de début").fill("2026-11-02");
  await page.getByRole("button", { name: "Voir la structure" }).click();
  await expect(page.getByRole("heading", { name: "Structure du projet" })).toBeVisible();
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url().split("/projets/")[1].split("?")[0];
}
