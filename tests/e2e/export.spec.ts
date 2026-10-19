import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function setBudget(page: Page, projectId: string, revenue: string, cost: string) {
  await page.goto(`/projets/${projectId}?onglet=finance`);
  await page.getByText(/Saisir le budget initial|Réviser le budget/).click();
  await page.getByLabel("Revenus prévus HT (€)").fill(revenue);
  await page.getByLabel("Coûts prévus HT (€)").fill(cost);
  await page.getByRole("button", { name: "Enregistrer le budget initial" }).click();
  await expect(page.getByText("Budget enregistré.")).toBeVisible();
}

test.describe("export comptable et chiffrage indicatif", () => {
  test("export Excel d'un projet : fichier, feuilles, montants typés et journal ; refus sans session", async ({
    page,
    request,
  }) => {
    await activateAssociate(page, "Pierre");
    const name = unique("Export clip");
    const id = await createProjectFromTemplate(page, name);
    await setBudget(page, id, "20 000", "12 000");

    await page.goto(`/projets/${id}/finance/cout`);
    await page.getByLabel("Description").fill("Location matériel");
    await page.getByLabel("Fournisseur").fill("Loueur Test");
    await page.getByLabel("Montant HT (€)").fill("1 234,56");
    await page.getByLabel("Statut").selectOption("ENGAGE");
    await page.getByRole("button", { name: "Ajouter le coût" }).click();
    await expect(page).toHaveURL(/onglet=finance/);

    await expect(page.getByRole("link", { name: "Exporter (Excel)" })).toHaveAttribute(
      "href",
      `/api/export/finance?projet=${id}`,
    );

    const res = await page.request.get(`/api/export/finance?projet=${id}`);
    expect(res.status()).toBe(200);
    const headers = res.headers();
    expect(headers["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(headers["content-disposition"]).toMatch(
      /^attachment; filename="every1ate-finance-projet-export-clip-[a-z0-9-]+\.xlsx"$/,
    );
    expect(headers["cache-control"]).toContain("no-store");

    const wb = new ExcelJS.Workbook();
    // Copie dans un ArrayBuffer dédié (le Buffer Node peut partager un pool mémoire).
    await wb.xlsx.load(new Uint8Array(await res.body()).buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Synthèse",
      "Coûts",
      "Facturation",
      "Encaissements",
      "À lire",
    ]);
    const synthesis = wb.getWorksheet("Synthèse")!;
    expect(synthesis.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(synthesis.getRow(2).getCell(1).value).toBe(name);
    expect(synthesis.getRow(2).getCell(3).value).toBe("Ensemble du projet");
    expect(synthesis.getRow(2).getCell(5).value).toBe(20000);
    const costs = wb.getWorksheet("Coûts")!;
    expect(costs.getRow(2).getCell(5).value).toBe("Location matériel");
    expect(costs.getRow(2).getCell(6).value).toBe("Loueur Test");
    expect(costs.getRow(2).getCell(8).value).toBe(1234.56);
    expect(costs.getRow(2).getCell(8).numFmt).toBe("#,##0.00 €");
    expect(costs.getRow(2).getCell(1).value).toBeInstanceOf(Date);

    const audited = await withDb(
      async (c) =>
        (
          await c.query(
            `select count(*)::int as n from audit_event where action = 'finance.export' and "projectId" = $1`,
            [id],
          )
        ).rows[0].n as number,
    );
    expect(audited).toBeGreaterThanOrEqual(1);

    // Paramètres invalides, projet inconnu, absence de session.
    expect((await page.request.get("/api/export/finance")).status()).toBe(400);
    expect((await page.request.get("/api/export/finance?mois=2026-13")).status()).toBe(400);
    expect((await page.request.get(`/api/export/finance?projet=${id}&annee=2026`)).status()).toBe(400);
    expect((await page.request.get("/api/export/finance?projet=projet-inconnu-e2e")).status()).toBe(404);
    expect((await request.get(`/api/export/finance?projet=${id}`)).status()).toBe(401);
    expect((await request.get("/api/export/finance?mois=2026-10")).status()).toBe(401);
  });

  test("export comptable du mois et de l'année depuis la page Finance", async ({ page }) => {
    await activateAssociate(page, "Johan");
    await page.goto("/finance");
    const form = page.getByRole("form", { name: "Export comptable" });
    const month = form.getByLabel("Export comptable (mois)");
    await expect(month).toHaveValue(/^\d{4}-\d{2}$/);
    await month.fill("2026-10");

    const monthly = page.waitForEvent("download");
    await form.getByRole("button", { name: "Exporter" }).click();
    expect((await monthly).suggestedFilename()).toBe("every1ate-finance-2026-10.xlsx");

    const yearly = page.waitForEvent("download");
    await form.getByRole("button", { name: /Toute l'année/ }).click();
    expect((await yearly).suggestedFilename()).toBe("every1ate-finance-2026.xlsx");
  });

  test("chiffrage indicatif : repères du même modèle sur l'onglet finance", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const reference = await createProjectFromTemplate(
      page,
      unique("Repère tournage"),
      "Production audiovisuelle",
    );
    await setBudget(page, reference, "30 000", "18 000");

    const id = await createProjectFromTemplate(
      page,
      unique("Chiffrage tournage"),
      "Production audiovisuelle",
    );
    await page.goto(`/projets/${id}?onglet=finance`);
    const card = page.getByRole("region", { name: "Chiffrage indicatif" });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/Indicatif, basé sur \d+ projets?/);
    await expect(card).toContainText("Saisissez un budget pour comparer ce projet aux repères.");

    await setBudget(page, id, "25 000", "15 000");
    await page.reload();
    await expect(card.getByRole("list", { name: "Comparaison avec l'historique" })).toContainText(
      "Revenus prévus de ce projet",
    );
  });

  test("chiffrage indicatif d'une opportunité : choix du modèle comparable", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const company = unique("Atelier Chiffrage");
    await page.goto("/crm/clients/nouveau");
    await page.getByLabel("Entreprise").fill(company);
    await page.getByRole("button", { name: "Créer l'entreprise" }).click();
    await expect(page.getByRole("heading", { level: 1, name: company })).toBeVisible();

    const title = unique("Film de marque");
    await page.goto("/crm/opportunites/nouvelle");
    await page.getByLabel("Intitulé").fill(title);
    await page.getByLabel("Entreprise").selectOption({ label: company });
    await page.getByLabel("Montant estimé HT (€)").fill("18 000");
    await page.getByRole("button", { name: "Créer l'opportunité" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    const card = page.getByRole("region", { name: "Chiffrage indicatif" });
    await expect(card).toContainText("Choisissez le modèle de projet le plus proche");
    await card.getByLabel("Modèle de projet comparable").selectOption({ label: "Production audiovisuelle" });
    await card.getByRole("button", { name: "Comparer" }).click();
    await expect(page).toHaveURL(/modele=production-audiovisuelle/);
    await expect(card.getByLabel("Modèle de projet comparable")).toHaveValue("production-audiovisuelle");
    await expect(card).toContainText(
      /Pas encore d'historique pour ce modèle|Indicatif, basé sur \d+ projets?/,
    );
  });
});
