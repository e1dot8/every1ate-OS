import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

test.describe("briefings", () => {
  test("la mise en place : état privé, demande d'aide envoyée à la brigade, historique", async ({
    browser,
  }) => {
    const p1 = await (await browser.newContext()).newPage();
    const { email } = await activateAssociate(p1, "Johan");
    const p2 = await (await browser.newContext()).newPage();
    await activateAssociate(p2, "Pierre");

    await p1.getByRole("link", { name: /La mise en place/ }).click();
    await expect(p1.getByRole("heading", { level: 1, name: "La mise en place" })).toBeVisible();
    await expect(p1.getByRole("heading", { name: "2. La charge prévue" })).toBeVisible();
    await p1.getByText("Charge élevée", { exact: true }).click();
    await p1
      .getByLabel("Un blocage ou une aide dont j'ai besoin (facultatif)")
      .fill("Il me manque les rushs du tournage");
    await p1.getByLabel(/Demander un coup de main/).check();
    await p1.getByLabel("Ce que je travaille pour moi aujourd'hui (facultatif)").fill("Étalonnage");
    await p1.getByRole("button", { name: "C'est parti" }).click();
    await expect(p1.getByText("Mise en place faite. Bon service !")).toBeVisible();
    await expect(p1.getByRole("button", { name: "Mettre à jour" })).toBeVisible();

    const saved = await withDb(
      async (c) =>
        (
          await c.query(
            `select b.mood::text, b."moodShared", b."helpWanted" from daily_briefing b join "user" u on u.id = b."userId" where u.email = $1`,
            [email],
          )
        ).rows,
    );
    expect(saved).toEqual([{ mood: "CHARGE_ELEVEE", moodShared: false, helpWanted: true }]);

    // La brigade reçoit la demande d'aide dans son courrier.
    await p2.goto("/notifications");
    await expect(p2.getByText("Johan demande un coup de main").first()).toBeVisible();

    // Le cockpit montre le rituel comme fait.
    await p1.goto("/");
    await expect(p1.getByText("Faite aujourd'hui · ajuster")).toBeVisible();
  });

  test("le service de la semaine : synthèse, trois objectifs au plus, statut, validation, historique", async ({
    page,
  }) => {
    await activateAssociate(page, "Charles");
    // Une semaine lointaine : la page est propre à ce test.
    const week = `20${31 + Math.floor(Math.random() * 60)}-0${1 + Math.floor(Math.random() * 9)}-0${1 + Math.floor(Math.random() * 7)}`;
    await page.goto(`/service?semaine=${week}`);
    await expect(page.getByRole("heading", { name: "Le bilan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "La charge" })).toBeVisible();

    const opened = page.getByRole("button", { name: "Ouvrir le service de la semaine" });
    if (await opened.isVisible()) await opened.click();
    await expect(page.getByRole("heading", { name: "Les objectifs de la semaine" })).toBeVisible();

    const goals = page
      .locator("section, div")
      .filter({ has: page.getByRole("heading", { name: "Les objectifs de la semaine" }) })
      .last();
    const existing = await goals.locator("li").count();
    // Le volet reste ouvert après chaque ajout.
    await page.getByText("Ajouter l'objectif", { exact: true }).first().click();
    for (let i = existing; i < 3; i++) {
      await page.getByLabel("Résultat attendu").fill(`Objectif ${i + 1}`);
      await page.getByLabel("Critère de réussite").fill("Mesurable");
      await page.getByRole("button", { name: "Ajouter l'objectif" }).click();
      await expect(page.getByText(`Objectif ${i + 1}`, { exact: true })).toBeVisible();
      await expect(page.getByLabel("Résultat attendu")).toHaveValue("");
    }
    await page.getByLabel("Résultat attendu").fill("Un quatrième");
    await page.getByRole("button", { name: "Ajouter l'objectif" }).click();
    await expect(page.getByText(/Trois objectifs au plus par semaine/)).toBeVisible();

    await page.getByRole("button", { name: "Atteint" }).first().click();
    await expect(page.getByText("Atteint", { exact: true }).first()).toBeVisible();

    await page.getByText("Ajouter l'action", { exact: true }).first().click();
    await page.getByLabel("L'action").fill("Relancer le prestataire son");
    await page.getByRole("button", { name: "Ajouter l'action" }).click();
    await expect(page.getByText("Relancer le prestataire son")).toBeVisible();

    const validate = page.getByRole("button", { name: "Valider le service de la semaine" });
    if (await validate.isVisible()) {
      await validate.click();
      await expect(page.getByText(/^Validé le /)).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Les semaines passées" })).toBeVisible();
  });
});
