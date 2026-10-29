import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const letters = () =>
  Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");

const idOf = (email: string) =>
  withDb(
    async (c) => (await c.query(`select id from "user" where email = $1`, [email])).rows[0].id as string,
  );

test.describe("compétences, badges et bureau commun", () => {
  test("premier badge célébré, fil de la brigade, félicitations et reconnaissance", async ({ browser }) => {
    const name = `Lea${letters()}`;
    const me = await (await browser.newContext()).newPage();
    const { email } = await activateAssociate(me, name);
    const myId = await idOf(email);
    const mate = await (await browser.newContext()).newPage();
    await activateAssociate(mate, `Max${letters()}`);

    // Une première tâche terminée : « La première commande ».
    const projectId = await createProjectFromTemplate(me, `Badge ${letters()}`, "Projet vierge");
    const title = `Première tâche ${letters()}`;
    await me.goto(`/projets/${projectId}/taches/nouvelle`);
    await me.getByLabel("Titre").fill(title);
    await me.getByLabel("Responsable").selectOption(myId);
    await me.getByRole("button", { name: "Créer la tâche" }).click();
    await me.getByText("Terminé", { exact: true }).first().click();
    await me.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(me.getByText(/Nouveau badge : « La première commande » !/)).toBeVisible();

    await me.goto("/");
    await expect(me.getByRole("heading", { name: "Nouveau badge !" })).toBeVisible();
    // Le partage est un choix : sans lui, rien ne part dans le fil.
    await me.getByRole("button", { name: "Partager avec l'équipe" }).click();
    await expect(me.getByRole("heading", { name: "Nouveau badge !" })).toHaveCount(0);

    // Collection : visible, masquable.
    await me.goto("/progression");
    await expect(me.getByText("La première commande", { exact: true }).first()).toBeVisible();
    await me.getByRole("button", { name: "Mettre « La première commande » en favori" }).click();
    await expect(
      me.getByRole("button", { name: "Retirer « La première commande » des favoris" }),
    ).toBeVisible();

    // La brigade voit la réussite dans le fil et félicite.
    await mate.goto("/bureau");
    const event = `${name} obtient « La première commande »`;
    await expect(mate.getByText(event)).toBeVisible();
    await mate.getByRole("button", { name: `Féliciter : ${event}` }).click();
    await mate.getByLabel("Votre mot de félicitations").fill("Bien joué !");
    await mate.getByRole("button", { name: "Envoyer le bravo" }).click();
    await expect(mate.locator("li", { hasText: event }).getByText(": Bien joué !").first()).toBeVisible();

    // Reconnaissance : un badge de brigade décerné, avec XP bonus annoncés.
    await mate.getByLabel("Pour qui ?").selectOption(myId);
    await mate.getByLabel("Quel badge ?").selectOption("main-tendue");
    await mate.getByLabel("Pourquoi ?").fill("A débloqué le tournage samedi");
    await mate.getByRole("button", { name: "Décerner le badge" }).click();
    await expect(mate.getByText("Badge décerné. La brigade est prévenue.")).toBeVisible();

    await me.goto("/notifications?vue=info");
    await expect(me.getByText(/vous félicite : .* obtient « La première commande »/)).toBeVisible();
    await me.goto("/progression");
    await expect(me.getByText("Main tendue", { exact: true }).first()).toBeVisible();
    await expect(me.getByText(/Badge « Main tendue »/)).toBeVisible();
  });

  test("compétences : niveau auto-évalué, preuve, cible ; préférences et pause de série", async ({
    page,
  }) => {
    await activateAssociate(page, `Sam${letters()}`);
    await page.goto("/competences");
    await expect(page.getByRole("heading", { name: "Production & livraison" })).toBeVisible();
    await page.getByRole("link", { name: /Étude de cas/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Étude de cas" })).toBeVisible();
    await page.getByRole("button", { name: /^3\. Autonomie/ }).click();
    await expect(page.getByRole("button", { name: /^3\. Autonomie/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByLabel("Une preuve").fill("Cas G-Shock publié sur le site");
    await page.getByRole("button", { name: "Ajouter la preuve" }).click();
    await expect(page.getByText("Cas G-Shock publié sur le site")).toBeVisible();
    await page.getByRole("button", { name: "En faire ma compétence cible du mois" }).click();
    await expect(page.getByRole("button", { name: "Ne plus en faire ma cible" })).toBeVisible();
    await page.goto("/competences");
    await expect(page.getByText("Compétence travaillée en ce moment :")).toBeVisible();

    await page.goto("/plus/preferences");
    await page.getByLabel(/Animations de célébration/).uncheck();
    await page.getByLabel("Jours actifs pour qu'une semaine compte").selectOption("2");
    await page.getByRole("button", { name: "Enregistrer mes préférences" }).click();
    await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

    await page.goto("/progression");
    await page.getByRole("button", { name: "Mettre cette semaine en pause" }).click();
    await expect(page.getByText(/Cette semaine est en pause/)).toBeVisible();
    await page.getByRole("button", { name: "Reprendre cette semaine" }).click();
    await expect(page.getByRole("button", { name: "Mettre cette semaine en pause" })).toBeVisible();
  });
});

test("aucun défilement horizontal sur les écrans du cockpit, des rituels et de la brigade", async ({
  page,
}) => {
  await activateAssociate(page, `Noa${letters()}`);
  // Une tâche à long titre : les textes tronqués ne doivent jamais élargir la page.
  const projectId = await createProjectFromTemplate(page, `Débordement ${letters()}`, "Projet vierge");
  await page.goto(`/projets/${projectId}/taches/nouvelle`);
  await page
    .getByLabel("Titre")
    .fill("Préparer la réunion de lancement avec un titre volontairement très long pour tester");
  await page.getByRole("button", { name: "Créer la tâche" }).click();
  await page.getByText("Terminé", { exact: true }).first().click();
  await page.getByRole("button", { name: "Mettre à jour" }).click();
  await expect(page.getByText(/Statut mis à jour\./)).toBeVisible();
  for (const path of [
    "/",
    "/mise-en-place",
    "/service",
    "/bureau",
    "/crm/salle",
    "/progression",
    "/competences",
    "/competences/etude-de-cas",
    "/notifications",
    "/temps/rapport",
    "/priorites",
    "/maison",
    "/appartement",
    "/appartement/amenager",
    "/quetes",
    "/cuisine",
    "/recettes",
    "/recettes/nouvelle",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
