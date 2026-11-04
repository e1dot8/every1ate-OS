import { expect, test } from "@playwright/test";
import { auditActions, withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";
import { createDeliverable, expectNoHorizontalScroll, parisDay, tag } from "./support/deliverables";

const currentStep = (page: import("@playwright/test").Page) =>
  page.getByRole("list", { name: "Étapes du livrable" }).locator('[aria-current="step"]');

test.describe("livrables", () => {
  test("checklist type ; cocher toute l'étape fait passer à la suivante et prévient l'équipe", async ({
    page,
    browser,
  }) => {
    // Long parcours à deux associés ; la base de test accumule des centaines d'associés.
    test.slow();
    // Un deuxième associé, destinataire des notifications.
    const other = await browser.newContext();
    const pierre = await activateAssociate(await other.newPage(), "Pierre");
    await other.close();

    await activateAssociate(page, "Johan");
    const projectId = await createProjectFromTemplate(page, `Campagne livrables ${tag()}`, "Projet vierge");
    const title = `Post lancement ${tag()}`;
    const id = await createDeliverable(page, { projectId, title, format: "POST" });

    // La checklist type du format est copiée ; l'étape courante est ouverte.
    await expect(currentStep(page)).toContainText("Préparation");
    const prep = page.getByRole("list", { name: "Checklist Préparation" });
    await expect(prep.getByRole("checkbox")).toHaveCount(3);
    await expect(prep.getByRole("checkbox", { name: "Brief validé avec le client" })).toBeVisible();

    for (let i = 1; i <= 3; i++) {
      await prep.getByRole("checkbox", { checked: false }).first().click();
      if (i < 3) {
        await expect(prep.locator('[aria-busy="true"]')).toHaveCount(0);
        await expect(prep.getByRole("checkbox", { checked: true })).toHaveCount(i);
      }
    }
    // Dernier point coché : passage automatique en Création.
    await expect(currentStep(page)).toContainText("Création");
    await expect(page.getByRole("list", { name: "Checklist Création" })).toBeVisible();
    await expect(page.getByText("passage automatique en Création")).toBeVisible();
    await expect(page.getByText(/a coché « Brief validé avec le client »/)).toBeVisible();

    const stage = await withDb(
      async (c) => (await c.query(`select stage from deliverable where id = $1`, [id])).rows[0].stage,
    );
    expect(stage).toBe("CREATION");
    const keys = await withDb(async (c) =>
      (
        await c.query(
          `select n."dedupeKey" from notification n join "user" u on u.id = n."userId" where u.email = $1 and n.href = $2`,
          [pierre.email, `/livrables/${id}`],
        )
      ).rows.map((r: { dedupeKey: string }) => r.dedupeKey),
    );
    expect(keys).toContain(`livrable-etape:${id}:CREATION`);
    expect(keys.filter((k: string) => k.startsWith("livrable-coche:"))).toHaveLength(3);

    // Ajouter puis supprimer un point de l'étape courante.
    await page.getByLabel("Nouveau point (Création)").fill("Validation juridique");
    await page.getByRole("button", { name: "Ajouter à Création" }).click();
    const creation = page.getByRole("list", { name: "Checklist Création" });
    await expect(creation.getByRole("checkbox", { name: "Validation juridique" })).toBeVisible();
    await page.locator("summary", { hasText: "Options de « Validation juridique »" }).click();
    await page.getByRole("button", { name: "Supprimer" }).click();
    await expect(creation.getByRole("checkbox", { name: "Validation juridique" })).toHaveCount(0);

    // Reculer à la main reste possible.
    await page.getByRole("button", { name: "Passer à l'étape Préparation" }).click();
    await expect(currentStep(page)).toContainText("Préparation");
    await expectNoHorizontalScroll(page);
  });

  test("bloquer exige un motif, débloquer en un clic", async ({ page }) => {
    const { email } = await activateAssociate(page, "Johan");
    const projectId = await createProjectFromTemplate(page, `Clip ${tag()}`, "Projet vierge");
    const id = await createDeliverable(page, { projectId, title: `Clip final ${tag()}`, format: "VIDEO" });

    await page.getByText("Signaler un blocage").click();
    await page.getByLabel("Motif du blocage").fill("ab");
    await page.getByRole("button", { name: "Bloquer le livrable" }).click();
    await expect(page.getByText("Indiquez le motif du blocage (3 caractères minimum).")).toBeVisible();

    await page.getByLabel("Motif du blocage").fill("Attente des rushes client");
    await page.getByRole("button", { name: "Bloquer le livrable" }).click();
    await expect(page.getByText("Attente des rushes client").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Débloquer" })).toBeVisible();

    // Le tableau signale le blocage.
    await page.goto(`/livrables?projet=${projectId}`);
    await expect(page.getByRole("link", { name: "Bloqués : 1" })).toBeVisible();
    await page.goto(`/livrables/${id}`);

    await page.getByRole("button", { name: "Débloquer" }).click();
    await expect(page.getByRole("button", { name: "Débloquer" })).toHaveCount(0);
    await expect(page.getByText("Signaler un blocage")).toBeVisible();
    expect(await auditActions({ actorEmail: email })).toEqual(
      expect.arrayContaining(["deliverable.created", "deliverable.blocked", "deliverable.unblocked"]),
    );
  });

  test("vues tableau, table et calendrier, sans débordement horizontal", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const projectId = await createProjectFromTemplate(page, `Lookbook ${tag()}`, "Projet vierge");
    const soon = `Carrousel collection ${tag()}`;
    const late = `Reel coulisses ${tag()}`;
    await createDeliverable(page, {
      projectId,
      title: soon,
      format: "CAROUSEL",
      dueDate: parisDay(3),
      publishDate: parisDay(10),
    });
    await createDeliverable(page, { projectId, title: late, format: "REEL", dueDate: parisDay(-2) });

    // Tableau (vue par défaut) : une colonne par étape.
    await page.goto(`/livrables?projet=${projectId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Livrables" })).toBeVisible();
    const preparation = page.getByRole("region", { name: /^Préparation/ });
    await expect(preparation.getByRole("link", { name: soon })).toBeVisible();
    await expect(preparation.getByRole("link", { name: late })).toBeVisible();
    await expect(page.getByRole("link", { name: "En retard : 1" })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Le chiffre « En retard » filtre la base.
    await page.getByRole("link", { name: "En retard : 1" }).click();
    await expect(page).toHaveURL(/retard=1/);
    await expect(page.getByRole("link", { name: late })).toBeVisible();
    await expect(page.getByRole("link", { name: soon })).toHaveCount(0);

    // Table triée par échéance : le retard d'abord.
    await page.goto(`/livrables?vue=table&projet=${projectId}`);
    const rows = page.getByRole("table").getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText(late);
    await expect(rows.nth(1)).toContainText("En retard");
    await expect(rows.nth(2)).toContainText(soon);
    await expectNoHorizontalScroll(page);

    // Calendrier : « En retard », puis échéances et publications par semaine.
    await page.goto(`/livrables?vue=calendrier&projet=${projectId}`);
    await expect(
      page.getByRole("region", { name: /^En retard/ }).getByRole("link", { name: late }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: soon })).toHaveCount(2);
    await expect(page.getByText(/^Publication ·/)).toHaveCount(1);
    await expectNoHorizontalScroll(page);
  });

  test("onglet Livrables du projet et création depuis le projet", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const projectId = await createProjectFromTemplate(page, `Campagne été ${tag()}`, "Projet vierge");
    const title = `Vidéo manifeste ${tag()}`;
    await createDeliverable(page, { projectId, title, format: "VIDEO" });

    await page.goto(`/projets/${projectId}?onglet=livrables`);
    await expect(
      page.getByRole("list", { name: "Livrables en Préparation" }).getByRole("link", { name: title }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Nouveau livrable" }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(new RegExp(`/livrables/nouveau\\?projet=${projectId}`));
    await expect(page.getByLabel("Projet", { exact: true })).toHaveValue(projectId);
  });
});
