import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Valeur d'une ligne de la fiche (« libellé … valeur »). */
const fact = (page: import("@playwright/test").Page, label: string) =>
  page.locator(`div:has(> span:text-is("${label}")) > b`);

test.describe("temps et estimations", () => {
  test("tâche interne, pause non comptée, restant, mini-bilan et rapport", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const title = unique("Mettre à jour le portfolio");

    // Tâche sans client : rangée dans « La maison », catégorie agence par défaut.
    await page.goto("/taches/nouvelle");
    await page.getByRole("button", { name: /Tâche interne, sans client/ }).click();
    await expect(page.getByLabel("Catégorie")).toHaveValue("AGENCE");
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Catégorie").selectOption("BRANDING");
    // Plage indicative, ou durée observée si la base de test a déjà assez de tâches comparables.
    await expect(
      page.getByText(/Repère indicatif pour cette complexité|Médiane de \d+ tâches comparables/),
    ).toBeVisible();
    await page.getByRole("group", { name: "Durées rapides" }).getByRole("button", { name: "30 min" }).click();
    await expect(page.getByLabel("Durée estimée (h)")).toHaveValue("0,5");
    await page.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const taskId = page.url().split("/taches/")[1];
    await expect(fact(page, "Catégorie")).toHaveText("Personal branding");

    // Chronomètre : pause (segment clos, reprenable), reprise, arrêt.
    await page.getByRole("button", { name: "Démarrer le chronomètre" }).click();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("en pause (non comptée)")).toBeVisible();
    await expect(page.getByRole("link", { name: `En pause · ${title}` })).toBeVisible();
    await page.getByRole("button", { name: "Reprendre" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.getByRole("button", { name: "Arrêter" }).click();
    await expect(page.getByRole("button", { name: "Démarrer le chronomètre" })).toBeVisible();
    const segments = await withDb(
      async (c) =>
        (await c.query(`select resumable from time_entry where "taskId" = $1 order by "createdAt"`, [taskId]))
          .rows,
    );
    expect(segments).toEqual([{ resumable: false }, { resumable: false }]);

    // Temps restant saisi à la main.
    await page.getByLabel("Temps restant estimé").fill("1h30");
    await page.getByRole("button", { name: "Enregistrer le restant" }).click();
    await expect(page.getByText("Temps restant mis à jour.")).toBeVisible();
    await expect(fact(page, "Restant estimé")).toHaveText("1 h 30");

    // Dépassement net : le mini-bilan est proposé une fois la tâche terminée.
    await page.getByText("Saisir du temps manuellement").click();
    await page.getByLabel("Durée", { exact: true }).fill("2h");
    await page.getByRole("button", { name: "Ajouter le temps" }).click();
    await expect(page.getByText("Temps ajouté.")).toBeVisible();
    await page.getByText("Terminé", { exact: true }).first().click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText(/Statut mis à jour\./)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Mini-bilan (facultatif)" })).toBeVisible();
    await expect(fact(page, "Écart prévu / réel")).toHaveText(/^\+1 h 3\d \(\+3\d\d %\)$/);
    await page.getByText("Brief incomplet", { exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(fact(page, "Raison de l'écart")).toHaveText("Brief incomplet");
    await expect(page.getByRole("heading", { name: "Mini-bilan (facultatif)" })).toHaveCount(0);

    // Rapport : temps interne, écart et raison.
    await page.goto("/temps/rapport?periode=semaine");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByText("Personal branding")).toBeVisible();
    await expect(
      page.locator("li", { hasText: "Brief incomplet" }).getByText("1", { exact: true }),
    ).toBeVisible();

    // La maison n'est pas un projet client : absente de la liste, accessible par son lien.
    await page.goto("/projets");
    await expect(page.getByRole("link", { name: /La maison ·/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "La maison Every1.ate", exact: true })).toHaveCount(0);
  });
});
