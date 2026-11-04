import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { withDb } from "./support/db";
import { createDeliverable } from "./support/deliverables";
import {
  expectNoHorizontalOverflow,
  insertAssociate,
  messageRow,
  postMessage,
  uniqueTag,
} from "./support/discussions";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

/** Première tâche (par position) d'un projet créé depuis un modèle. */
async function firstTask(projectId: string): Promise<{ id: string; title: string }> {
  return withDb(
    async (c) =>
      (
        await c.query(`select id, title from task where "projectId"=$1 order by position limit 1`, [
          projectId,
        ])
      ).rows[0],
  );
}

async function notificationCount(userId: string, kind: string): Promise<number> {
  return withDb(
    async (c) =>
      (
        await c.query(`select count(*)::int n from notification where "userId"=$1 and kind=$2`, [
          userId,
          kind,
        ])
      ).rows[0].n,
  );
}

/** Commente depuis la section « Discussion » de la page ouverte (tâche ou livrable). */
async function comment(page: Page, text: string, options: { alsoInChannel?: boolean } = {}) {
  const discussion = page.locator("#discussion");
  await discussion.getByLabel("Ajouter un commentaire").fill(text);
  if (options.alsoInChannel) await discussion.getByLabel("Aussi envoyer dans le salon du projet").check();
  await discussion.getByRole("button", { name: "Publier" }).click();
  await expect(discussion.getByRole("status").filter({ hasText: "Commentaire publié." })).toBeVisible();
  await expect(messageRow(page, text)).toBeVisible();
}

test.describe("discussions par élément", () => {
  test("commenter une tâche : mention notifiée, responsable prévenu, fil visible dans le salon", async ({
    page,
  }) => {
    await activateAssociate(page, "Charles");
    const tag = uniqueTag();
    const mentioned = `Zoé${tag}`;
    const mentionedId = await insertAssociate(mentioned);
    const ownerId = await insertAssociate(`Owen${tag}`);
    const projectId = await createProjectFromTemplate(page, `Discussion tâche ${tag}`);
    const task = await firstTask(projectId);
    await withDb((c) => c.query(`update task set "ownerId"=$1 where id=$2`, [ownerId, task.id]));

    await page.goto(`/taches/${task.id}`);
    await expect(page.getByRole("heading", { level: 2, name: "Discussion" })).toBeVisible();
    const text = `Bonjour @${mentioned}, la V2 est prête ${tag}`;
    await comment(page, text);
    // La mention est surlignée dans le commentaire.
    await expect(messageRow(page, text).getByText(`@${mentioned}`, { exact: true })).toBeVisible();

    // La personne mentionnée reçoit la mention (et pas une seconde alerte « commentaire »),
    // le responsable de la tâche reçoit l'événement « commentaire ».
    await expect.poll(() => notificationCount(mentionedId, "mention")).toBe(1);
    await expect.poll(() => notificationCount(ownerId, "discussion")).toBe(1);
    expect(await notificationCount(mentionedId, "discussion")).toBe(0);
    const href = await withDb(
      async (c) =>
        (await c.query(`select href from notification where "userId"=$1 and kind='discussion'`, [ownerId]))
          .rows[0].href,
    );
    expect(href).toBe(`/taches/${task.id}#discussion`);

    // Le commentaire est une réponse du fil de la tâche, dans le salon du projet.
    const rows = await withDb(
      async (c) =>
        (
          await c.query(
            `select m."parentId", p."aboutTaskId" as "rootTask", p."authorId" as "rootAuthor"
               from message m join message p on p.id = m."parentId"
              where m."aboutTaskId"=$1 and m.body like $2`,
            [task.id, `%${tag}%`],
          )
        ).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rootTask: task.id, rootAuthor: null });

    // Dans le salon du projet : une ligne « Tâche · Titre » avec le résumé du fil.
    await page.goto(`/discussions?projet=${projectId}`);
    await expect(page).toHaveURL(/\/discussions\/[a-z0-9-]+$/);
    await expect(page.getByRole("link", { name: "Par élément" })).toBeVisible();
    const line = page
      .locator("li[id^='m-']")
      .filter({ has: page.getByRole("link", { name: `Tâche · ${task.title}`, exact: true }) })
      .filter({ visible: true });
    await expect(line).toHaveCount(1);
    await line.getByRole("link", { name: /^1 réponse/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Fil de discussion" })).toBeVisible();
    await expect(messageRow(page, text)).toBeVisible();
    // La ligne mène aussi à la tâche.
    await page.getByRole("link", { name: `Tâche · ${task.title}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/taches/${task.id}#discussion$`));
  });

  test("commenter un livrable ; l'onglet Discussion du projet regroupe les fils par élément", async ({
    page,
  }) => {
    await activateAssociate(page, "Pierre");
    const tag = uniqueTag();
    const projectId = await createProjectFromTemplate(page, `Discussion livrable ${tag}`);
    const task = await firstTask(projectId);
    await page.goto(`/taches/${task.id}`);
    await comment(page, `Point tâche ${tag}`);

    const title = `Reel lancement ${tag}`;
    const deliverableId = await createDeliverable(page, { projectId, title });
    await expect(page.getByRole("heading", { level: 2, name: "Discussion" })).toBeVisible();
    await comment(page, `Montage validé ${tag} https://example.com/v2`, { alsoInChannel: true });
    // Les liens https sont cliquables.
    await expect(
      messageRow(page, `Montage validé ${tag}`).getByRole("link", { name: "https://example.com/v2" }),
    ).toBeVisible();
    const about = await withDb(
      async (c) =>
        (await c.query(`select count(*)::int n from message where "aboutDeliverableId"=$1`, [deliverableId]))
          .rows[0].n,
    );
    expect(about).toBe(2); // racine + commentaire

    // Onglet Discussion : fil général, puis discussions par élément (la plus récente d'abord).
    await page.goto(`/projets/${projectId}?onglet=discussion`);
    await expect(page.getByRole("link", { name: "Discussion", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("heading", { level: 2, name: "Fil du projet" })).toBeVisible();
    const threads = page.getByRole("list", { name: "Discussions par élément" });
    const links = threads.getByRole("link");
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAccessibleName(`Livrable · ${title}`);
    await expect(links.nth(1)).toHaveAccessibleName(`Tâche · ${task.title}`);
    await expect(threads.getByText("1 réponse ·", { exact: false }).first()).toBeVisible();
    // « Aussi envoyer dans le salon du projet » : le commentaire apparaît aussi dans le fil général.
    await expect(messageRow(page, `Montage validé ${tag}`)).toBeVisible();

    // Fil général : un message écrit depuis l'onglet part dans le salon du projet.
    await postMessage(page, `Réunion client jeudi ${tag}`);
    await page.goto(`/discussions?projet=${projectId}`);
    await expect(messageRow(page, `Réunion client jeudi ${tag}`)).toBeVisible();

    // Ancien lien « ?onglet=discussions » conservé.
    await page.goto(`/projets/${projectId}?onglet=discussions`);
    await expect(page.getByRole("heading", { level: 2, name: "Discussions par élément" })).toBeVisible();
  });

  test("modifier son commentaire depuis la page de la tâche", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const tag = uniqueTag();
    const projectId = await createProjectFromTemplate(page, `Discussion modif ${tag}`);
    const task = await firstTask(projectId);
    await page.goto(`/taches/${task.id}`);
    await comment(page, `Première version ${tag}`);
    const row = messageRow(page, `Première version ${tag}`);
    await row.getByRole("button", { name: "Actions du message" }).click();
    await row.getByRole("link", { name: "Modifier" }).click();
    const discussion = page.locator("#discussion");
    await discussion.getByLabel("Modifier le message").fill(`Version corrigée ${tag}`);
    await discussion.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page).toHaveURL(new RegExp(`/taches/${task.id}#m-`));
    await expect(messageRow(page, `Version corrigée ${tag}`)).toContainText("(modifié)");
  });

  test("anciens commentaires de la tâche repris une seule fois dans sa discussion", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const tag = uniqueTag();
    const authorId = await insertAssociate(`Ancien${tag}`);
    const projectId = await createProjectFromTemplate(page, `Reprise ${tag}`);
    const task = await firstTask(projectId);
    const legacyId = `tc${randomBytes(10).toString("hex")}`;
    await withDb((c) =>
      c.query(
        `insert into task_comment (id, "taskId", "authorId", body, "createdAt")
         values ($1, $2, $3, $4, now() - interval '3 days')`,
        [legacyId, task.id, authorId, `Ancien commentaire ${tag}`],
      ),
    );

    await page.goto(`/taches/${task.id}`);
    await expect(messageRow(page, `Ancien commentaire ${tag}`)).toBeVisible();
    await page.reload();
    await expect(messageRow(page, `Ancien commentaire ${tag}`)).toHaveCount(1);
    const moved = await withDb(
      async (c) =>
        (
          await c.query(
            `select tc."movedToMessageId", m."authorId", m."aboutTaskId",
                    (select count(*)::int from message x where x."aboutTaskId"=$2 and x.body=$3) as copies
               from task_comment tc join message m on m.id = tc."movedToMessageId"
              where tc.id=$1`,
            [legacyId, task.id, `Ancien commentaire ${tag}`],
          )
        ).rows[0],
    );
    expect(moved).toMatchObject({ authorId, aboutTaskId: task.id, copies: 1 });
  });

  test("projet archivé : discussions en lecture seule", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const tag = uniqueTag();
    const projectId = await createProjectFromTemplate(page, `Archivé ${tag}`);
    const task = await firstTask(projectId);
    await page.goto(`/taches/${task.id}`);
    await comment(page, `Avant archivage ${tag}`);
    await withDb((c) => c.query(`update project set "archivedAt"=now() where id=$1`, [projectId]));

    await page.goto(`/taches/${task.id}`);
    const discussion = page.locator("#discussion");
    await expect(discussion.getByText("Projet archivé : la discussion est en lecture seule.")).toBeVisible();
    await expect(messageRow(page, `Avant archivage ${tag}`)).toBeVisible();
    await expect(discussion.getByLabel("Ajouter un commentaire")).toHaveCount(0);

    await page.goto(`/projets/${projectId}?onglet=discussion`);
    await expect(page.getByText("Projet archivé : la discussion est en lecture seule.")).toBeVisible();
    await expect(page.getByLabel("Message", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Discussions par élément" }).getByRole("link"),
    ).toHaveAccessibleName(`Tâche · ${task.title}`);

    // Le fil du salon refuse aussi les réponses.
    await page.goto(`/discussions?projet=${projectId}`);
    await page
      .locator("li[id^='m-']")
      .filter({ has: page.getByRole("link", { name: `Tâche · ${task.title}`, exact: true }) })
      .filter({ visible: true })
      .getByRole("link", { name: /^1 réponse/ })
      .click();
    await expect(page.getByText("Projet archivé : la discussion est en lecture seule.")).toBeVisible();
    await expect(page.getByLabel("Réponse", { exact: true })).toHaveCount(0);
  });

  test("pas de défilement horizontal (page de tâche, de livrable, onglet Discussion)", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const tag = uniqueTag();
    const projectId = await createProjectFromTemplate(page, `Largeur ${tag}`);
    const task = await firstTask(projectId);
    await page.goto(`/taches/${task.id}`);
    await comment(
      page,
      `Un commentaire assez long pour tester la largeur de la page ${tag} ${"x".repeat(80)}`,
    );
    await expectNoHorizontalOverflow(page);
    await createDeliverable(page, { projectId, title: `Visuel ${tag}` });
    await expectNoHorizontalOverflow(page);
    await page.goto(`/projets/${projectId}?onglet=discussion`);
    await expect(page.getByRole("heading", { level: 2, name: "Discussions par élément" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto(`/discussions?projet=${projectId}`);
    await expect(page.getByRole("link", { name: `Tâche · ${task.title}`, exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
