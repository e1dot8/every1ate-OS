import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const CRON_SECRET = "e2e-only-cron-secret-0123456789abcdef";

type Row = { id: string; title: string; start: string | null; due: string | null };

async function projectTasks(projectId: string): Promise<Row[]> {
  return withDb(
    async (c) =>
      (
        await c.query(
          `select id, title, to_char("startDate",'YYYY-MM-DD') start, to_char("dueDate",'YYYY-MM-DD') due from task where "projectId"=$1 order by position`,
          [projectId],
        )
      ).rows,
  );
}

async function successorsOf(taskId: string): Promise<string[]> {
  return withDb(async (c) =>
    (await c.query(`select "taskId" from task_dependency where "dependsOnId"=$1`, [taskId])).rows.map(
      (r) => r.taskId,
    ),
  );
}

test.describe("roadmap", () => {
  test("déplacement au clavier avec cascade confirmée, persisté et journalisé", async ({ page }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Roadmap clavier");
    const tasks = await projectTasks(id);
    const first = tasks[0];
    const [succId] = await successorsOf(first.id);
    const succBefore = tasks.find((t) => t.id === succId)!;

    await page.goto(`/projets/${id}/roadmap?vue=gantt`);
    await expect(page.getByRole("heading", { level: 1, name: "Roadmap" })).toBeVisible();
    const bar = page.getByTestId(`bar-${first.id}`);
    await bar.focus();
    for (let i = 0; i < 5; i++) await bar.press("ArrowRight");
    await bar.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Cascade proposée");
    await dialog.getByRole("button", { name: /^Déplacer et décaler/ }).click();
    await expect(dialog).toHaveCount(0);

    const after = await projectTasks(id);
    const moved = after.find((t) => t.id === first.id)!;
    const shift = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
    expect(shift(first.start!, moved.start!)).toBe(5);
    expect(shift(first.due!, moved.due!)).toBe(5);
    const succAfter = after.find((t) => t.id === succId)!;
    expect(Date.parse(succAfter.start!)).toBeGreaterThan(Date.parse(moved.due!));
    // Durée conservée.
    expect(shift(succAfter.start!, succAfter.due!)).toBe(shift(succBefore.start!, succBefore.due!));

    await page.goto(`/projets/${id}?onglet=journal`);
    await expect(page.getByText("a déplacé une tâche sur la roadmap").first()).toBeVisible();
  });

  test("glisser-déposer sans cascade : seule la tâche bouge", async ({ page, isMobile }) => {
    test.skip(isMobile, "Le glisser à la souris est vérifié sur ordinateur ; le clavier couvre le mobile.");
    await activateAssociate(page, "Pierre");
    const id = await createProjectFromTemplate(page, "Roadmap souris");
    const tasks = await projectTasks(id);
    const first = tasks[0];
    const [succId] = await successorsOf(first.id);
    const succBefore = tasks.find((t) => t.id === succId)!;

    await page.goto(`/projets/${id}/roadmap?vue=gantt`);
    const bar = page.getByTestId(`bar-${first.id}`);
    await expect(bar).toBeVisible();
    await bar.scrollIntoViewIfNeeded();
    const box = (await bar.boundingBox())!;
    await page.mouse.move(box.x + 8, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 8 + 32 * 4, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Conflit de dépendances");
    await dialog.getByRole("button", { name: "Déplacer seulement cette tâche" }).click();
    await expect(dialog).toHaveCount(0);

    const after = await projectTasks(id);
    expect(after.find((t) => t.id === first.id)!.start).not.toBe(first.start);
    expect(after.find((t) => t.id === succId)).toEqual(succBefore);
  });

  test("jalon ajouté puis affiché sur la roadmap", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const id = await createProjectFromTemplate(page, "Roadmap jalons");
    await page.goto(`/projets/${id}/roadmap?vue=gantt`);
    await page.getByLabel("Nom du jalon").fill("Validation client");
    await page.getByLabel("Date", { exact: true }).fill("2026-11-20");
    await page.getByRole("button", { name: "Ajouter le jalon" }).click();
    await expect(page.getByText("Jalon ajouté.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Jalon Validation client/ })).toBeVisible();
  });
});

test.describe("suivi du temps", () => {
  test("un seul chronomètre actif, bascule confirmée, saisie manuelle et correction historisée", async ({
    page,
  }) => {
    await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Temps clip");
    const [a, b] = await projectTasks(id);

    await page.goto(`/taches/${a.id}`);
    await page.getByRole("button", { name: "Démarrer le chronomètre" }).click();
    await expect(page.getByRole("button", { name: "Arrêter" })).toBeVisible();

    await page.goto(`/taches/${b.id}`);
    await page.getByRole("button", { name: "Démarrer le chronomètre" }).click();
    await expect(page.getByText(`Un chronomètre tourne déjà sur « ${a.title} ».`)).toBeVisible();
    await page.getByRole("button", { name: "Arrêter l'autre et démarrer ici" }).click();
    await expect(page.getByRole("button", { name: "Arrêter" })).toBeVisible();

    const timers = await withDb(
      async (c) =>
        (
          await c.query(
            `select "taskId", "endedAt" is null as running from time_entry where "projectId"=$1 and source='TIMER' order by "createdAt"`,
            [id],
          )
        ).rows,
    );
    expect(timers).toEqual([
      { taskId: a.id, running: false },
      { taskId: b.id, running: true },
    ]);
    await page.getByRole("button", { name: "Arrêter" }).click();
    await expect(page.getByRole("button", { name: "Démarrer le chronomètre" })).toBeVisible();

    await page.goto("/temps");
    await page
      .getByRole("combobox", { name: "Tâche", exact: true })
      .filter({ visible: true })
      .selectOption(a.id);
    await page.getByLabel("Durée").fill("1h30");
    await page.getByLabel("Commentaire (facultatif)").fill("Repérages");
    await page.getByRole("button", { name: "Ajouter le temps" }).click();
    await expect(page.getByText("Temps ajouté.")).toBeVisible();
    await expect(page.getByText(/saisie manuelle · Repérages/).filter({ visible: true })).toBeVisible();

    await page
      .getByRole("link", { name: `Corriger la saisie ${a.title}` })
      .first()
      .click();
    await expect(page.getByRole("heading", { name: "Corriger une saisie" })).toBeVisible();
    // Le rendu précédent peut rester monté (masqué) : on cible les champs visibles.
    await page.getByLabel("Durée").filter({ visible: true }).fill("2h");
    await page.getByLabel("Motif de la correction (facultatif)").fill("Oubli du debrief");
    await page.getByRole("button", { name: "Enregistrer la correction" }).click();
    await expect(page).toHaveURL(/\/temps$/);
    const entry = await withDb(
      async (c) =>
        (
          await c.query(
            `select id, "durationMinutes" from time_entry where "projectId"=$1 and source='MANUEL'`,
            [id],
          )
        ).rows[0],
    );
    expect(entry.durationMinutes).toBe(120);
    await page.goto(`/temps/${entry.id}`);
    await expect(page.getByText("a corrigé une saisie de temps")).toBeVisible();
    await expect(page.getByText(/Oubli du debrief/)).toBeVisible();
  });

  test("une durée illisible est refusée sans perdre la saisie", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    const id = await createProjectFromTemplate(page, "Temps erreurs");
    const [a] = await projectTasks(id);
    await page.goto(`/taches/${a.id}`);
    await page.getByText("Saisir du temps manuellement").click();
    await page.getByLabel("Durée").fill("beaucoup");
    await page.getByLabel("Commentaire (facultatif)").fill("Note conservée");
    await page.getByRole("button", { name: "Ajouter le temps" }).click();
    await expect(page.getByText("Durée illisible (ex. 1h30, 45, 2).")).toBeVisible();
    await expect(page.getByLabel("Commentaire (facultatif)")).toHaveValue("Note conservée");
  });
});

test.describe("priorités, retards et notifications", () => {
  test("escalade après 48 h, sans doublon ; priorité verrouillée intacte", async ({ page, request }) => {
    const { email } = await activateAssociate(page, "Johan");
    const id = await createProjectFromTemplate(page, "Retards");
    const [late, veryLate, locked] = await projectTasks(id);
    const me = await withDb(
      async (c) => (await c.query(`select id from "user" where email=$1`, [email])).rows[0].id,
    );

    // Retards simulés directement en base (aucune donnée réelle).
    await withDb(async (c) => {
      await c.query(`update task set "dueDate" = current_date - 1, "ownerId"=$2 where id=$1`, [late.id, me]);
      await c.query(`update task set "dueDate" = current_date - 4, "ownerId"=$2, impact='FORT' where id=$1`, [
        veryLate.id,
        me,
      ]);
      await c.query(
        `update task set "dueDate" = current_date - 4, priority='BASSE', "priorityLocked"=true where id=$1`,
        [locked.id],
      );
    });

    expect(
      (await request.post("/api/cron/scan", { headers: { Authorization: "Bearer mauvais" } })).status(),
    ).toBe(401);
    const run = async () => {
      const res = await request.post("/api/cron/scan", {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      });
      expect(res.status()).toBe(200);
    };
    await run();
    await run();

    const notes = await withDb(
      async (c) =>
        (
          await c.query(
            `select kind, "taskId", "emailedAt" is not null emailed from notification where "projectId"=$1 order by kind, "taskId"`,
            [id],
          )
        ).rows,
    );
    const of = (kind: string) => notes.filter((n) => n.kind === kind);
    expect(
      of("retard")
        .map((n) => n.taskId)
        .sort(),
    ).toEqual([late.id, veryLate.id, locked.id].sort());
    expect(
      of("escalade")
        .map((n) => n.taskId)
        .sort(),
    ).toEqual([veryLate.id, locked.id].sort());
    expect(of("escalade").every((n) => n.emailed)).toBe(true);

    const prio = await withDb(
      async (c) =>
        (
          await c.query(`select id, priority, "priorityLocked" from task where id = any($1)`, [
            [veryLate.id, locked.id],
          ])
        ).rows,
    );
    expect(prio.find((p) => p.id === locked.id)).toMatchObject({ priority: "BASSE", priorityLocked: true });
    // Impact fort + retard : au moins « Haute » (plus si elle bloque d'autres tâches).
    expect(["HAUTE", "URGENTE"]).toContain(prio.find((p) => p.id === veryLate.id)!.priority);

    await page.goto("/notifications");
    await expect(page.getByText(`Retard de plus de 48 h : ${veryLate.title}`)).toBeVisible();
    await expect(page.getByRole("link", { name: /Notifications, \d+ non lue/ })).toBeVisible();
    await page.getByRole("button", { name: /Tout marquer comme lu/ }).click();
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible();

    await page.goto(`/taches/${locked.id}`);
    await expect(
      page.getByText("Priorité verrouillée sur « Basse » : aucun calcul ne la remplace."),
    ).toBeVisible();
  });

  test("commentaire publié sur la tâche", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const id = await createProjectFromTemplate(page, "Commentaires");
    const [t] = await projectTasks(id);
    await page.goto(`/taches/${t.id}`);
    await page.getByLabel("Ajouter un commentaire").fill("Le client valide la V2.");
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Commentaire publié.")).toBeVisible();
    await expect(page.locator("#commentaires").getByText("Le client valide la V2.")).toBeVisible();
  });
});
