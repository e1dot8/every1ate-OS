import { expect, test, type Locator } from "@playwright/test";
import { auditActions } from "./support/db";
import { activateAssociate } from "./support/flows";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const euros = (s: string) => new RegExp(s.replace(/ /g, "\\s"));

/** Date calendrier à Paris (AAAA-MM-JJ), décalée de n jours. */
function parisDay(offsetDays = 0) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Déplie la semaine n (0 = S+1) si elle est repliée. Avec cacheComponents, Next.js garde les
 * pages quittées dans une <Activity> masquée : au retour, un <details> déjà ouvert le reste,
 * et un clic aveugle le refermerait.
 */
async function openWeek(weeks: Locator, index: number) {
  const details = weeks.locator(":scope > li").nth(index).locator("details");
  if (!(await details.evaluate((el) => (el as HTMLDetailsElement).open)))
    await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
}

const cents = (locator: Locator) => async () => Number(await locator.getAttribute("data-cents"));

test.describe("trésorerie 13 semaines", () => {
  test("solde bancaire, charge fixe mensuelle visible dans la liste et dans la prévision, puis archivée", async ({
    page,
  }) => {
    const { email } = await activateAssociate(page, "Pierre");
    await page.goto("/finance/tresorerie");
    await expect(page.getByRole("heading", { level: 1, name: "Finance" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Trésorerie" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("img", { name: /Prévision de trésorerie sur 13 semaines/ })).toBeVisible();

    // Solde bancaire : validation, puis saisie (même valeur sur mobile et ordinateur, base partagée).
    await page.getByLabel("Solde bancaire (€)").fill("vingt mille");
    await page.getByRole("button", { name: "Enregistrer le solde" }).click();
    await expect(page.getByText("Montant invalide (ex. 24 500,00 ou -1 200).")).toBeVisible();
    await page.getByLabel("Solde bancaire (€)").fill("25 000");
    await expect(page.getByLabel("au", { exact: true })).toHaveValue(parisDay());
    await page.getByRole("button", { name: "Enregistrer le solde" }).click();
    await expect(page.getByText("Solde bancaire enregistré.")).toBeVisible();
    await expect(page.getByTestId("kpi-Solde de départ")).toContainText(euros("25 000 €"));
    await expect(page.getByText("Aucun solde bancaire saisi.")).toHaveCount(0);

    // Charge fixe mensuelle : prochaine échéance dans 7 jours → semaine S+2.
    const label = unique("Loyer atelier");
    await page.getByRole("link", { name: "Ajouter une charge" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nouvelle charge fixe" })).toBeVisible();
    await page.getByLabel("Libellé").fill(label);
    await page.getByLabel("Catégorie (facultatif)").fill("Loyer");
    await page.getByLabel("Montant (€)").fill("0");
    await page.getByLabel("Fréquence").selectOption("MENSUELLE");
    await page.getByLabel("Prochaine échéance").fill(parisDay(7));
    await page.getByLabel("Fin (facultatif)").fill(parisDay(1));
    await page.getByRole("button", { name: "Ajouter la charge" }).click();
    await expect(page.getByText("Le montant doit être supérieur à 0.")).toBeVisible();
    await expect(page.getByLabel("Libellé")).toHaveValue(label);
    await page.getByLabel("Montant (€)").fill("4 321");
    await page.getByRole("button", { name: "Ajouter la charge" }).click();
    await expect(page.getByText("La fin ne peut pas précéder la prochaine échéance.")).toBeVisible();
    await page.getByLabel("Fin (facultatif)").fill("");
    await page.getByRole("button", { name: "Ajouter la charge" }).click();
    await expect(page).toHaveURL(/\/finance\/tresorerie$/);

    const charges = page.getByRole("list", { name: "Charges fixes" });
    await expect(charges.getByRole("link", { name: label })).toBeVisible();
    await expect(charges.getByRole("listitem").filter({ hasText: label })).toContainText(euros("4 321,00 €"));
    await expect.poll(cents(page.getByTestId("charges-monthly-total"))).toBeGreaterThanOrEqual(432_100);
    // 3 échéances mensuelles dans l'horizon (J+7, J+7 + 1 mois, J+7 + 2 mois).
    await expect
      .poll(cents(page.getByTestId("kpi-Décaissements 13 sem.")))
      .toBeGreaterThanOrEqual(3 * 432_100);

    const weeks = page.getByRole("list", { name: "Détail par semaine" });
    const week2 = weeks.locator(":scope > li").nth(1);
    await expect(week2).toContainText("S+2");
    await openWeek(weeks, 1);
    const moves = week2.getByRole("list", { name: "Mouvements de la semaine S+2" });
    const row = moves.getByRole("listitem").filter({ hasText: label });
    await expect(row.getByRole("link", { name: label })).toBeVisible();
    await expect(row).toContainText("Charge fixe");
    await expect(row).toContainText(euros("−4 321,00 €"));

    // Modification : la prévision suit.
    await charges.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
    await expect(page.getByLabel("Montant (€)")).toHaveValue("4321,00");
    await page.getByLabel("Montant (€)").fill("4 400");
    await page.getByRole("button", { name: "Enregistrer la charge" }).click();
    await expect(page).toHaveURL(/\/finance\/tresorerie$/);
    await openWeek(weeks, 1);
    await expect(
      weeks
        .getByRole("list", { name: "Mouvements de la semaine S+2" })
        .getByRole("listitem")
        .filter({ hasText: label }),
    ).toContainText(euros("−4 400,00 €"));

    // Archivage : la charge sort de la liste et de la prévision.
    await page.getByRole("list", { name: "Charges fixes" }).getByRole("link", { name: label }).click();
    await page.getByText("Archiver cette charge").click();
    await page.getByRole("button", { name: "Confirmer l'archivage" }).click();
    await expect(page).toHaveURL(/\/finance\/tresorerie$/);
    await expect(page.getByRole("heading", { level: 2, name: "Charges fixes" })).toBeVisible();
    // Portée limitée à la page visible : la fiche quittée reste dans le DOM (Activity masquée).
    await expect(page.getByRole("list", { name: "Charges fixes" }).getByText(label)).toHaveCount(0);
    await expect(weeks.getByText(label)).toHaveCount(0);

    const actions = await auditActions({ actorEmail: email });
    expect(actions).toEqual(
      expect.arrayContaining([
        "finance.cash_balance_updated",
        "finance.recurring_charge_created",
        "finance.recurring_charge_updated",
        "finance.recurring_charge_archived",
      ]),
    );
  });
});
