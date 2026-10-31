import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Identifiant de l'associé (plusieurs comptes de test peuvent porter le même prénom). */
const userId = (email: string) =>
  withDb(
    async (c) => (await c.query(`select id from "user" where email = $1`, [email])).rows[0].id as string,
  );

async function createTask(page: Page, projectId: string, title: string, owner: string, complexity: string) {
  await page.goto(`/projets/${projectId}/taches/nouvelle`);
  await page.getByLabel("Titre").fill(title);
  await page.getByLabel("Responsable").selectOption(owner);
  await page.getByLabel("Complexité").selectOption({ label: complexity });
  await page.getByRole("button", { name: "Créer la tâche" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.url().split("/taches/")[1];
}

const xpRows = (taskId: string) =>
  withDb(
    async (c) =>
      (
        await c.query(`select amount from xp_transaction where "sourceId" = $1 order by "createdAt"`, [
          taskId,
        ])
      ).rows as { amount: number }[],
  );

test.describe("cockpit et progression", () => {
  test("priorités du jour, XP à la clôture une seule fois, correction journalisée", async ({ page }) => {
    const me = await userId((await activateAssociate(page, "Johan")).email);
    await expect(page.getByRole("heading", { name: "Mes priorités" })).toBeVisible();
    // Pas de panneau de progression permanent sur le cockpit : la gamification vient au bon moment.
    await expect(page.getByText(/^Niveau 1 · 0 XP/)).toHaveCount(0);

    const projectId = await createProjectFromTemplate(page, unique("Cockpit"), "Projet vierge");
    const big = unique("Deck stratégie");
    const small = unique("Envoyer la facture");
    const bigId = await createTask(page, projectId, big, me, "Complexe · 50 XP");
    await createTask(page, projectId, small, me, "Simple · 10 XP");

    // Sans choix : une suggestion, à garder en un clic.
    await page.goto("/");
    await expect(page.getByText("Suggestion d'après la priorité et l'échéance : à confirmer.")).toBeVisible();
    await page.getByRole("button", { name: "Garder ces priorités" }).click();
    await expect(page.getByRole("link", { name: "Changer mes priorités" })).toBeVisible();
    await expect(page.getByText("2 sur 2 encore à faire.")).toBeVisible();

    // Terminer depuis le cockpit : la tâche passe barrée et affiche ses XP.
    await page.getByRole("button", { name: `Terminer « ${big} »` }).click();
    await expect(page.locator("ol").getByText("+50 XP", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 sur 2 encore à faire.")).toBeVisible();
    // Une notification brève annonce les XP, puis s'efface.
    await expect(
      page.getByRole("status").filter({ hasText: "Tâche terminée." }).getByText("+50 XP"),
    ).toBeVisible();

    // Rouvrir puis refermer : aucune nouvelle attribution.
    await page.goto(`/taches/${bigId}`);
    await page.getByText("À faire", { exact: true }).click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Statut mis à jour.", { exact: true })).toBeVisible();
    await page.getByText("Terminé", { exact: true }).last().click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Statut mis à jour.", { exact: true })).toBeVisible();
    expect(await xpRows(bigId)).toEqual([{ amount: 50 }]);

    // Journal, règles et correction (ligne inverse, jamais une suppression).
    await page.goto("/progression");
    await expect(page.getByRole("heading", { name: "Apprenti" })).toBeVisible();
    await expect(page.getByText("Pas de classement entre associés.")).toBeVisible();
    await page.getByRole("button", { name: "Corriger" }).click();
    await page.getByLabel("Pourquoi corriger ?").fill("Tâche fermée par erreur");
    await page.getByRole("button", { name: "Annuler ces XP" }).click();
    await expect(page.getByText("-50 XP")).toBeVisible();
    await expect(page.getByText(/^0 XP · encore 100 XP/)).toBeVisible();
    expect(await xpRows(bigId)).toEqual([{ amount: 50 }, { amount: -50 }]);
    const audit = await withDb(
      async (c) =>
        (
          await c.query(
            `select reason from audit_event where action = 'progression.xp_reversed' and "targetId" in (select id from xp_transaction where "sourceId" = $1)`,
            [bigId],
          )
        ).rows,
    );
    expect(audit).toEqual([{ reason: "Tâche fermée par erreur" }]);
  });

  test("le choix des priorités est limité à trois", async ({ page }) => {
    const me = await userId((await activateAssociate(page, "Charles")).email);
    const projectId = await createProjectFromTemplate(page, unique("Limite"), "Projet vierge");
    for (const n of [1, 2, 3, 4])
      await createTask(page, projectId, `Tâche ${n} ${projectId}`, me, "Simple · 10 XP");
    await page.goto("/priorites");
    const boxes = page.getByRole("checkbox");
    await expect(boxes).toHaveCount(4);
    for (const n of [0, 1, 2]) await boxes.nth(n).check();
    await expect(boxes.nth(3)).toBeDisabled();
    await expect(page.getByText("3 / 3 choisies")).toBeVisible();
    await page.getByRole("button", { name: "Valider mes priorités" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("3 sur 3 encore à faire.")).toBeVisible();
  });
});
