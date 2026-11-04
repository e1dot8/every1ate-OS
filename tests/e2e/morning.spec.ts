import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

/** Jour de Paris (AAAA-MM-JJ), comme `todayDate()` côté application. */
const parisToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const TITLE = "Le point du matin de recette";
const SUMMARY = "2 terminées hier · 3 pour aujourd'hui · 1 en retard · 1 bloqué";

/**
 * Point fictif du jour, identique d'un navigateur à l'autre (les projets mobile et ordinateur
 * l'écrivent en parallèle sans se gêner). Il remplace le point éventuellement publié dans la
 * base de test.
 */
function fixedReport(date: string) {
  const item = (id: string, title: string, href: string, extra: Record<string, string> = {}) => ({
    id,
    title,
    href,
    ...extra,
  });
  return {
    version: 1,
    date,
    title: TITLE,
    since: "hier",
    summary: SUMMARY,
    counts: { done: 2, delivered: 0, today: 3, late: 1, blocked: 1 },
    sections: [
      {
        key: "hier",
        title: "Hier",
        empty: "Rien de terminé.",
        lists: [
          {
            key: "taches-terminees",
            label: "Tâches terminées",
            total: 2,
            items: [
              item("e2e-point-t1", "Tournage recette du point", "/taches/e2e-point-t1", {
                context: "Projet recette",
              }),
              item("e2e-point-t2", "Montage recette du point", "/taches/e2e-point-t2", {
                context: "Projet recette",
              }),
            ],
          },
        ],
      },
      { key: "aujourdhui", title: "Aujourd'hui", empty: "Rien de prévu aujourd'hui.", lists: [] },
      {
        key: "surveiller",
        title: "À surveiller",
        empty: "Rien en retard, rien de bloqué.",
        lists: [
          {
            key: "bloques",
            label: "Bloqué",
            total: 1,
            items: [
              item("e2e-point-l1", "Reel recette bloqué", "/livrables/e2e-point-l1", {
                context: "Livrable · Projet recette",
                detail: "Motif : attente des rushes",
                tone: "warning",
              }),
            ],
          },
        ],
      },
      { key: "semaine", title: "Cette semaine", empty: "Rien d'autre à livrer d'ici dimanche.", lists: [] },
    ],
    projects: {
      total: 1,
      items: [
        {
          id: "e2e-point-p1",
          name: "Projet recette",
          href: "/projets/e2e-point-p1",
          percent: 40,
          tasksDone: 2,
          tasksTotal: 5,
          deliverablesInProgress: 1,
        },
      ],
    },
  };
}

test.describe("point du matin", () => {
  test("aperçu en direct sur /qg/point, sans débordement", async ({ page }) => {
    await activateAssociate(page, "Johan");

    // Vue par défaut : le point du jour s'il est publié, sinon l'horaire et l'aperçu.
    await page.goto("/qg/point");
    await expect(page.getByRole("heading", { level: 1, name: "Le point du matin" })).toBeVisible();
    await expect(
      page.getByText("Publié à 8 h, du lundi au vendredi").or(page.getByText(/^Publié le .+\.$/)),
    ).toBeVisible();

    await page.goto("/qg/point?vue=apercu");
    await expect(page.getByRole("status").filter({ hasText: "Aperçu en direct" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Points du matin" })
        .getByRole("link", { name: "Aperçu en direct" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("list", { name: "En chiffres" }).getByRole("listitem")).toHaveCount(4);
    for (const name of [
      /^(Hier|Depuis )/,
      /^Aujourd'hui/,
      /^À surveiller/,
      /^Projets actifs/,
      /^Cette semaine/,
    ])
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Un jour sans point : message clair, pas d'erreur.
    await page.goto("/qg/point?date=2001-01-01");
    await expect(page.getByText(/Aucun point publié le lundi 1 janvier 2001\./)).toBeVisible();
  });

  test("le point du jour s'affiche sur /qg/point et dans l'encart de l'accueil", async ({ page }) => {
    const today = parisToday();
    await withDb((c) =>
      c.query(
        `insert into morning_report (id, date, data, "createdAt") values ($1, $2::date, $3::jsonb, now())
         on conflict (date) do update set data = excluded.data`,
        [`mr_e2e_${today}`, today, JSON.stringify(fixedReport(today))],
      ),
    );
    await activateAssociate(page, "Charles");

    // Accueil (QG) : encart compact avec le résumé chiffré.
    const banner = page.getByRole("region", { name: "Le point du matin" });
    await expect(banner.getByTestId("point-matin-resume")).toHaveText(SUMMARY);
    await expectNoHorizontalOverflow(page);
    await banner.getByRole("link", { name: "Lire le point du matin" }).click();

    await expect(page).toHaveURL(/\/qg\/point$/);
    await expect(page.getByText(TITLE, { exact: true })).toBeVisible();
    await expect(page.getByTestId("point-resume")).toHaveText(SUMMARY);
    await expect(
      page.getByRole("navigation", { name: "Points du matin" }).getByRole("link", { name: "Aujourd'hui" }),
    ).toHaveAttribute("aria-current", "page");
    // Éléments cliquables vers l'objet ; le blocage porte sur l'objet, avec son motif.
    await expect(page.getByRole("link", { name: /Tournage recette du point/ })).toHaveAttribute(
      "href",
      "/taches/e2e-point-t1",
    );
    const blocked = page.getByRole("list", { name: "Bloqué" });
    await expect(blocked.getByRole("link", { name: /Reel recette bloqué/ })).toHaveAttribute(
      "href",
      "/livrables/e2e-point-l1",
    );
    await expect(blocked.getByText("Motif : attente des rushes")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Avancement de Projet recette" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    await expect(page.getByText("Rien de prévu aujourd'hui.")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Même point par sa date.
    await page.goto(`/qg/point?date=${today}`);
    await expect(page.getByTestId("point-resume")).toHaveText(SUMMARY);
  });
});
