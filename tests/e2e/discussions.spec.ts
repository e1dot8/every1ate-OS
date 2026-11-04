import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import {
  expectNoHorizontalOverflow,
  insertAssociate,
  insertPrivateChannel,
  messageRow,
  openMessageMenu,
  postMessage,
  sendMessage,
  uniqueTag,
} from "./support/discussions";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

test.describe("discussions", () => {
  test("poster dans la Salle commune, mentionner, réagir, épingler", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const tag = uniqueTag();
    const mentioned = `Zoé${tag}`;
    const mentionedId = await insertAssociate(mentioned);
    await page.goto("/discussions/general");
    await expect(page.getByRole("heading", { level: 1, name: "Salle commune" })).toBeVisible();

    await sendMessage(page, `Bonjour @${mentioned}, voici le **brief** ${tag}`);
    // Le Markdown léger est rendu en éléments (gras), jamais en HTML injecté.
    const row = messageRow(page, `voici le brief ${tag}`);
    await expect(row.locator("strong", { hasText: "brief" })).toBeVisible();
    // La mention prévient la personne mentionnée (notification dans l'app).
    await expect
      .poll(() =>
        withDb(async (c) => {
          const { rows } = await c.query(
            `select count(*)::int n from notification where "userId"=$1 and kind='mention'`,
            [mentionedId],
          );
          return rows[0].n;
        }),
      )
      .toBe(1);

    // Réagir (bascule) depuis le menu, puis retirer en cliquant la pastille.
    await openMessageMenu(page, `voici le brief ${tag}`);
    await row.getByRole("button", { name: "Réagir avec 👍" }).click();
    const reaction = row.getByRole("button", { name: "Réaction 👍, 1" });
    await expect(reaction).toHaveAttribute("aria-pressed", "true");
    await reaction.click();
    await expect(row.getByRole("button", { name: /Réaction 👍/ })).toHaveCount(0);

    // Épingler : le message est marqué et listé dans « Épinglés ».
    await openMessageMenu(page, `voici le brief ${tag}`);
    await row.getByRole("button", { name: "Épingler", exact: true }).click();
    await expect(row.getByText("Épinglé", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Épinglés \(\d+\)$/)).toBeVisible();
  });

  test("répondre dans un fil, aussi envoyé dans le salon", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const tag = uniqueTag();
    await page.goto("/discussions/general");
    await postMessage(page, `Question du fil ${tag}`);
    await openMessageMenu(page, `Question du fil ${tag}`);
    await messageRow(page, `Question du fil ${tag}`)
      .getByRole("link", { name: "Répondre dans un fil" })
      .click();
    await expect(page).toHaveURL(/\/discussions\/general\/fil\//);
    await expect(page.getByRole("heading", { level: 1, name: "Fil de discussion" })).toBeVisible();

    await page.getByLabel("Réponse", { exact: true }).fill(`Réponse du fil ${tag}`);
    await page.getByLabel("Aussi envoyer dans le salon").check();
    await page.getByRole("button", { name: "Envoyer", exact: true }).click();
    await expect(messageRow(page, `Réponse du fil ${tag}`)).toBeVisible();
    await expect(page.getByText("1 réponse", { exact: true })).toBeVisible();

    await page.goto("/discussions/general");
    await expect(
      messageRow(page, `Question du fil ${tag}`).getByRole("link", { name: /1 réponse/ }),
    ).toBeVisible();
    // « Aussi envoyer dans le salon » : la réponse apparaît aussi dans le salon.
    await expect(messageRow(page, `Réponse du fil ${tag}`)).toBeVisible();
  });

  test("/discussions?projet= ouvre le salon du projet ; /tache y crée une vraie tâche", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const tag = uniqueTag();
    const projectName = `Clip ${tag}`;
    const projectId = await createProjectFromTemplate(page, projectName, "Projet vierge");

    await page.goto(`/discussions?projet=${projectId}`);
    await expect(page).toHaveURL(/\/discussions\/clip-[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: projectName })).toBeVisible();

    await sendMessage(page, "/tache Préparer le moodboard demain");
    await expect(
      page.getByRole("status").filter({ hasText: "Tâche créée : « Préparer le moodboard »." }),
    ).toBeVisible();
    await expect(messageRow(page, "Tâche créée par Pierre : « Préparer le moodboard »")).toBeVisible();
    const task = await withDb(
      async (c) =>
        (
          await c.query(`select title, "dueDate" from task where "projectId"=$1 and title=$2`, [
            projectId,
            "Préparer le moodboard",
          ])
        ).rows[0],
    );
    expect(task?.title).toBe("Préparer le moodboard");
    expect(task?.dueDate).not.toBeNull();

    // Hors salon de projet : réponse explicative, rien n'est créé.
    await page.goto("/discussions/general");
    await sendMessage(page, `/tache Hors projet ${tag}`);
    await expect(page.getByRole("alert").filter({ hasText: "dans le salon d'un projet" })).toBeVisible();
  });

  test("« Transformer en tâche » sur un message", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const tag = uniqueTag();
    const projectId = await createProjectFromTemplate(page, `Teaser ${tag}`, "Projet vierge");
    await page.goto(`/discussions?projet=${projectId}`);
    await expect(page).toHaveURL(/\/discussions\/teaser-/);
    const text = `Monter la bande-annonce ${tag}`;
    await postMessage(page, text);

    await openMessageMenu(page, text);
    await messageRow(page, text).getByRole("link", { name: "Transformer en tâche" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Transformer en tâche" })).toBeVisible();
    await expect(page.getByLabel("Titre de la tâche")).toHaveValue(text);
    await expect(page.getByLabel("Projet", { exact: true })).toHaveValue(projectId);
    await page.getByLabel("Échéance").fill("2026-12-15");
    await page.getByRole("button", { name: "Créer la tâche" }).click();

    await expect(page).toHaveURL(/\/fil\//);
    await expect(page.getByText("Tâche créée et liée au message.")).toBeVisible();
    await expect(messageRow(page, `Tâche créée par Johan : « ${text} »`)).toBeVisible();
    const linked = await withDb(
      async (c) =>
        (
          await c.query(
            `select t.title, t."projectId" from message m join task t on t.id = m."taskId" where m.body = $1`,
            [text],
          )
        ).rows[0],
    );
    expect(linked).toEqual({ title: text, projectId });
  });

  test("message programmé visible dans Programmés, puis annulé", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const tag = uniqueTag();
    await page.goto("/discussions/general");
    await page.getByLabel("Message", { exact: true }).fill(`Message de demain ${tag}`);
    await page.getByText("Programmer", { exact: true }).click();
    const inAMonth = new Date(Date.now() + 30 * 24 * 3600_000).toISOString().slice(0, 10);
    await page.getByLabel("Date et heure d'envoi").fill(`${inAMonth}T10:30`);
    await page.getByRole("button", { name: "Programmer l'envoi" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Message programmé" })).toBeVisible();
    await expect(messageRow(page, `Message de demain ${tag}`)).toHaveCount(0);

    await page.goto("/discussions/programmes");
    const item = page.getByRole("listitem").filter({ hasText: `Message de demain ${tag}` });
    await expect(item).toBeVisible();
    await item.getByRole("button", { name: "Annuler l'envoi" }).click();
    await expect(item).toHaveCount(0);
  });

  test("recherche sans accents, limitée aux salons accessibles", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const tag = uniqueTag();
    await page.goto("/discussions/general");
    await postMessage(page, `Ornithorynque${tag} en été`);
    const other = await insertAssociate(`Yann${tag}`);
    await insertPrivateChannel(other, `Ornithorynque${tag} caché`);

    await page.goto(`/discussions/recherche?q=${encodeURIComponent(`ORNITHORYNQUE${tag} EN ETE`)}`);
    const results = page.getByRole("list", { name: "Messages trouvés" });
    await expect(results.getByRole("link", { name: new RegExp(`Ornithorynque${tag} en été`) })).toBeVisible();

    await page.goto(`/discussions/recherche?q=Ornithorynque${tag}`);
    await expect(page.getByRole("list", { name: "Messages trouvés" }).getByRole("listitem")).toHaveCount(1);
    await expect(page.getByText(`Secret Ornithorynque${tag} caché`)).toHaveCount(0);
  });

  test("le salon privé d'un autre associé est introuvable", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const tag = uniqueTag();
    const other = await insertAssociate(`Ines${tag}`);
    const slug = await insertPrivateChannel(other, `Direction ${tag}`);
    await page.goto(`/discussions/${slug}`);
    await expect(page.getByRole("heading", { name: `Direction ${tag}` })).toHaveCount(0);
    await expect(page.getByText(/introuvable/i).first()).toBeVisible();
    await expect(page.getByText(`Secret Direction ${tag}`)).toHaveCount(0);
    // Le fil et les réglages du salon sont refusés de la même façon.
    await page.goto(`/discussions/${slug}/reglages`);
    await expect(page.getByText(/introuvable/i).first()).toBeVisible();
  });

  test("message direct : créé à la demande, statut de focus annoncé sans « vu à »", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const tag = uniqueTag();
    const name = `Paul${tag}`;
    const other = await insertAssociate(name);
    await withDb((c) =>
      c.query(
        `update "user" set "presenceState"='FOCUS', "presenceUntil"=now() + interval '1 hour' where id=$1`,
        [other],
      ),
    );
    await page.goto(`/discussions/direct/${other}`);
    await expect(page).toHaveURL(/\/discussions\/dm-/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(
      page.getByText(new RegExp(`${name} est en focus jusqu'à .* : il sera prévenu à la fin\\.`)),
    ).toBeVisible();
    await expect(page.getByText(/vu à/i)).toHaveCount(0);
    await postMessage(page, `Coucou ${tag}`);
    await expect
      .poll(() =>
        withDb(async (c) => {
          const { rows } = await c.query(
            `select count(*)::int n from notification where "userId"=$1 and kind='discussion'`,
            [other],
          );
          return rows[0].n;
        }),
      )
      .toBe(1);
  });

  test("pas de défilement horizontal sur mobile", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    for (const path of [
      "/discussions",
      "/discussions/general",
      "/discussions/activite",
      "/discussions/nouveau",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
    // Menu d'un message ouvert : toujours dans l'écran.
    const tag = uniqueTag();
    await page.goto("/discussions/general");
    await postMessage(page, `Largeur ${tag}`);
    await openMessageMenu(page, `Largeur ${tag}`);
    await expect(page.getByRole("button", { name: "Réagir avec 🎉" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
