import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate, signOut } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

/** Suffixe unique (minuscules et chiffres) : la base de test est partagée entre les tests. */
const tag = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

async function userIdByEmail(email: string): Promise<string> {
  return withDb(async (c) => {
    const { rows } = await c.query(`select id from "user" where email = $1`, [email]);
    return rows[0].id as string;
  });
}

async function insertEvent(ownerId: string, title: string, visibility: "OCCUPE" | "PARTAGE") {
  await withDb((c) =>
    c.query(
      `insert into calendar_event (id, title, "startsAt", "endsAt", visibility, "ownerId", "updatedAt")
       values ($1, $2, $3, $4, $5, $6, now())`,
      [
        `evt_${randomBytes(8).toString("hex")}`,
        title,
        new Date("2026-11-03T09:00:00Z"),
        new Date("2026-11-03T10:00:00Z"),
        visibility,
        ownerId,
      ],
    ),
  );
}

test.describe("Recherche globale", () => {
  test("sans accents ni majuscules : retrouve un projet accentué, surligne et y mène", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const t = tag();
    const name = `Éclat Été ${t}`;
    const projectId = await createProjectFromTemplate(page, name);

    // Depuis l'icône de la barre du haut.
    await page.getByRole("link", { name: "Rechercher", exact: true }).click();
    await expect(page).toHaveURL(/\/recherche$/);
    const box = page.getByRole("searchbox", { name: "Rechercher partout" });
    await expect(box).toBeVisible();

    // Moins de 2 caractères : simple indication, aucune recherche.
    await box.fill("é");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(page.getByText("Saisissez au moins 2 caractères.")).toBeVisible();

    await box.fill(`eclat ete ${t}`);
    await box.press("Enter");
    await expect(page).toHaveURL(/\/recherche\?q=eclat\+ete\+/);
    await expect(page.getByText(new RegExp(`résultats? pour « eclat ete ${t} »`))).toBeVisible();
    const projects = page.getByRole("region", { name: /^Projets/ });
    await expect(projects).toContainText("1 résultat");
    const link = projects.getByRole("link", { name });
    await expect(link).toBeVisible();
    await expect(link.locator("mark")).toHaveText(name);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`/projets/${projectId}`));
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });

  test("un rendez-vous non partagé d'un autre associé ne fuit pas ; les jokers restent littéraux", async ({
    page,
  }) => {
    const t = tag();
    const pierre = await activateAssociate(page, "Pierre");
    const pierreId = await userIdByEmail(pierre.email);
    await insertEvent(pierreId, `Rendez-vous privé ${t}`, "OCCUPE");
    await insertEvent(pierreId, `Atelier partagé ${t}`, "PARTAGE");
    await signOut(page);

    await activateAssociate(page, "Charles");
    await page.goto(`/recherche?q=${encodeURIComponent(`RENDEZ-VOUS PRIVE ${t}`)}`);
    await expect(page.getByText(`Aucun résultat pour « RENDEZ-VOUS PRIVE ${t} »`)).toBeVisible();

    await page.goto(`/recherche?q=${t}`);
    const events = page.getByRole("region", { name: /^Événements/ });
    await expect(events.getByRole("link", { name: `Atelier partagé ${t}` })).toBeVisible();
    await expect(events).toContainText("1 résultat");
    await expect(page.getByText(`Rendez-vous privé ${t}`)).toHaveCount(0);

    // « _ » est un joker LIKE : échappé, il ne remplace plus le premier caractère du suffixe.
    const wildcard = `_${t.slice(1)}`;
    await page.goto(`/recherche?q=${encodeURIComponent(wildcard)}`);
    await expect(page.getByText(`Aucun résultat pour « ${wildcard} »`)).toBeVisible();
  });
});
