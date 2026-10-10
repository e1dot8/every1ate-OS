import { expect, test } from "@playwright/test";

test.describe("socle lot 0", () => {
  test("l'accueil se charge et affiche l'état réel de la base", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("se met en place");
    await expect(page.getByTestId("db-status")).toContainText("Connectée");
  });

  test("aucun défilement horizontal", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("la navigation principale est accessible et n'active que les sections livrées", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Navigation principale" }).filter({ visible: true });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
    for (const label of ["Tâches", "Projets", "CRM", "Plus"]) {
      const entry = nav.getByText(label, { exact: true });
      await expect(entry).toBeVisible();
      await expect(nav.getByRole("link", { name: label })).toHaveCount(0);
    }
  });

  test("les cibles tactiles de la navigation font au moins 44px", async ({ page }) => {
    await page.goto("/");
    const link = page
      .getByRole("navigation", { name: "Navigation principale" })
      .filter({ visible: true })
      .getByRole("link", { name: "Accueil" });
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("le lien d'évitement est utilisable au clavier", async ({ page, isMobile }) => {
    test.skip(isMobile, "navigation clavier testée sur ordinateur");
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
  });

  test("la page design system s'affiche", async ({ page }) => {
    await page.goto("/design");
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
    await expect(page.getByText("Bloqué")).toBeVisible();
  });
});

test.describe("API et configuration", () => {
  test("/api/health confirme la base et n'est pas mis en cache", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", checks: { database: "up" } });
  });

  test("le manifeste PWA est valide", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({ name: "Every1.ate OS", display: "standalone", start_url: "/" });
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).ok()).toBe(true);
    }
  });

  test("les en-têtes de sécurité et de non-indexation sont présents", async ({ request }) => {
    const headers = (await request.get("/")).headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-robots-tag"]).toContain("noindex");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});
