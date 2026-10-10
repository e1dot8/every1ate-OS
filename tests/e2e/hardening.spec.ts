import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate, signOut } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

test.describe("PWA et cache", () => {
  test("aucune page privée en cache ; déconnexion : caches purgés et retour arrière protégé", async ({
    page,
  }) => {
    await activateAssociate(page, "Johan");
    const res = await page.goto("/finance");
    expect(res!.headers()["cache-control"]).toMatch(/no-store|private/);
    await page.goto("/");
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()));
    await page.reload();
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const key of await caches.keys())
        for (const req of await (await caches.open(key)).keys()) urls.push(new URL(req.url).pathname);
      return urls;
    });
    expect(cached.length).toBeGreaterThan(0);
    for (const path of cached)
      expect(path).toMatch(/^\/(_next\/static\/|icons\/|brand\/|icon\.png|apple-icon\.png|hors-ligne\.html)/);

    await signOut(page);
    await expect.poll(async () => page.evaluate(async () => (await caches.keys()).length)).toBe(0);
    await page.goBack();
    await expect(page).toHaveURL(/\/connexion/);
    await page.goto("/finance");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("hors ligne : état affiché, aucun envoi silencieux, retour en ligne signalé", async ({
    page,
    context,
  }) => {
    await activateAssociate(page, "Pierre");
    const id = await createProjectFromTemplate(page, "Hors ligne");
    const taskId = await withDb(
      async (c) => (await c.query(`select id from task where "projectId"=$1 limit 1`, [id])).rows[0].id,
    );
    await page.goto(`/taches/${taskId}`);
    await page.getByLabel("Ajouter un commentaire").fill("Écrit sans réseau");
    await context.setOffline(true);
    await expect(page.getByText("Hors ligne : les données affichées peuvent être obsolètes.")).toBeVisible();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(
      page.getByText("Hors ligne : rien n'a été enregistré. Réessayez une fois reconnecté."),
    ).toBeVisible();
    const count = await withDb(
      async (c) =>
        (await c.query(`select count(*)::int n from task_comment where "taskId"=$1`, [taskId])).rows[0].n,
    );
    expect(count).toBe(0);
    await context.setOffline(false);
    await expect(page.getByText("Connexion rétablie : données actualisées.")).toBeVisible();
  });

  test("manifeste installable et page hors ligne", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ display: "standalone", start_url: "/", lang: "fr" });
    expect(manifest.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
    expect((await request.get("/hors-ligne.html")).status()).toBe(200);
    expect((await request.get("/sw.js")).headers()["cache-control"]).toContain("no-store");
  });
});

test.describe("sécurité", () => {
  test("accès direct à la ressource d'un autre associé refusé", async ({ page, browser }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Ressource privée");
    const taskId = await withDb(
      async (c) => (await c.query(`select id from task where "projectId"=$1 limit 1`, [id])).rows[0].id,
    );
    await page.goto(`/taches/${taskId}`);
    await page.getByText("Saisir du temps manuellement").click();
    await page.getByLabel("Durée").fill("1h");
    await page.getByRole("button", { name: "Ajouter le temps" }).click();
    await expect(page.getByText("Temps ajouté.")).toBeVisible();
    const entryId = await withDb(
      async (c) => (await c.query(`select id from time_entry where "taskId"=$1`, [taskId])).rows[0].id,
    );

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await activateAssociate(p2, "Charles");
    // Rendu en flux : le statut HTTP est déjà parti, mais le contenu est la page « introuvable ».
    await p2.goto(`/temps/${entryId}`);
    await expect(p2.getByRole("heading", { name: "Corriger une saisie" })).toHaveCount(0);
    await expect(p2.getByText(/introuvable/i).first()).toBeVisible();
    await other.close();
  });

  test("pas d'escalade de privilège via l'API d'authentification", async ({ page, baseURL }) => {
    const { email } = await activateAssociate(page, "Camille");
    const res = await page.request.post("/api/auth/update-user", {
      data: { name: "Camille", role: "admin" },
      headers: { Origin: baseURL! },
    });
    expect(res.status()).toBeLessThan(500);
    const role = await withDb(
      async (c) => (await c.query(`select role from "user" where email=$1`, [email])).rows[0].role,
    );
    expect(role).toBe("associe");
  });

  test("CSRF : une origine étrangère est refusée par l'API d'authentification", async ({ request }) => {
    const res = await request.post("/api/auth/sign-in/email", {
      data: {
        email: `csrf.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.test`,
        password: "Nimporte-quoi-2026!",
      },
      // IP distincte : le limiteur de débit (partagé par les tests) ne masque pas le contrôle d'origine.
      headers: {
        Origin: "https://attaquant.example",
        "X-Forwarded-For": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.7`,
      },
    });
    expect(res.status()).toBe(403);
  });

  test("XSS : un titre piégé reste du texte", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const id = await createProjectFromTemplate(page, "Projet XSS", "Projet vierge");
    const payload = `<img src=x onerror="window.__xss=1">`;
    await page.goto(`/projets/${id}/taches/nouvelle`);
    await page.getByLabel("Titre").fill(payload);
    await page.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(payload);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("liens et fichiers : javascript: refusé, format et taille d'import contrôlés", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const id = await createProjectFromTemplate(page, "Projet fichiers", "Projet vierge");
    await page.goto(`/projets/${id}?onglet=documents`);
    await page.getByText("Ajouter un document").click();
    await page.getByLabel("Lien Google Drive (ou autre lien https)").fill("javascript:alert(1)");
    await page.getByLabel("Titre").fill("Piège");
    await page.getByRole("button", { name: "Ajouter le document" }).click();
    await expect(page.getByText("Seuls les liens https sont acceptés.")).toBeVisible();

    await page.goto("/finance/imports/nouveau");
    await page
      .getByLabel(/Fichier CSV ou Excel/)
      .setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await page.getByRole("button", { name: "Lire le fichier" }).click();
    await expect(page.getByText("Format non pris en charge : CSV ou Excel (.xlsx).")).toBeVisible();

    await page.getByLabel(/Fichier CSV ou Excel/).setInputFiles({
      name: "faux.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("pas un classeur"),
    });
    await page.getByRole("button", { name: "Lire le fichier" }).click();
    await expect(page.getByText(/Fichier illisible/)).toBeVisible();

    const big = Buffer.alloc(5 * 1024 * 1024 + 10, "a");
    await page
      .getByLabel(/Fichier CSV ou Excel/)
      .setInputFiles({ name: "gros.csv", mimeType: "text/csv", buffer: big });
    await page.getByRole("button", { name: "Lire le fichier" }).click();
    await expect(page.getByText("Fichier trop volumineux (5 Mo maximum).")).toBeVisible();
  });

  test("session expirée : retour à la connexion", async ({ page }) => {
    const { email } = await activateAssociate(page, "Camille");
    await withDb((c) =>
      c.query(
        `update session set "expiresAt" = now() - interval '1 minute' where "userId" = (select id from "user" where email=$1)`,
        [email],
      ),
    );
    await page.goto("/projets");
    await expect(page).toHaveURL(/\/connexion/);
  });

  test("aucun secret exposé ; en-têtes de sécurité présents", async ({ request }) => {
    for (const path of ["/.env", "/.env.local", "/.git/config", "/prisma/schema.prisma"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([307, 308, 404]).toContain(res.status());
      expect(await res.text()).not.toMatch(/DATABASE_URL|BETTER_AUTH_SECRET|\[core\]|generator client/);
    }
    const health = await request.get("/api/health");
    const text = await health.text();
    expect(text).not.toMatch(/postgres(ql)?:\/\/|BETTER_AUTH_SECRET|RESEND|CRON_SECRET/i);
    const headers = (await request.get("/connexion")).headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
  });
});
