import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

type Row = { id: string; due: string | null; next: string | null; status: string; recurrence: string };

const occurrences = (projectId: string, title: string) =>
  withDb(
    async (c) =>
      (
        await c.query(
          `select id, "dueDate"::text as due, "nextOccurrenceId" as next, status::text, recurrence::text
             from task where "projectId" = $1 and title = $2 order by "createdAt"`,
          [projectId, title],
        )
      ).rows as Row[],
  );

test.describe("tâches récurrentes", () => {
  test("une tâche hebdomadaire terminée crée l'occurrence suivante (+7 jours), une seule fois", async ({
    page,
  }) => {
    await activateAssociate(page, "Pierre");
    const projectId = await createProjectFromTemplate(page, unique("Studio récurrent"), "Projet vierge");
    const title = unique("Point hebdo");

    await page.goto(`/projets/${projectId}/taches/nouvelle`);
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Répétition").selectOption({ label: "Chaque semaine" });
    await expect(page.getByLabel("Jusqu'au")).toBeVisible();

    // Validation serveur : une tâche répétée a une échéance ; la saisie est conservée.
    await page.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(page.getByText("Une tâche répétée a besoin d'une échéance.")).toBeVisible();
    await expect(page.getByLabel("Titre")).toHaveValue(title);
    await expect(page.getByLabel("Répétition")).toHaveValue("HEBDOMADAIRE");

    await page.getByLabel("Échéance").fill("2026-12-01");
    await page.getByLabel("Jusqu'au").fill("2026-11-30");
    await page.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(page.getByText("« Jusqu'au » ne peut pas précéder l'échéance.")).toBeVisible();
    await expect(page.getByLabel("Échéance")).toHaveValue("2026-12-01");

    await page.getByLabel("Jusqu'au").fill("2027-03-31");
    await page.getByRole("button", { name: "Créer la tâche" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const firstId = page.url().split("/taches/")[1];
    await expect(
      page.getByText(/Répète chaque semaine jusqu'au 31 mars/).filter({ visible: true }),
    ).toBeVisible();

    // Terminer la tâche crée l'occurrence suivante, une semaine plus tard.
    await page.locator("label", { hasText: "Terminé" }).click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText(/Prochaine occurrence créée pour le 8 déc\./)).toBeVisible();
    const nextLink = page
      .getByRole("navigation", { name: "Occurrences de la tâche" })
      .getByRole("link", { name: /Occurrence suivante/ });
    await expect(nextLink).toContainText("8 déc.");

    await nextLink.click();
    await expect(page).not.toHaveURL(new RegExp(`/taches/${firstId}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const secondId = page.url().split("/taches/")[1];
    await expect(
      page.getByText(/Répète chaque semaine jusqu'au 31 mars/).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Occurrence précédente/ }).filter({ visible: true }),
    ).toHaveAttribute("href", `/taches/${firstId}`);

    let rows = await occurrences(projectId, title);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: firstId, due: "2026-12-01", next: secondId, status: "TERMINE" });
    expect(rows[1]).toMatchObject({
      id: secondId,
      due: "2026-12-08",
      next: null,
      status: "A_FAIRE",
      recurrence: "HEBDOMADAIRE",
    });

    // Rouvrir puis terminer à nouveau : aucune seconde occurrence.
    await page.goto(`/taches/${firstId}`);
    await page.locator("label", { hasText: "En cours" }).click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Statut mis à jour.", { exact: true })).toBeVisible();
    // La réouverture a bien eu lieu : la nouvelle clôture passe donc par la garde « une seule fois ».
    await expect
      .poll(async () => (await occurrences(projectId, title)).map((r) => r.status))
      .toEqual(["EN_COURS", "A_FAIRE"]);
    await page.locator("label", { hasText: "Terminé" }).click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect
      .poll(async () => (await occurrences(projectId, title)).map((r) => r.status))
      .toEqual(["TERMINE", "A_FAIRE"]);
    await expect(page.getByText("Statut mis à jour.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Prochaine occurrence créée/)).toHaveCount(0);
    rows = await occurrences(projectId, title);
    expect(rows[0].next).toBe(secondId);
    await expect(page.getByRole("link", { name: /Occurrence suivante/ })).toHaveAttribute(
      "href",
      `/taches/${secondId}`,
    );
  });
});
