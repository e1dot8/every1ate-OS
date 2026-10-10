import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { STRONG_PASSWORD, activateAssociate } from "./support/flows";

const protectedRoutes = [
  "/",
  "/plus",
  "/plus/securite",
  "/plus/associes",
  "/design",
  "/projets",
  "/projets/nouveau",
  "/taches",
  "/plus/archives",
];

test.describe("contrôle d'accès côté serveur", () => {
  for (const route of protectedRoutes) {
    test(`${route} est inaccessible sans session`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/connexion/);
    });
  }

  test("un faux cookie de session ne donne accès à rien", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "better-auth.session_token", value: "faux.jeton", url: baseURL! }]);
    await page.goto("/plus/associes");
    await expect(page).toHaveURL(/\/connexion/);
    await expect(page.getByText("@example.test")).toHaveCount(0);
  });

  test("l'inscription publique est fermée", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      data: { email: "intrus@example.test", password: STRONG_PASSWORD, name: "Intrus" },
    });
    expect(response.ok()).toBe(false);
    const count = await withDb(
      async (c) =>
        (await c.query(`select count(*)::int as n from "user" where email = 'intrus@example.test'`)).rows[0]
          .n,
    );
    expect(count).toBe(0);
  });

  test("l'API des sessions refuse une requête anonyme", async ({ request }) => {
    const response = await request.get("/api/auth/list-sessions");
    expect(response.status()).toBe(401);
  });

  test("la page des sessions n'expose aucun jeton de session", async ({ page, context }) => {
    await activateAssociate(page);
    await page.goto("/plus/securite");
    const cookie = (await context.cookies()).find((c) => c.name.endsWith("session_token"));
    expect(cookie).toBeDefined();
    const token = decodeURIComponent(cookie!.value).split(".")[0];
    expect(await page.content()).not.toContain(token);
  });
});

test.describe("journal d'audit", () => {
  test("les connexions sont journalisées, sans mot de passe", async ({ page }) => {
    const { email } = await activateAssociate(page);
    const actions = await withDb(async (c) =>
      (
        await c.query(
          `select a.action from audit_event a join "user" u on u.id = a."actorId" where u.email = $1 order by a."createdAt"`,
          [email],
        )
      ).rows.map((r: { action: string }) => r.action),
    );
    expect(actions).toEqual(expect.arrayContaining(["invitation.accepted", "auth.sign_in.success"]));

    const leaks = await withDb(
      async (c) =>
        (
          await c.query(`select count(*)::int as n from audit_event where audit_event::text like $1`, [
            `%${STRONG_PASSWORD}%`,
          ])
        ).rows[0].n,
    );
    expect(leaks).toBe(0);
  });

  test("le journal refuse toute modification ou suppression", async () => {
    await withDb(async (c) => {
      const { rows } = await c.query(`select id from audit_event limit 1`);
      test.skip(rows.length === 0, "journal vide");
      await expect(
        c.query(`update audit_event set action = 'falsifié' where id = $1`, [rows[0].id]),
      ).rejects.toThrow(/ajout seul/);
      await expect(c.query(`delete from audit_event where id = $1`, [rows[0].id])).rejects.toThrow(
        /ajout seul/,
      );
      await expect(c.query(`truncate audit_event`)).rejects.toThrow(/ajout seul/);
    });
  });

  test("les mots de passe sont stockés sous forme d'empreinte", async ({ page }) => {
    const { email } = await activateAssociate(page);
    const stored = await withDb(
      async (c) =>
        (
          await c.query(
            `select a.password from account a join "user" u on u.id = a."userId" where u.email = $1`,
            [email],
          )
        ).rows[0].password as string,
    );
    expect(stored).not.toContain(STRONG_PASSWORD);
    expect(stored.length).toBeGreaterThan(60);
  });
});
