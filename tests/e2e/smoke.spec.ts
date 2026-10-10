import { expect, test } from "@playwright/test";
import { activateAssociate } from "./support/flows";

test.describe("socle public", () => {
  test("une page protégée redirige vers la connexion", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Connexion");
  });

  test("aucun défilement horizontal sur la connexion", async ({ page }) => {
    await page.goto("/connexion");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("le bouton de connexion respecte la cible tactile de 44px", async ({ page }) => {
    await page.goto("/connexion");
    const box = await page.getByRole("button", { name: "Se connecter" }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("le lien d'évitement est utilisable au clavier", async ({ page, isMobile }) => {
    test.skip(isMobile, "navigation clavier testée sur ordinateur");
    await page.goto("/connexion");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
  });
});

test.describe("socle connecté", () => {
  test("navigation : sections livrées actives, sections futures désactivées", async ({ page }) => {
    await activateAssociate(page);
    const nav = page.getByRole("navigation", { name: "Navigation principale" }).filter({ visible: true });
    await expect(nav.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
    for (const label of ["Tâches", "Projets", "Plus"])
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    for (const label of ["CRM"]) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
      await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("la page design system s'affiche pour un associé", async ({ page }) => {
    await activateAssociate(page);
    await page.goto("/design");
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
  });
});

test.describe("API et configuration", () => {
  test("/api/health confirme la base et n'est pas mis en cache", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toMatchObject({ status: "ok", checks: { database: "up" } });
  });

  test("le manifeste PWA est valide", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: "Every1.ate OS", display: "standalone", start_url: "/" });
    for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  });

  test("les en-têtes de sécurité et de non-indexation sont présents", async ({ request }) => {
    const headers = (await request.get("/connexion")).headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
