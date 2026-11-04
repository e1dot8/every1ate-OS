import { expect, test } from "@playwright/test";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";
import {
  assignTasks,
  projectTaskIds,
  renameTask,
  setTaskStatus,
  taskRow,
  uniqueName,
  userIdByEmail,
  wipLimit,
} from "./support/qg";

test.describe("QG", () => {
  test("l'accueil est le QG : sections présentes, sans débordement sur mobile", async ({ page }) => {
    await activateAssociate(page, "Johan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Johan");
    await expect(page.getByRole("heading", { level: 2, name: "Aujourd'hui", exact: true })).toBeVisible();
    for (const name of [
      /^Mon bureau/,
      /^Passations/,
      /^L'équipe aujourd'hui/,
      /^À prendre/,
      /^Quêtes de la semaine/,
    ])
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    const desk = page.getByRole("region", { name: "Mon bureau" });
    await expect(desk.getByText(/^0\/\d+ places$/)).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Finir 8 tâches ensemble" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Stand-up" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("bureau plein : la tâche de trop est refusée, puis acceptée avec un motif visible de tous", async ({
    page,
  }) => {
    const name = uniqueName("Lou");
    const { email } = await activateAssociate(page, name);
    const projectId = await createProjectFromTemplate(page, uniqueName("Bureau plein "));
    const limit = await wipLimit();
    const ids = await projectTaskIds(projectId);
    expect(ids.length).toBeGreaterThan(limit);
    const desk = ids.slice(0, limit);
    const extra = ids[limit];
    await assignTasks([...desk, extra], await userIdByEmail(email));
    await setTaskStatus(desk, "EN_COURS");

    await page.goto(`/taches/${extra}`);
    await page.locator("label", { hasText: "En cours" }).click();
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText(`Bureau plein (${limit}/${limit})`, { exact: false })).toBeVisible();
    expect((await taskRow(extra)).status).toBe("A_FAIRE");

    const motif = "Urgence client : tournage demain";
    await page.getByLabel("Motif de dépassement (visible de tous)").fill(motif);
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Statut mis à jour. Motif de dépassement visible de tous.")).toBeVisible();
    await expect
      .poll(async () => taskRow(extra))
      .toMatchObject({ status: "EN_COURS", wipOverrideReason: motif });

    await page.goto("/");
    const region = page.getByRole("region", { name: "Mon bureau" });
    await expect(region.getByText(`${limit + 1}/${limit} places`)).toBeVisible();
    await expect(region.getByText(`Motif de dépassement : ${motif}`)).toBeVisible();
    await expect(
      region.getByText("Bureau plein : terminez ou passez une tâche avant d'en commencer une autre"),
    ).toBeVisible();
  });

  test("passation d'une tâche entre deux associés : proposée puis acceptée", async ({ browser }) => {
    const first = await browser.newContext();
    const second = await browser.newContext();
    try {
      const pj = await first.newPage();
      const pp = await second.newPage();
      const giver = uniqueName("Jo");
      const taker = uniqueName("Pi");
      const { email } = await activateAssociate(pj, giver);
      const takerAccount = await activateAssociate(pp, taker);
      const projectId = await createProjectFromTemplate(pj, uniqueName("Passation "));
      const [taskId] = await projectTaskIds(projectId);
      const title = uniqueName("Montage v2 ");
      await renameTask(taskId, title);
      await assignTasks([taskId], await userIdByEmail(email));

      await pj.goto(`/taches/${taskId}`);
      await pj.getByLabel("Passer à").selectOption({ label: taker });
      await pj.getByLabel("Note de contexte (facultatif)").fill("Rushes dans le Drive, reste l'étalonnage.");
      await pj.getByRole("button", { name: "Proposer la passation" }).click();
      await expect(pj.getByText(`${giver} propose cette tâche à ${taker}.`, { exact: false })).toBeVisible();
      // Rien ne change de main avant l'acceptation.
      expect((await taskRow(taskId)).ownerId).toBe(await userIdByEmail(email));

      await pp.goto("/");
      const row = pp
        .getByRole("region", { name: /^Passations/ })
        .getByRole("listitem")
        .filter({ hasText: title });
      await expect(row).toBeVisible();
      await expect(row.getByText("« Rushes dans le Drive, reste l'étalonnage. »")).toBeVisible();
      await row.getByRole("button", { name: "Accepter" }).click();
      await expect(row).toHaveCount(0);
      const takerId = await userIdByEmail(takerAccount.email);
      await expect.poll(async () => (await taskRow(taskId)).ownerId).toBe(takerId);

      await pj.goto(`/taches/${taskId}`);
      await expect(pj.getByText("Passation : Rushes dans le Drive, reste l'étalonnage.")).toBeVisible();
      await expect(pj.getByText("a accepté une passation")).toBeVisible();
    } finally {
      await first.close();
      await second.close();
    }
  });

  test("stand-up publié, visible sur le QG", async ({ page }) => {
    const name = uniqueName("Sam");
    await activateAssociate(page, name);
    await page.goto("/qg/standup");
    await expect(page.getByRole("heading", { level: 1, name: "Stand-up" })).toBeVisible();
    const today = uniqueName("Montage du teaser ");
    await page.getByLabel("Aujourd'hui", { exact: true }).fill(today);
    const blocked = uniqueName("Attente des rushes client ");
    await page.getByLabel("Bloqué", { exact: true }).fill(blocked);
    await page.getByRole("button", { name: "Publier mon stand-up" }).click();
    await expect(page.getByText("Stand-up publié.")).toBeVisible();
    await expect(page.getByRole("region", { name: /^Stand-ups du jour/ }).getByText(today)).toBeVisible();

    await page.goto("/");
    const team = page.getByRole("region", { name: "L'équipe aujourd'hui" });
    await expect(team.getByText(today)).toBeVisible();
    await expect(team.getByText(blocked)).toBeVisible();
  });

  test("présence : statut choisi depuis la barre du haut, sans historique", async ({ page }) => {
    await activateAssociate(page, uniqueName("Eva"));
    await page.getByRole("button", { name: /^Ma présence : Disponible/ }).click();
    await page.getByRole("radio", { name: "En focus 25 min" }).check();
    await page.getByLabel("Note courte (facultatif)").fill("Montage teaser");
    await page.getByRole("button", { name: "Partager mon statut" }).click();
    await expect(page.getByRole("button", { name: /^Ma présence : En focus · jusqu'à/ })).toBeVisible();
    await expect(page.getByTestId("ma-presence")).toHaveText(/^En focus · jusqu'à \d{2}:\d{2}$/);

    await page.getByRole("button", { name: /^Ma présence/ }).click();
    await page.getByRole("radio", { name: "Disponible" }).check();
    await page.getByRole("button", { name: "Partager mon statut" }).click();
    await expect(page.getByTestId("ma-presence")).toHaveText("Disponible");
  });

  test("« Je la prends » : une tâche sans responsable devient la mienne", async ({ page }) => {
    const name = uniqueName("Noa");
    const { email } = await activateAssociate(page, name);
    const projectId = await createProjectFromTemplate(page, uniqueName("Tas "));
    const [taskId] = await projectTaskIds(projectId);
    const title = uniqueName("Sous-titrage teaser ");
    // Échéance très ancienne : la tâche arrive en tête de « À prendre ».
    await renameTask(taskId, title, "2000-01-01");

    await page.goto("/");
    const row = page
      .getByRole("region", { name: /^À prendre/ })
      .getByRole("listitem")
      .filter({ hasText: title });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Je la prends" }).click();
    await expect(row).toHaveCount(0);
    await expect.poll(async () => (await taskRow(taskId)).ownerId).toBe(await userIdByEmail(email));
  });
});
