import { expect, test, type Page } from "@playwright/test";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const letters = () =>
  Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
const unique = (name: string) => `${name} ${Date.now().toString(36)}${letters()}`;

async function createCompany(page: Page, name: string) {
  await page.goto("/crm/clients/nouveau");
  await page.getByLabel("Entreprise").fill(name);
  await page.getByRole("button", { name: "Créer l'entreprise" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function createOpportunity(page: Page, company: string, title: string, followUp: string) {
  await page.goto("/crm/opportunites/nouvelle");
  await page.getByLabel("Intitulé").fill(title);
  await page.getByLabel("Entreprise").selectOption({ label: company });
  await page.getByLabel("Prochaine action").fill("Appeler la directrice marketing");
  await page.getByLabel("Date de relance").fill(followUp);
  await page.getByRole("button", { name: "Créer l'opportunité" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

test.describe("courrier et La Cuisine", () => {
  test("une mention arrive en prioritaire, se classe et se retrouve dans les archives", async ({
    browser,
  }) => {
    // Prénom unique : une mention ambiguë (deux associés du même prénom) est ignorée.
    const name = `Zoe${letters()}`;
    const author = await (await browser.newContext()).newPage();
    await activateAssociate(author, "Johan");
    const target = await (await browser.newContext()).newPage();
    await activateAssociate(target, name);

    const projectId = await createProjectFromTemplate(author, unique("Courrier"), "Projet vierge");
    const title = unique("Monter le teaser");
    await author.goto(`/projets/${projectId}/taches/nouvelle`);
    await author.getByLabel("Titre").fill(title);
    await author.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(author.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await author.getByLabel("Ajouter un commentaire").fill(`@${name} tu peux relire la v1 ?`);
    await author.getByRole("button", { name: "Publier" }).click();
    await expect(author.getByText(`@${name} tu peux relire la v1 ?`)).toBeVisible();

    await target.goto("/notifications?vue=prioritaire");
    const mention = target.getByText(`Johan vous mentionne sur « ${title} »`);
    await expect(mention).toBeVisible();
    await expect(target.getByText(/^Prioritaire · /).first()).toBeVisible();
    await target.getByRole("button", { name: `Classer « Johan vous mentionne sur « ${title} » »` }).click();
    await expect(mention).toHaveCount(0);
    await target.goto("/notifications?vue=archive");
    await expect(target.getByText(`Johan vous mentionne sur « ${title} »`)).toBeVisible();
  });

  test("La Cuisine : chaque situation dit pourquoi, qui et quoi faire ; seuils réglables", async ({
    page,
  }) => {
    await activateAssociate(page, "Charles");
    const company = unique("Maison Test");
    await createCompany(page, company);
    const late = unique("Campagne hiver");
    await createOpportunity(page, company, late, "2026-10-01");
    const waiting = unique("Lookbook printemps");
    await createOpportunity(page, company, waiting, "2099-01-15");
    await page.getByLabel("Étape", { exact: true }).selectOption({ label: "Proposition envoyée" });
    await page.getByRole("button", { name: "Changer l'étape" }).click();
    await expect(page.getByText("Étape mise à jour.")).toBeVisible();

    await page.goto("/crm");
    await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "La Salle" }).click();
    await page.getByRole("link", { name: "Les miennes" }).click();
    const risky = page.locator("li", { has: page.getByRole("link", { name: late, exact: true }) });
    await expect(risky.getByText("Relance en retard")).toBeVisible();
    await expect(risky.getByText(/non faite depuis \d+ j\./)).toBeVisible();
    await expect(risky.getByText("Appeler la directrice marketing")).toBeVisible();
    await expect(risky.getByText("Urgente")).toBeVisible();

    await page.getByRole("link", { name: /^En attente · / }).click();
    const pending = page.locator("li", { has: page.getByRole("link", { name: waiting, exact: true }) });
    await expect(pending.getByText(/Proposition envoyée : réponse attendue/)).toBeVisible();
    // Le même client apparaît dans deux vues, chacune pour sa raison.
    await expect(pending.getByText(company)).toBeVisible();

    await page.getByRole("link", { name: "Régler les seuils" }).click();
    await page.getByLabel("À risque après un silence de (jours)").fill("0");
    await page.getByRole("button", { name: "Appliquer les seuils" }).click();
    await expect(page.getByText("Au moins 1.")).toBeVisible();
    await page.getByLabel("À risque après un silence de (jours)").fill("21");
    await page.getByRole("button", { name: "Appliquer les seuils" }).click();
    await expect(page.getByText("Seuils enregistrés.")).toBeVisible();
  });
});
