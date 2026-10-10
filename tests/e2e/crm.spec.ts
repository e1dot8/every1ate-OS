import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function createCompany(page: Page, name: string) {
  await page.goto("/crm/clients/nouveau");
  await page.getByLabel("Entreprise").fill(name);
  await page.getByLabel("Secteur").fill("Mode");
  await page.getByRole("button", { name: "Créer l'entreprise" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url().split("/crm/clients/")[1];
}

async function createOpportunity(page: Page, company: string, title: string, amount: string) {
  await page.goto("/crm/opportunites/nouvelle");
  await page.getByLabel("Intitulé").fill(title);
  await page.getByLabel("Entreprise").selectOption({ label: company });
  await page.getByLabel("Montant estimé HT (€)").fill(amount);
  await page.getByLabel("Prochaine action").fill("Envoyer le devis");
  await page.getByLabel("Date de relance").fill("2026-10-01");
  await page.getByRole("button", { name: "Créer l'opportunité" }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  return page.url().split("/crm/opportunites/")[1];
}

async function setStage(page: Page, label: string) {
  await page.getByLabel("Étape", { exact: true }).selectOption({ label });
  await page.getByRole("button", { name: "Changer l'étape" }).click();
  await expect(page.getByText("Étape mise à jour.")).toBeVisible();
}

test.describe("CRM", () => {
  test("entreprise, contact, opportunité : pipeline exact, pondéré, relance visible et historique", async ({
    page,
  }) => {
    await activateAssociate(page, "Charles");
    const company = unique("Maison Lumière");
    const clientId = await createCompany(page, company);

    await page.getByRole("link", { name: "+ Ajouter" }).click();
    await page.getByLabel("Prénom").fill("Alice");
    await page.getByLabel("Nom", { exact: true }).fill("Martin");
    await page.getByLabel("E-mail professionnel").fill("pas-un-email");
    await page.getByRole("button", { name: "Ajouter le contact" }).click();
    await expect(page.getByText("Adresse e-mail invalide.")).toBeVisible();
    await expect(page.getByLabel("Prénom")).toHaveValue("Alice");
    await page.getByLabel("E-mail professionnel").fill("alice@example.test");
    await page.getByRole("button", { name: "Ajouter le contact" }).click();
    await expect(page).toHaveURL(new RegExp(`/crm/clients/${clientId}$`));
    await expect(page.getByRole("link", { name: "Alice Martin" })).toBeVisible();

    const title = unique("Campagne SS27");
    const id = await createOpportunity(page, company, title, "12 000");
    // Étape initiale « À contacter » : 10 % par défaut → 1 200 € pondérés.
    await expect(page.getByText("À contacter").first()).toBeVisible();
    await expect(page.getByText(/1\s200,00\s€/)).toBeVisible();
    await expect(page.getByText(/· en retard/)).toBeVisible();

    await setStage(page, "Proposition envoyée");
    await page.getByText("Ajouter un échange, une réunion, une note…").click();
    await page.getByLabel("Type").selectOption({ label: "Proposition" });
    await page.getByLabel("Compte rendu").fill("Devis V1 envoyé");
    await page
      .getByLabel("Lien vers la proposition (facultatif)")
      .fill("https://drive.google.com/file/d/exemple");
    await page.getByRole("button", { name: "Ajouter à l'historique" }).click();
    await expect(page.getByText("Ajouté à l'historique.")).toBeVisible();
    const history = page.getByRole("list", { name: "Historique de l'opportunité" });
    await expect(history).toContainText("À contacter → Proposition envoyée");
    await expect(history).toContainText("Devis V1 envoyé");
    await expect(history.getByRole("link", { name: "Proposition" })).toHaveAttribute(
      "href",
      /drive\.google\.com/,
    );

    await page.goto("/crm?moi=1");
    const column = page.getByRole("region", { name: "Proposition envoyée" });
    await expect(column.getByRole("link", { name: title })).toBeVisible();
    await expect(column).toContainText("Relance en retard");

    await page.goto("/crm?onglet=previsions&moi=1");
    await expect(page.getByText(/Pipeline brut/)).toBeVisible();
    void id;
  });

  test("probabilités configurables : le pondéré suit le réglage", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const company = unique("Atelier Nord");
    await createCompany(page, company);
    const title = unique("Lookbook");
    const id = await createOpportunity(page, company, title, "10000");
    await page.goto("/crm/reglages");
    // « Négociation » : aucune autre vérification ne dépend de ce réglage global.
    const original = await page.getByLabel("Négociation").inputValue();
    await page.getByLabel("Négociation").fill("30");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Probabilités enregistrées.")).toBeVisible();
    await page.goto(`/crm/opportunites/${id}`);
    await setStage(page, "Négociation");
    await expect(page.getByText(/3\s000,00\s€/)).toBeVisible();
    // Remise en état pour les autres tests.
    await page.goto("/crm/reglages");
    await page.getByLabel("Négociation").fill(original);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Probabilités enregistrées.")).toBeVisible();
  });

  test("perte avec motif, historisée", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const company = unique("Studio Sud");
    await createCompany(page, company);
    await createOpportunity(page, company, unique("Clip"), "5000");
    await page.getByLabel("Étape", { exact: true }).selectOption({ label: "Perdu" });
    await page.getByLabel("Motif de perte (facultatif)").fill("Budget gelé");
    await page.getByRole("button", { name: "Changer l'étape" }).click();
    await expect(page.getByText("Perdue : Budget gelé")).toBeVisible();
    await expect(page.getByRole("list", { name: "Historique de l'opportunité" })).toContainText(
      "Motif : Budget gelé",
    );
  });

  test("Gagné → conversion confirmée avec modèle ; une nouvelle tentative ne crée pas de doublon", async ({
    page,
  }) => {
    await activateAssociate(page, "Johan");
    const company = unique("Galerie Ouest");
    await createCompany(page, company);
    const title = unique("Expo printemps");
    const id = await createOpportunity(page, company, title, "20000");
    await setStage(page, "Gagné");
    await expect(page.getByText("Opportunité gagnée : créer le projet ?")).toBeVisible();
    await page.getByRole("link", { name: "Convertir en projet" }).click();

    await expect(page.getByText(/Conversion en projet · étape 1\/3/)).toBeVisible();
    await page.getByRole("radio", { name: /Conseil/ }).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByLabel("Nom du projet")).toHaveValue(title);
    await expect(page.getByLabel("Client")).toHaveValue(/.+/);
    await expect(page.getByLabel("Description (facultatif)")).toHaveValue(
      /Montant estimé HT : 20\s000,00\s€/,
    );
    await page.getByRole("button", { name: "Voir la structure" }).click();

    // Double envoi simulé : le formulaire est soumis deux fois de suite (double clic, réseau lent).
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Créer le projet"),
      );
      const form = button?.closest("form");
      form?.requestSubmit();
      form?.requestSubmit();
    });
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute(
      "href",
      `/crm/opportunites/${id}`,
    );

    const count = async () =>
      withDb(
        async (c) =>
          (
            await c.query(
              `select count(*)::int n from project p join opportunity o on o."projectId" = p.id where o.id=$1`,
              [id],
            )
          ).rows[0].n,
      );
    const byName = async () =>
      withDb(
        async (c) => (await c.query(`select count(*)::int n from project where name=$1`, [title])).rows[0].n,
      );
    expect(await count()).toBe(1);
    expect(await byName()).toBe(1);

    // Nouvelle tentative : la page renvoie vers le projet existant.
    await page.goto(`/crm/opportunites/${id}/convertir`);
    await expect(page.getByText("Cette opportunité a déjà été convertie.")).toBeVisible();
    expect(await byName()).toBe(1);

    // Une opportunité convertie ne peut plus quitter « Gagné ».
    await page.goto(`/crm/opportunites/${id}`);
    await page.getByLabel("Étape", { exact: true }).selectOption({ label: "Négociation" });
    await page.getByRole("button", { name: "Changer l'étape" }).click();
    await expect(page.getByText(/déjà été convertie en projet/)).toBeVisible();
  });
});
