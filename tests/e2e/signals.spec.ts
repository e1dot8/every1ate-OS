import { expect, test } from "@playwright/test";
import { activateAssociate } from "./support/flows";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** Date calendrier (AAAA-MM-JJ) à `days` jours d'aujourd'hui. */
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

test.describe("opportunités détectées", () => {
  test("un contrat à renouveler apparaît sur le CRM et ouvre une opportunité préremplie", async ({
    page,
  }) => {
    await activateAssociate(page, "Pierre");

    const client = unique("Atelier Signal");
    await page.goto("/crm/clients/nouveau");
    await page.getByLabel("Entreprise").fill(client);
    await page.getByRole("button", { name: "Créer l'entreprise" }).click();
    await expect(page.getByRole("heading", { level: 1, name: client })).toBeVisible();
    const clientId = page.url().split("/crm/clients/")[1].split("?")[0];

    // Renouvellement dans 30 jours, préavis de 20 jours : préavis à donner dans 10 jours (≤ 60).
    const label = unique("Maintenance site");
    await page.goto("/finance/contrats/nouveau");
    await page.getByLabel("Libellé").fill(label);
    await page.getByLabel("Client").selectOption({ label: client });
    await page.getByLabel("Montant mensuel HT (€)").fill("800");
    await page.getByLabel("Début").fill(inDays(-300));
    await page.getByLabel("Renouvellement", { exact: true }).fill(inDays(30));
    await page.getByLabel("Préavis (jours)").fill("20");
    await page.getByRole("button", { name: "Ajouter le contrat" }).click();
    await expect(page.getByRole("link", { name: label }).first()).toBeVisible();

    await page.goto("/crm");
    const section = page.getByRole("region", { name: "Opportunités détectées" });
    await expect(section.getByRole("heading", { name: "Opportunités détectées" })).toBeVisible();
    // Base partagée : d'autres signaux peuvent précéder le nôtre et la liste être repliée.
    const toggle = section.getByRole("button", { name: /Afficher les \d+ signaux|Réduire la liste/ });
    if (await toggle.isVisible()) {
      await expect(async () => {
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
      }).toPass();
    }

    const item = section.getByRole("listitem").filter({ hasText: client });
    await expect(item).toHaveCount(1);
    await expect(item.getByText("Renouvellement", { exact: true })).toBeVisible();
    await expect(item).toContainText(`Renouvellement : ${label}`);
    await expect(item).toContainText("préavis à donner avant le");
    await expect(item.getByRole("link", { name: client, exact: true })).toHaveAttribute(
      "href",
      `/crm/clients/${clientId}`,
    );
    await expect(item.getByRole("link", { name: /Voir le contrat/ })).toHaveAttribute(
      "href",
      /^\/finance\/contrats\/[^/?]+$/,
    );

    await item.getByRole("link", { name: /Créer une opportunité/ }).click();
    await expect(page).toHaveURL(new RegExp(`/crm/opportunites/nouvelle\\?client=${clientId}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Nouvelle opportunité" })).toBeVisible();
    const company = page.getByLabel("Entreprise");
    await expect(company).toHaveValue(clientId);
    await expect(company.locator("option:checked")).toHaveText(client);
  });
});
