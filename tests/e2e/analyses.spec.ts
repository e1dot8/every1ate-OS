import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

/** Suffixe unique (minuscules et chiffres) : la base de test est partagée entre les tests. */
const tag = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const id = (prefix: string) => `${prefix}_e2e_${randomBytes(8).toString("hex")}`;

/** Année en cours à Paris (celle que la page affiche par défaut). */
const currentYear = () =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric" }).format(new Date()));

async function userIdByEmail(email: string): Promise<string> {
  return withDb(async (c) => {
    const { rows } = await c.query(`select id from "user" where email = $1`, [email]);
    return rows[0].id as string;
  });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function insertProject(
  ownerId: string,
  p: {
    name: string;
    status: "ACTIF" | "TERMINE";
    clientId?: string;
    startDate?: string;
    satisfaction?: number;
  },
): Promise<string> {
  const projectId = id("prj");
  await withDb((c) =>
    c.query(
      `insert into project (id, name, "ownerId", status, "clientId", "startDate", "closedAt", "clientSatisfaction", "createdById", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $3, now())`,
      [
        projectId,
        p.name,
        ownerId,
        p.status,
        p.clientId ?? null,
        p.startDate ?? null,
        p.status === "TERMINE" ? new Date() : null,
        p.satisfaction ?? null,
      ],
    ),
  );
  return projectId;
}

/**
 * Échéance facturée et entièrement encaissée le même jour : comptée dans le CA, sans apparaître
 * comme facture en retard ni comme encaissement attendu pour les autres tests.
 */
async function insertInvoiced(projectId: string, createdById: string, amount: string, date: string) {
  const billingId = id("bil");
  await withDb(async (c) => {
    await c.query(
      `insert into billing_milestone (id, "projectId", label, amount, status, "plannedDate", "invoicedAt", "updatedAt")
       values ($1, $2, 'Facture e2e', $3, 'FACTURE', $4, $4, now())`,
      [billingId, projectId, amount, date],
    );
    await c.query(
      `insert into payment_record (id, "projectId", "billingMilestoneId", amount, "receivedAt", "createdById")
       values ($1, $2, $3, $4, $5, $6)`,
      [id("pay"), projectId, billingId, amount, date, createdById],
    );
  });
}

/** Coût payé (compté comme engagé) : aucun décaissement à venir dans la trésorerie. */
async function insertPaidCost(projectId: string, createdById: string, amount: string, date: string) {
  await withDb((c) =>
    c.query(
      `insert into cost_item (id, "projectId", description, amount, status, "committedAt", "paidAt", "createdById", "updatedAt")
       values ($1, $2, 'Coût e2e', $3, 'PAYE', $4, $4, $5, now())`,
      [id("cst"), projectId, amount, date, createdById],
    ),
  );
}

test.describe("Analyses financières, objectifs et charge à venir", () => {
  test("objectifs de l'année : saisie validée, jauges sur l'analyse puis sur le cockpit", async ({
    page,
  }) => {
    await activateAssociate(page, "Johan");
    const year = currentYear();

    await page.goto("/finance/analyses");
    await expect(page.getByRole("heading", { level: 1, name: "Finance" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Analyses" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 2, name: `Objectifs ${year}` })).toBeVisible();
    // Définitions de l'avancement écrites sur la page.
    await expect(page.getByText("Comment l'avancement est mesuré")).toBeVisible();
    await expect(page.getByText(/datées dans l'année \(date de facturation/)).toBeVisible();

    const form = page.getByRole("form", { name: "Objectifs annuels" });
    await expect(form.getByLabel("Année")).toHaveValue(String(year));

    // Montant illisible : refusé côté serveur, saisie conservée.
    await form.getByLabel("CA HT objectif (€)").fill("beaucoup");
    await form.getByLabel("Marge HT objectif (€)").fill("80 000");
    await form.getByRole("button", { name: "Enregistrer les objectifs" }).click();
    await expect(form.getByText("Montant invalide (ex. 250 000).")).toBeVisible();
    await expect(form.getByLabel("CA HT objectif (€)")).toHaveValue("beaucoup");
    await expect(form.getByLabel("Marge HT objectif (€)")).toHaveValue("80 000");

    // Mêmes valeurs sur ordinateur et mobile : l'objectif de l'année est partagé par toute l'agence.
    await form.getByLabel("CA HT objectif (€)").fill("250 000");
    await form.getByLabel("Marge HT objectif (€)").fill("80 000");
    await form.getByLabel("Nombre de projets").fill("12");
    await form.getByRole("button", { name: "Enregistrer les objectifs" }).click();
    await expect(form.getByText(`Objectifs ${year} enregistrés.`)).toBeVisible();

    const gauges = page.getByRole("list", { name: `Avancement des objectifs ${year}` });
    await expect(gauges.getByRole("progressbar", { name: "CA facturé HT" })).toHaveAttribute(
      "aria-valuetext",
      /% de l'objectif : .* sur 250\s000\s€$/,
    );
    await expect(gauges.getByRole("progressbar", { name: "Marge HT" })).toHaveAttribute(
      "aria-valuetext",
      /sur 80\s000\s€$/,
    );
    await expect(gauges.getByRole("progressbar", { name: "Projets démarrés" })).toHaveAttribute(
      "aria-valuetext",
      /sur 12$/,
    );
    await expect(gauges).toContainText(/\/\s250\s000\s€/);
    await expect(page.getByText(/^Trait rouge :/)).toBeVisible();
    await noHorizontalScroll(page);

    const audited = await withDb(
      async (c) =>
        (
          await c.query(
            `select count(*)::int as n from audit_event where action = 'finance.objective' and "targetId" = $1`,
            [String(year)],
          )
        ).rows[0].n as number,
    );
    expect(audited).toBeGreaterThanOrEqual(1);

    await page.goto("/cockpit");
    await expect(page.getByRole("heading", { level: 2, name: `Objectifs ${year}` })).toBeVisible();
    const cockpitGauges = page.getByRole("list", { name: `Avancement des objectifs ${year}` });
    await expect(cockpitGauges.getByRole("progressbar", { name: "CA facturé HT" })).toHaveAttribute(
      "aria-valuetext",
      /sur 250\s000\s€$/,
    );
    await expect(cockpitGauges.getByRole("progressbar", { name: "Projets démarrés" })).toBeVisible();
    await expect(cockpitGauges).toContainText(/\/\s80\s000\s€/);
    await expect(page.getByRole("link", { name: "Modifier les objectifs" })).toHaveAttribute(
      "href",
      "/finance/analyses#objectifs",
    );
    await noHorizontalScroll(page);
  });

  test("rentabilité : tableaux par modèle et par client, portée et année", async ({ page }) => {
    const { email } = await activateAssociate(page, "Pierre");
    const userId = await userIdByEmail(email);
    const year = currentYear();
    const day = `${year}-01-20`;
    const client = `Client rentable ${tag()}`;
    const clientId = id("cli");
    await withDb((c) =>
      c.query(`insert into client (id, name, "updatedAt") values ($1, $2, now())`, [clientId, client]),
    );
    // Clôturé cette année : 10 000 € facturés, 4 000 € de coûts (payés), satisfaction 4/5.
    const closed = await insertProject(userId, {
      name: `Rentable clos ${tag()}`,
      status: "TERMINE",
      clientId,
      startDate: day,
      satisfaction: 4,
    });
    await insertInvoiced(closed, userId, "10000.00", day);
    await insertPaidCost(closed, userId, "4000.00", day);
    // En cours, démarré cette année : 5 000 € facturés, pris en compte seulement avec « tous ».
    const running = await insertProject(userId, {
      name: `Rentable en cours ${tag()}`,
      status: "ACTIF",
      clientId,
      startDate: day,
    });
    await insertInvoiced(running, userId, "5000.00", day);

    await page.goto("/finance/analyses");
    await expect(page.getByRole("heading", { level: 2, name: `Rentabilité ${year}` })).toBeVisible();
    await expect(page.getByText("Comment sont calculés ces chiffres.")).toBeVisible();

    const byTemplate = page.getByRole("region", { name: "Par modèle de projet" });
    await expect(byTemplate.getByRole("columnheader", { name: "Taux de marge" })).toBeVisible();
    await expect(byTemplate.getByRole("rowheader", { name: "Sans modèle" })).toBeVisible();

    const byClient = page.getByRole("region", { name: "Par client" });
    for (const header of ["Projets", "Revenus", "Marge", "Taux de marge", "Satisfaction", "Temps passé"])
      await expect(byClient.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
    let row = byClient.getByRole("row").filter({ has: page.getByRole("rowheader", { name: client }) });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell", { name: "1", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: /^10\s000\s€$/ })).toBeVisible();
    await expect(row.getByRole("cell", { name: /^6\s000\s€$/ }).first()).toBeVisible();
    await expect(row.getByRole("cell", { name: /^60 %$/ })).toBeVisible();
    await expect(row).toContainText("4/5");
    await expect(row).toContainText("1 avis");
    await noHorizontalScroll(page);

    // Terminés et en cours : le projet en cours s'ajoute (marge provisoire).
    await page
      .getByRole("group", { name: "Projets pris en compte" })
      .getByRole("link", { name: "Terminés et en cours" })
      .click();
    await expect(page).toHaveURL(/\/finance\/analyses\?portee=tous$/);
    await expect(page.getByText(/sa marge est provisoire/)).toBeVisible();
    row = byClient.getByRole("row").filter({ has: page.getByRole("rowheader", { name: client }) });
    await expect(row.getByRole("cell", { name: "2", exact: true })).toBeVisible();
    await expect(row.getByRole("cell", { name: /^15\s000\s€$/ })).toBeVisible();
    await expect(row.getByRole("cell", { name: /^11\s000\s€$/ }).first()).toBeVisible();

    // Année suivante, projets terminés : rien n'est clôturé pour ce client.
    await page
      .getByRole("group", { name: "Projets pris en compte" })
      .getByRole("link", { name: "Terminés dans l'année" })
      .click();
    await expect(page).toHaveURL(/\/finance\/analyses$/);
    await page
      .getByRole("group", { name: "Année" })
      .getByRole("link", { name: String(year + 1), exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/finance/analyses\\?annee=${year + 1}$`));
    await expect(page.getByRole("heading", { level: 2, name: `Rentabilité ${year + 1}` })).toBeVisible();
    await expect(page.getByRole("form", { name: "Objectifs annuels" }).getByLabel("Année")).toHaveValue(
      String(year + 1),
    );
    await expect(byClient).toBeVisible();
    await expect(byClient.getByRole("rowheader", { name: client })).toHaveCount(0);
  });

  test("charge à venir : % de la capacité par semaine, surcharge et non planifié sur le cockpit", async ({
    page,
  }) => {
    const name = `Charge${tag()}`;
    const { email } = await activateAssociate(page, name);
    const userId = await userIdByEmail(email);
    await withDb((c) => c.query(`update "user" set "weeklyCapacityHours" = 10 where id = $1`, [userId]));
    const projectId = await insertProject(userId, { name: `Charge projet ${tag()}`, status: "ACTIF" });
    await withDb(async (c) => {
      const insert = `insert into task (id, "projectId", title, "ownerId", "estimatedMinutes", "dueDate", "createdById", "updatedAt")
                      values ($1, $2, $3, $4, $5, $6, $4, now())`;
      // En retard : 12 h restantes pèsent sur la semaine en cours (120 % de 10 h).
      await c.query(insert, [id("tsk"), projectId, "Montage en retard", userId, 720, "2025-12-01"]);
      // Estimée sans échéance : non planifiée.
      await c.query(insert, [id("tsk"), projectId, "Recherche sans date", userId, 150, null]);
    });

    await page.goto("/cockpit");
    await expect(page.getByRole("heading", { level: 2, name: "Charge à venir (6 semaines)" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Régler les capacités" })).toHaveAttribute(
      "href",
      "/plus/reglages",
    );
    const grid = page.getByRole("region", { name: "Charge à venir par associé" });
    await expect(grid.getByRole("columnheader", { name: "Non planifié" })).toBeVisible();
    await expect(grid.getByRole("columnheader", { name: /^Semaine du / })).toHaveCount(6);
    const row = grid.getByRole("row").filter({ has: page.getByRole("rowheader", { name: name }) });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("10 h/sem.");
    await expect(row.getByRole("cell").first()).toContainText("120 %");
    await expect(row.getByRole("cell").first()).toContainText("surchargé");
    await expect(row.getByRole("cell").nth(1)).toHaveText(/^0 %/);
    await expect(row.getByRole("cell").last()).toHaveText("2 h 30");
    await noHorizontalScroll(page);
  });
});
