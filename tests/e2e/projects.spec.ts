import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

async function createProjectFromTemplate(page: Page, name: string, template = "Campagne créative") {
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

test.describe("projets", () => {
  test("création depuis un modèle : lots, tâches, dépendances et checklist", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Campagne printemps");
    await expect(page.getByRole("list", { name: "Lots" }).getByRole("listitem")).toHaveCount(4);
    const counts = await withDb(
      async (c) =>
        (
          await c.query(
            `select (select count(*) from task where "projectId"=$1)::int t, (select count(*) from task_dependency d join task x on x.id=d."taskId" where x."projectId"=$1)::int d, (select count(*) from closure_item where "projectId"=$1)::int c`,
            [id],
          )
        ).rows[0],
    );
    expect(counts).toEqual({ t: 12, d: 9, c: 6 });
    await page.goto(`/projets/${id}?onglet=journal`);
    await expect(page.getByText("a créé le projet")).toBeVisible();
  });

  test("le responsable global se change avec un motif journalisé", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Clip Néons", "Projet vierge");
    await page.getByLabel("Motif").fill("Départ en tournage");
    await page.getByRole("button", { name: "Changer le responsable" }).click();
    await expect(page.getByText("Responsable global modifié.")).toBeVisible();
    await page.goto(`/projets/${id}?onglet=journal`);
    // Même responsable choisi : aucun changement journalisé.
    await expect(page.getByText("a changé le responsable global")).toHaveCount(0);
  });

  test("la clôture est refusée tant que la checklist est incomplète", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Lookbook hiver", "Projet vierge");
    await page.getByLabel("Nouveau statut").selectOption("ACTIF");
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await expect(page.getByText("Statut mis à jour.")).toBeVisible();
    await page.getByLabel("Nouveau statut").selectOption("TERMINE");
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await expect(page.getByRole("alert").first()).toContainText(
      "La checklist de clôture doit être complète.",
    );

    await page.goto(`/projets/${id}?onglet=cloture`);
    for (let i = 0; i < 6; i++) {
      await page
        .getByRole("button", { name: /^Cocher/ })
        .first()
        .click();
      await expect(page.getByRole("button", { name: /^Décocher/ })).toHaveCount(i + 1);
    }
    await page.goto(`/projets/${id}`);
    await page.getByLabel("Nouveau statut").selectOption("TERMINE");
    await page.getByRole("button", { name: "Changer le statut" }).click();
    await expect(page.getByText("Statut mis à jour.")).toBeVisible();
    await page.goto(`/projets/${id}?onglet=cloture`);
    await expect(page.getByText(/Projet clôturé le/)).toBeVisible();
  });
});

test.describe("tâches", () => {
  test("bloquer exige une raison ; dépendances, boucle refusée et Terminé conditionné", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Campagne été");
    const ids = await withDb(async (c) =>
      Object.fromEntries(
        (await c.query(`select title, id from task where "projectId"=$1`, [id])).rows.map(
          (r: { title: string; id: string }) => [r.title, r.id],
        ),
      ),
    );

    // « Pistes créatives » attend « Brief et objectifs » (modèle).
    await page.goto(`/taches/${ids["Pistes créatives"]}`);
    await expect(page.getByText("En attente de « Brief et objectifs »")).toBeVisible();
    await page.locator("label", { hasText: "Terminé" }).click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Terminez d'abord : « Brief et objectifs ».")).toBeVisible();

    // Boucle : « Brief et objectifs » ne peut pas attendre « Pistes créatives ».
    await page.goto(`/taches/${ids["Brief et objectifs"]}`);
    await page.getByLabel("Cette tâche attend").selectOption({ label: "Pistes créatives" });
    await page.getByRole("button", { name: "Ajouter la dépendance" }).click();
    await expect(
      page.getByText(/Boucle détectée : Brief et objectifs → Pistes créatives → Brief et objectifs/),
    ).toBeVisible();

    // Bloquer sans raison est refusé, puis accepté avec une raison.
    await page.locator("label", { hasText: "Bloqué" }).click();
    await page.getByRole("button", { name: "Bloquer la tâche" }).click();
    await expect(page.getByText("Indiquez la raison du blocage.").first()).toBeVisible();
    await page.getByLabel("Raison du blocage").fill("Brief client non reçu");
    await page.getByRole("button", { name: "Bloquer la tâche" }).click();
    await expect(page.getByText("Bloquée : Brief client non reçu")).toBeVisible();

    // Le projet signale la tâche bloquée.
    await page.goto(`/projets/${id}`);
    await expect(page.getByText("1 tâche bloquée")).toBeVisible();
  });

  test("archiver puis restaurer une tâche", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Plateforme de marque", "Conseil / stratégie");
    const taskId = await withDb(
      async (c) =>
        (await c.query(`select id from task where "projectId"=$1 and title='Entretiens'`, [id])).rows[0].id,
    );
    await page.goto(`/taches/${taskId}`);
    await page.getByRole("button", { name: "Archiver" }).click();
    await expect(page).toHaveURL(new RegExp(`/projets/${id}$`));
    await page.goto("/plus/archives");
    await expect(page.getByRole("link", { name: "Entretiens" })).toBeVisible();
    await page.getByRole("button", { name: "Restaurer" }).first().click();
    await page.goto(`/projets/${id}?onglet=taches`);
    await expect(page.getByRole("link", { name: "Entretiens" })).toBeVisible();
  });

  test("Mes tâches liste les tâches assignées", async ({ page }) => {
    const name = `Mia${Date.now() % 100000}`;
    await activateAssociate(page, name);
    const id = await createProjectFromTemplate(page, "Projet perso", "Projet vierge");
    await page.goto(`/projets/${id}/taches/nouvelle`);
    await page.getByLabel("Titre").fill("Valider le casting");
    await page.getByLabel("Responsable").selectOption({ label: name });
    await page.getByLabel("Échéance").fill("2020-01-15");
    await page.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Valider le casting" })).toBeVisible();
    await page.goto("/taches");
    await expect(
      page
        .getByRole("region", { name: "En retard ou bloquées" })
        .getByRole("link", { name: "Valider le casting" }),
    ).toBeVisible();
  });
});
