import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const euros = (s: string) => new RegExp(s.replace(/ /g, "\\s"));

async function setBudget(page: Page, projectId: string, revenue: string, cost: string, reason?: string) {
  await page.goto(`/projets/${projectId}?onglet=finance`);
  await page.getByText(/Saisir le budget initial|Réviser le budget/).click();
  await page.getByLabel("Revenus prévus HT (€)").fill(revenue);
  await page.getByLabel("Coûts prévus HT (€)").fill(cost);
  if (reason) await page.getByLabel("Motif de la révision").fill(reason);
  await page.getByRole("button", { name: /Enregistrer le budget initial|Proposer la révision/ }).click();
}

test.describe("finance", () => {
  test("budget, coût engagé dans la marge prévisionnelle, échéance et encaissement distincts", async ({
    page,
  }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Finance campagne");
    await setBudget(page, id, "50 000", "30 000");
    await expect(page.getByText("Budget enregistré.")).toBeVisible();

    await page.goto(`/projets/${id}/finance/cout`);
    await page.getByLabel("Description").fill("Location studio");
    await page.getByLabel("Fournisseur").fill("Studio Lux");
    await page.getByLabel("Montant HT (€)").fill("35 000");
    await page.getByLabel("Statut").selectOption("ENGAGE");
    await page.getByRole("button", { name: "Ajouter le coût" }).click();
    await expect(page).toHaveURL(/onglet=finance/);
    // 35 000 engagés > budget 30 000 : marge prévisionnelle = 50 000 − 35 000, avant tout paiement.
    await expect(page.getByTestId("kpi-Coûts engagés")).toContainText(euros("35 000 €"));
    await expect(page.getByTestId("kpi-Marge prévisionnelle")).toContainText(euros("15 000 €"));
    await expect(page.getByTestId("kpi-Coûts payés")).toContainText(euros("0 €"));

    await page.goto(`/projets/${id}/finance/echeance`);
    await page.getByLabel("Libellé").fill("Acompte 30 %");
    await page.getByLabel("Montant HT (€)").fill("15 000");
    await page.getByLabel("Date prévue").fill("2026-09-01");
    await page.getByLabel("Statut").selectOption("FACTURE");
    await page.getByLabel("Référence facture (outil externe)").fill("FA-2026-001");
    await page.getByRole("button", { name: "Ajouter l'échéance" }).click();
    await expect(page.getByRole("link", { name: "Acompte 30 %" })).toBeVisible();
    await expect(page.getByText("En retard", { exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "Acompte 30 %" }).click();
    await page.getByLabel("Montant encaissé (€)").fill("5 000");
    await page.getByRole("button", { name: "Enregistrer l'encaissement" }).click();
    await expect(page.getByText("Encaissement enregistré.")).toBeVisible();
    await expect(page.getByText("Partiellement encaissé").first()).toBeVisible();

    await page.goto(`/projets/${id}?onglet=finance`);
    await expect(page.getByTestId("kpi-Facturation attendue")).toContainText(euros("15 000 €"));
    await expect(page.getByTestId("kpi-Facturé")).toContainText(euros("encaissé 5 000 €"));
    await expect(page.getByRole("table", { name: "Marge par lot" })).toBeVisible();
  });

  test("révision au-delà du seuil : décision collective, appliquée après approbation", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(
      isMobile,
      "Réglage global partagé : vérifié une seule fois (ordinateur) pour éviter les interférences.",
    );
    await activateAssociate(page, "Johan");
    // Seuil de test (réglage global remis à zéro en fin de test).
    await page.goto("/gouvernance");
    await page.getByLabel("Dépassement de budget déclencheur (%)").fill("10");
    await page.getByLabel(/Avis favorables requis/).fill("2");
    await page.getByRole("button", { name: "Enregistrer les règles" }).click();
    await expect(page.getByText("Règles enregistrées et journalisées.")).toBeVisible();
    try {
      const id = await createProjectFromTemplate(page, "Finance gouvernance", "Projet vierge");
      await setBudget(page, id, "20 000", "10 000");
      await expect(page.getByText("Budget enregistré.")).toBeVisible();
      await setBudget(page, id, "20 000", "12 000", "Tournage supplémentaire");
      await expect(page.getByText("Seuil dépassé : la révision attend une décision collective.")).toBeVisible(
        { timeout: 30_000 },
      );
      await expect(page.getByRole("list", { name: "Historique du budget" })).toContainText(
        "en attente de décision",
      );

      const decisionId = await withDb(
        async (c) => (await c.query(`select id from decision_request where "projectId"=$1`, [id])).rows[0].id,
      );
      await page.goto(`/gouvernance/${decisionId}`);
      await expect(page.getByText(/\+20 %/)).toBeVisible();
      await page.getByLabel("Pour").check();
      await page.getByRole("button", { name: "Enregistrer mon avis" }).click();
      await expect(page.getByText("Avis enregistré.", { exact: true })).toBeVisible();

      const other = await browser.newContext();
      const second = await other.newPage();
      await activateAssociate(second, "Pierre");
      await second.goto(`/gouvernance/${decisionId}`);
      await second.getByLabel("Pour").check();
      await second.getByLabel("Commentaire (facultatif)").fill("OK vu le planning");
      await second.getByRole("button", { name: "Enregistrer mon avis" }).click();
      await expect(second.getByText("Approuvée", { exact: true })).toBeVisible();
      await expect(second.getByRole("list", { name: "Avis enregistrés" })).toContainText("Pierre : Pour");
      await other.close();

      const status = await withDb(
        async (c) =>
          (
            await c.query(
              `select status from budget_revision where "projectId"=$1 order by "createdAt" desc limit 1`,
              [id],
            )
          ).rows[0].status,
      );
      expect(status).toBe("APPLIQUEE");
    } finally {
      await page.goto("/gouvernance");
      await page.getByLabel("Dépassement de budget déclencheur (%)").fill("");
      await page.getByRole("button", { name: "Enregistrer les règles" }).click();
      await expect(page.getByText("Règles enregistrées et journalisées.")).toBeVisible();
    }
  });

  test("import CSV de coûts : aperçu, erreurs, doublons, confirmation, rapport, réimport et annulation", async ({
    page,
  }) => {
    await activateAssociate(page, "Charles");
    const projectName = `Import coûts ${Date.now().toString(36)}`;
    const id = await createProjectFromTemplate(page, projectName, "Projet vierge");
    const csv = [
      "N° pièce;Date;Fournisseur;Libellé;Montant HT;TVA;Montant TTC;Statut",
      "P-1;05/10/2026;Studio Lux;Location plateau;1 000,00;200,00;1 200,00;Payée",
      "P-2;32/10/2026;Traiteur;Repas équipe;abc;;;",
      "P-1;05/10/2026;Studio Lux;Location plateau;1 000,00;200,00;1 200,00;Payée",
      "P-3;06/10/2026;Loueur;Caméra;450;90;540;À payer",
    ].join("\n");
    const upload = async () => {
      await page.goto("/finance/imports/nouveau");
      await page
        .getByLabel(/Fichier CSV ou Excel/)
        .setInputFiles({ name: "pennylane.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf-8") });
      await page.getByRole("button", { name: "Lire le fichier" }).click();
      await expect(page.getByRole("heading", { name: "pennylane.csv" })).toBeVisible();
      await expect(page.getByLabel("Type d'import")).toHaveValue("COUTS");
      await page.getByLabel("Projet concerné").selectOption(id);
      await page.getByRole("button", { name: "Valider et prévisualiser" }).click();
      await expect(page.getByTestId("import-Prêtes")).toBeVisible();
    };

    await upload();
    await expect(page.getByTestId("import-Prêtes")).toHaveText("2");
    await expect(page.getByTestId("import-Erreurs")).toHaveText("1");
    await expect(page.getByTestId("import-Doublons potentiels")).toHaveText("1");
    await expect(page.getByText("Date illisible : « 32/10/2026 ».")).toBeVisible();
    await page.getByLabel(/Je confirme l'import de 2 ligne/).check();
    await page.getByRole("button", { name: "Confirmer l'import" }).click();
    await expect(page.getByText("Import terminé : 2 ligne(s) importée(s), 2 écartée(s).")).toBeVisible();
    const firstImport = page.url().split("/finance/imports/")[1];

    const costs = await withDb(
      async (c) =>
        (
          await c.query(
            `select status, amount::text as amount, source from cost_item where "projectId"=$1 and "archivedAt" is null order by cost_item.amount`,
            [id],
          )
        ).rows,
    );
    expect(costs).toEqual([
      { status: "FACTURE", amount: "450.00", source: "IMPORT" },
      { status: "PAYE", amount: "1000.00", source: "IMPORT" },
    ]);

    // Réimport du même fichier : signalé et lignes déjà présentes écartées.
    await upload();
    await expect(page.getByText(/Ce fichier a déjà été importé/)).toBeVisible();
    await expect(page.getByTestId("import-Prêtes")).toHaveText("0");
    await expect(page.getByText("Déjà importée").first()).toBeVisible();

    // Annulation logique du premier import.
    await page.goto(`/finance/imports/${firstImport}`);
    await page.getByText("Annuler cet import").click();
    await page.getByLabel("Motif de l'annulation").fill("Mauvais projet");
    await page.getByRole("button", { name: "Annuler l'import" }).click();
    await expect(page.getByText(/Import annulé le/)).toBeVisible();
    const left = await withDb(
      async (c) =>
        (
          await c.query(
            `select count(*)::int n from cost_item where "projectId"=$1 and "archivedAt" is null`,
            [id],
          )
        ).rows[0].n,
    );
    const kept = await withDb(
      async (c) =>
        (await c.query(`select count(*)::int n from cost_item where "projectId"=$1`, [id])).rows[0].n,
    );
    expect(left).toBe(0);
    expect(kept).toBe(2);
  });

  test("import Excel d'encaissements rapprochés d'une échéance par référence", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const id = await createProjectFromTemplate(page, "Import banque", "Projet vierge");
    await page.goto(`/projets/${id}/finance/echeance`);
    await page.getByLabel("Libellé").fill("Solde");
    await page.getByLabel("Montant HT (€)").fill("2 000");
    await page.getByLabel("Référence facture (outil externe)").fill("FA-77");
    await page.getByRole("button", { name: "Ajouter l'échéance" }).click();
    await expect(page.getByRole("link", { name: "Solde" })).toBeVisible();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Qonto");
    ws.addRow(["Date opération", "Contrepartie", "Crédit", "Référence", "Transaction ID"]);
    ws.addRow([new Date(Date.UTC(2026, 9, 8)), "Client SA", 2000, "FA-77", `tx-${Date.now()}`]);
    ws.addRow([new Date(Date.UTC(2026, 9, 9)), "Fournisseur", -300, "", `tx2-${Date.now()}`]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    await page.goto("/finance/imports/nouveau");
    await page.getByLabel(/Fichier CSV ou Excel/).setInputFiles({
      name: "qonto.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
    await page.getByRole("button", { name: "Lire le fichier" }).click();
    await expect(page.getByLabel("Type d'import")).toHaveValue("ENCAISSEMENTS");
    await page.getByLabel("Projet concerné").selectOption(id);
    await page.getByRole("button", { name: "Valider et prévisualiser" }).click();
    await expect(page.getByText("Rapprochée de l'échéance « Solde »")).toBeVisible();
    await expect(page.getByText(/un débit n'est pas un encaissement/)).toBeVisible();
    await page.getByLabel(/Je confirme l'import de 1 ligne/).check();
    await page.getByRole("button", { name: "Confirmer l'import" }).click();
    await expect(page.getByText(/1 encaissement\(s\) rapproché\(s\)/)).toBeVisible();

    await page.goto(`/projets/${id}?onglet=finance`);
    await expect(page.getByText("Encaissé", { exact: true }).first()).toBeVisible();
  });

  test("contrat récurrent : MRR contracté et cockpit agence", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const client = `Client MRR ${Date.now().toString(36)}`;
    await page.goto("/crm/clients/nouveau");
    await page.getByLabel("Entreprise").fill(client);
    await page.getByRole("button", { name: "Créer l'entreprise" }).click();
    await expect(page.getByRole("heading", { level: 1, name: client })).toBeVisible();

    const before = await withDb(async (c) =>
      Number(
        (
          await c.query(
            `select coalesce(sum("monthlyAmount"),0)::text s from recurring_contract where status='ACTIF' and "startDate" <= current_date and ("endDate" is null or "endDate" >= current_date)`,
          )
        ).rows[0].s,
      ),
    );
    await page.goto("/finance/contrats/nouveau");
    await page.getByLabel("Libellé").fill("Community management");
    await page.getByLabel("Client").selectOption({ label: client });
    await page.getByLabel("Montant mensuel HT (€)").fill("1 500");
    await page.getByLabel("Début").fill("2026-01-01");
    await page.getByRole("button", { name: "Ajouter le contrat" }).click();
    await expect(page.getByRole("link", { name: "Community management" }).first()).toBeVisible();
    const expected = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
      before + 1500,
    );
    await expect(page.getByTestId("mrr")).toHaveText(expected);

    await page.goto("/cockpit?periode=mois&equipe=1");
    await expect(page.getByRole("heading", { name: "Cockpit agence" })).toBeVisible();
    await expect(page.getByText("MRR contracté")).toBeVisible();
    await expect(page.getByText("Encaissements")).toBeVisible();
    await expect(page.getByText("réalisé").first()).toBeVisible();
  });
});
