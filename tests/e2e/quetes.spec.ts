import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

const letters = () =>
  Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");

test.describe("quêtes de la semaine", () => {
  test("accepter, progresser sur une vraie donnée, valider une seule fois ; trois au plus", async ({
    page,
  }) => {
    const name = `Iris${letters()}`;
    await activateAssociate(page, name);

    // Le cockpit invite à choisir.
    await expect(page.getByRole("heading", { name: "Mes quêtes" })).toBeVisible();
    await page.goto("/quetes");
    await expect(page.getByRole("heading", { level: 1, name: "Quêtes de la semaine" })).toBeVisible();
    await expect(page.getByText("Mes quêtes (0 / 3)")).toBeVisible();

    // Accepter « Écrire une méthode » : 0 / 1, pas encore validable.
    await page.getByRole("button", { name: "Accepter « Écrire une méthode »" }).click();
    await expect(page.getByText("Mes quêtes (1 / 3)")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Progression : 0 sur 1" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Valider la quête" })).toHaveCount(0);

    // Le vrai travail fait avancer la quête.
    const title = `Check-list de tournage ${letters()}`;
    await page.goto("/recettes/nouvelle");
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Catégorie").selectOption({ label: "Production & livraison" });
    await page.getByLabel("À quoi sert-elle ?").fill("Ne rien oublier le jour J");
    await page.getByLabel("Les étapes").fill("1. Matériel\n2. Autorisations\n3. Sauvegardes");
    await page.getByRole("button", { name: "Ajouter au carnet" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    await page.goto("/quetes");
    await expect(page.getByRole("progressbar", { name: "Progression : 1 sur 1" })).toBeVisible();
    await page.getByRole("button", { name: "Valider la quête" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Quête accomplie" }).getByText("+30 XP"),
    ).toBeVisible();
    await expect(page.getByText("Accomplie", { exact: true })).toBeVisible();

    const rows = await withDb(
      async (c) =>
        (
          await c.query(
            `select x.amount from xp_transaction x join "user" u on u.id = x."userId"
             where u.name = $1 and x.kind = 'quest.done'`,
            [name],
          )
        ).rows,
    );
    expect(rows).toEqual([{ amount: 30 }]);

    // Trois quêtes au plus par semaine (la quête validée compte).
    await page.getByRole("button", { name: "Accepter « Terminer 5 tâches »" }).click();
    await expect(page.getByText("Mes quêtes (2 / 3)")).toBeVisible();
    await page.getByRole("button", { name: "Accepter « Féliciter 2 réussites »" }).click();
    await expect(page.getByText("Mes quêtes (3 / 3)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accepter « Suivre 10 h de temps »" })).toBeDisabled();

    // Abandonner libère la place.
    const cheers = page.locator("li", { hasText: "Féliciter 2 réussites" });
    await cheers.getByRole("button", { name: "Abandonner" }).click();
    await expect(page.getByText("Mes quêtes (2 / 3)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accepter « Suivre 10 h de temps »" })).toBeEnabled();
  });
});
