import { expect, type Page } from "@playwright/test";
import { insertInvitation, uniqueEmail } from "./db";

export const STRONG_PASSWORD = "Recette-Cuisson-2026!";

/** Crée un associé de test via le vrai parcours d'invitation, puis le laisse connecté. */
export async function activateAssociate(
  page: Page,
  name = "Camille",
): Promise<{ email: string; password: string }> {
  const email = uniqueEmail(name.toLowerCase());
  const token = await insertInvitation(email, name);
  await page.goto(`/invitation/${token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Bienvenue, ${name}`);
  await page.getByLabel("Nouveau mot de passe").fill(STRONG_PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(STRONG_PASSWORD);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Bonjour ${name}`);
  return { email, password: STRONG_PASSWORD };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

export async function signOut(page: Page) {
  await page.goto("/plus");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
}
