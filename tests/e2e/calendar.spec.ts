import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
};

test.describe("calendrier", () => {
  test("événement en heure de Paris, conflit signalé, détails privés masqués aux autres", async ({
    page,
    browser,
  }) => {
    const pierre = await browser.newContext();
    const p2 = await pierre.newPage();
    await activateAssociate(p2, `Pierre${Date.now().toString(36)}`);
    const pierreName = (await p2.getByRole("heading", { level: 1 }).textContent())!.replace("Bonjour ", "");

    await activateAssociate(page, "Johan");
    const day = nextMonday();
    await page.goto("/calendrier/nouveau");
    await page.getByLabel("Titre").fill("Rendez-vous banque");
    await page.getByLabel("Début (heure de Paris)").fill(`${day}T10:00`);
    await page.getByLabel("Fin").fill(`${day}T11:00`);
    await page.getByRole("button", { name: "Créer l'événement" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Rendez-vous banque" })).toBeVisible();
    const id = page.url().split("/calendrier/")[1];
    const stored = await withDb(
      async (c) =>
        (await c.query(`select "startsAt" from calendar_event where id=$1`, [id])).rows[0].startsAt as Date,
    );
    // 10:00 à Paris = 08:00 ou 09:00 UTC selon l'heure d'été.
    expect([8, 9]).toContain(stored.getUTCHours());

    // Deuxième réunion qui chevauche, avec Pierre invité : conflit signalé, non bloquant.
    await page.goto("/calendrier/nouveau");
    await page.getByLabel("Titre").fill("Point client");
    await page.getByLabel("Début (heure de Paris)").fill(`${day}T10:30`);
    await page.getByLabel("Fin").fill(`${day}T11:30`);
    await page.getByLabel(pierreName).check();
    await page.getByRole("button", { name: "Créer l'événement" }).click();
    await expect(page.getByText("Enregistré, mais des conflits d'agenda existent.")).toBeVisible();
    await expect(page.getByText(/Rendez-vous banque ·/)).toBeVisible();

    // Pierre voit « Point client » (invité) mais seulement « Occupé » pour le rendez-vous privé.
    await p2.goto(`/calendrier?vue=semaine&date=${day}&equipe=1`);
    await expect(p2.getByRole("link", { name: /Point client/ }).first()).toBeVisible();
    await expect(p2.getByText("Rendez-vous banque")).toHaveCount(0);
    await expect(p2.getByText("Occupé").first()).toBeVisible();
    await p2.goto(`/calendrier/${id}`);
    await expect(p2.getByText("Créneau occupé")).toBeVisible();
    await expect(p2.getByText("Rendez-vous banque")).toHaveCount(0);
    await p2.goto("/notifications");
    await expect(p2.getByText(/vous invite : Point client/)).toBeVisible();
    await pierre.close();
  });

  test("modification concurrente : l'utilisateur choisit la version à conserver", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const day = nextMonday();
    await page.goto("/calendrier/nouveau");
    await page.getByLabel("Titre").fill("Atelier V1");
    await page.getByLabel("Début (heure de Paris)").fill(`${day}T14:00`);
    await page.getByLabel("Fin").fill(`${day}T15:00`);
    await page.getByRole("button", { name: "Créer l'événement" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Atelier V1" })).toBeVisible();
    const id = page.url().split("/calendrier/")[1];

    // Une autre session modifie l'événement entre-temps.
    await withDb((c) =>
      c.query(`update calendar_event set title='Atelier (autre version)', version=version+1 where id=$1`, [
        id,
      ]),
    );
    await page.getByLabel("Titre").fill("Atelier V2");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(
      page.getByText("Cet événement a été modifié entre-temps. Choisissez la version à conserver."),
    ).toBeVisible();
    await expect(page.getByText(/Atelier \(autre version\)/)).toBeVisible();
    await page.getByRole("button", { name: "Garder ma version" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Atelier V2" })).toBeVisible();
    const row = await withDb(
      async (c) => (await c.query(`select title, version from calendar_event where id=$1`, [id])).rows[0],
    );
    expect(row).toEqual({ title: "Atelier V2", version: 3 });
  });

  test("abonnement ICS personnel : lien secret, lecture seule, renouvelable", async ({ page, request }) => {
    await activateAssociate(page, "Johan");
    const day = nextMonday();
    await page.goto("/calendrier/nouveau");
    await page.getByLabel("Titre").fill("Brief, tournage; jour 1");
    await page.getByLabel("Début (heure de Paris)").fill(`${day}T09:00`);
    await page.getByLabel("Fin").fill(`${day}T10:00`);
    await page.getByRole("button", { name: "Créer l'événement" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Brief");

    await page.goto("/calendrier/abonnement");
    await page.getByRole("button", { name: "Créer mon lien d'abonnement" }).click();
    const url = await page.getByLabel("Lien d'abonnement ICS").inputValue();
    expect(url).toMatch(/\/api\/calendrier\/[\w-]{43}\.ics$/);
    const path = new URL(url).pathname;
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:Brief\\, tournage\; jour 1");

    // Le jeton n'est pas stocké en clair.
    const stored = await withDb(
      async (c) =>
        (
          await c.query(`select count(*)::int n from calendar_feed where "tokenHash" like $1`, [
            `%${path.split("/").pop()!.replace(".ics", "")}%`,
          ])
        ).rows[0].n,
    );
    expect(stored).toBe(0);

    await page.reload();
    await expect(page.getByTestId("feed-status")).toContainText("dernière lecture par votre agenda");
    await page.getByRole("button", { name: /Renouveler le lien/ }).click();
    await expect(page.getByLabel("Lien d'abonnement ICS")).toBeVisible();
    expect((await request.get(path)).status()).toBe(404);
    expect((await request.get("/api/calendrier/invalide.ics")).status()).toBe(404);
  });
});

test.describe("documents", () => {
  test("référence Google Drive rattachée au projet et à la tâche, doublon refusé, lien http refusé", async ({
    page,
  }) => {
    await activateAssociate(page, "Pierre");
    const id = await createProjectFromTemplate(page, "Docs clip", "Projet vierge");
    await page.goto(`/projets/${id}?onglet=documents`);
    await page.getByText("Ajouter un document").click();
    await page
      .getByLabel("Lien Google Drive (ou autre lien https)")
      .fill("http://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view");
    await page.getByLabel("Titre").fill("Brief créatif");
    await page.getByRole("button", { name: "Ajouter le document" }).click();
    await expect(page.getByText("Seuls les liens https sont acceptés.")).toBeVisible();
    await expect(page.getByLabel("Titre")).toHaveValue("Brief créatif");

    await page
      .getByLabel("Lien Google Drive (ou autre lien https)")
      .fill("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view");
    await page.getByRole("button", { name: "Ajouter le document" }).click();
    await expect(page.getByText("Document référencé.")).toBeVisible();
    const docs = page.getByRole("list", { name: "Documents rattachés" });
    await expect(docs.getByRole("link", { name: /Brief créatif/ })).toHaveAttribute(
      "href",
      /drive\.google\.com/,
    );
    await expect(docs).toContainText("Google Drive");

    await page
      .getByLabel("Lien Google Drive (ou autre lien https)")
      .fill("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/edit");
    await page.getByLabel("Titre").fill("Doublon");
    await page.getByRole("button", { name: "Ajouter le document" }).click();
    await expect(page.getByText(/déjà référencé ici/)).toBeVisible();

    await page.goto("/documents");
    await expect(page.getByRole("link", { name: /Brief créatif/ }).first()).toBeVisible();
  });
});
