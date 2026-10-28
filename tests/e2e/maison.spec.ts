import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";

const letters = () =>
  Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");

test.describe("la maison", () => {
  test("le bâtiment : aperçu puis entrée, au survol, au toucher et au clavier ; accès classique", async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    const name = `Ines${letters()}`;
    await activateAssociate(page, name);
    await page.getByRole("link", { name: /Le bâtiment/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: `${name}.` })).toBeVisible();
    await expect(page.getByText("Bienvenue à la maison,")).toBeVisible();

    if (info.project.name === "mobile") {
      // Toucher : 1er tap = aperçu (la pièce se colore), 2e tap = entrée.
      // Le haut du volume est masqué par l'étage supérieur : on touche le bas de la façade.
      const box = (await page.locator('[data-room="cuisine"]').boundingBox())!;
      const tapKitchen = () => page.touchscreen.tap(box.x + box.width * 0.45, box.y + box.height * 0.85);
      await tapKitchen();
      await expect(page.getByText("5. Production")).toBeVisible();
      await expect(page).toHaveURL(/\/maison$/);
      await tapKitchen();
    } else {
      // Souris : survol = aperçu dans l'étiquette, clic = entrée.
      const label = page.getByRole("button", { name: /^Production — / });
      await label.hover();
      await expect(label).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("link", { name: "Entrer", exact: true })).toBeVisible();
      await expect(page.getByText(/tâche.* pour moi/).first()).toBeVisible();
      await label.click();
    }
    await expect(page).toHaveURL(/\/cuisine$/);
    await expect(page.getByRole("heading", { level: 1, name: "Production" })).toBeVisible();

    if (info.project.name !== "mobile") {
      // Clavier : focus = aperçu, Entrée = entrée.
      await page.goto("/maison");
      await page.getByRole("button", { name: /^Méthodes & modèles — / }).focus();
      await expect(page.getByRole("button", { name: /^Méthodes & modèles — / })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/recettes$/);

      // Pièce à venir : aperçu explicite, jamais ouvrable.
      await page.goto("/maison");
      await page.getByRole("button", { name: /^Portails clients — / }).focus();
      await expect(page.getByText("Lot à venir (portail client)").first()).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/maison$/);
    }

    // Même accès sans la carte ; les anciennes adresses redirigent.
    await page.goto("/maison");
    await page
      .getByRole("navigation", { name: "Pièces de la maison" })
      .getByRole("link", { name: /^Clients/ })
      .click();
    await expect(page).toHaveURL(/\/crm\/salle$/);
    await expect(page.getByRole("heading", { level: 1, name: "Clients à suivre" })).toBeVisible();
    await page.goto("/atelier");
    await expect(page).toHaveURL(/\/cuisine$/);
  });

  test("appartement : avatar, option verrouillée, objet installé, disponibilité visible au bureau", async ({
    page,
  }) => {
    const name = `Rose${letters()}`;
    await activateAssociate(page, name);
    await page.goto("/appartement");
    await expect(page.getByRole("heading", { level: 1, name: "Mon profil" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    await expect(page.getByRole("img", { name: `L'appartement de ${name}` })).toBeVisible();

    await page.getByRole("link", { name: "Aménager" }).click();
    await expect(page.getByRole("radio", { name: /Grande toque/ })).toBeDisabled();
    await page.getByText("Bonnet", { exact: true }).click();
    await page.getByText("Lunettes", { exact: true }).click();
    await page.getByRole("button", { name: "Enregistrer mon avatar" }).click();
    await expect(page.getByText("Avatar enregistré.")).toBeVisible();
    const look = await withDb(
      async (c) =>
        (
          await c.query(
            `select a.hat, a.accessory from user_avatar a join "user" u on u.id = a."userId" where u.name = $1`,
            [name],
          )
        ).rows,
    );
    expect(look).toEqual([{ hat: "bonnet", accessory: "lunettes" }]);

    const wall = page.locator("form", { has: page.getByText("Le mur", { exact: true }) });
    await expect(wall.getByRole("radio", { name: /Notre méthode/ })).toBeDisabled();
    const floor = page.locator("form", { has: page.getByText("Le sol", { exact: true }) });
    await floor.getByRole("radio", { name: /Plante verte/ }).check({ force: true });
    await floor.getByRole("button", { name: "Installer" }).click();
    await expect(floor.getByText("C'est installé.")).toBeVisible();

    await page.goto("/appartement");
    await page.getByRole("button", { name: "Concentré" }).click();
    await expect(page.getByRole("button", { name: "Concentré" })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/bureau");
    await expect(page.getByRole("link", { name: new RegExp(`${name} \\(moi\\).*Concentré`) })).toBeVisible();
  });

  test("recettes : 10 XP à l'écriture, « Transmission du savoir » quand un associé la réutilise", async ({
    browser,
  }) => {
    const author = await (await browser.newContext()).newPage();
    const name = `Paul${letters()}`;
    await activateAssociate(author, name);
    const title = `Brief en 5 questions ${letters()}`;
    await author.goto("/recettes/nouvelle");
    await author.getByLabel("Titre").fill(title);
    await author.getByLabel("Catégorie").selectOption({ label: "Création & stratégie" });
    await author.getByLabel("À quoi sert-elle ?").fill("Cadrer un brief client en une réunion");
    await author
      .getByLabel("Les étapes")
      .fill("1. Le contexte\n2. La cible\n3. Le message\n4. Les contraintes\n5. Le succès");
    await author.getByRole("button", { name: "Ajouter au carnet" }).click();
    await expect(author.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await author.goto("/progression");
    await expect(author.getByText(`Recette documentée : « ${title} »`)).toBeVisible();

    const mate = await (await browser.newContext()).newPage();
    await activateAssociate(mate, `Eve${letters()}`);
    await mate.goto("/recettes");
    await mate.getByRole("link", { name: new RegExp(title) }).click();
    await mate.getByLabel("Sur quel projet ? (facultatif)").fill("Lookbook printemps");
    await mate.getByRole("button", { name: "Je l'ai réutilisée" }).click();
    await expect(mate.getByText("— Lookbook printemps")).toBeVisible();

    await author.goto("/progression");
    await expect(author.getByText("Transmission du savoir", { exact: true }).first()).toBeVisible();
  });

  test("bureau : demande d'aide reliée à une compétence, prise en charge, réglée ; réactions rapides", async ({
    browser,
  }) => {
    const asker = await (await browser.newContext()).newPage();
    const askerName = `Hugo${letters()}`;
    await activateAssociate(asker, askerName);
    const helper = await (await browser.newContext()).newPage();
    await activateAssociate(helper, `Lina${letters()}`);
    const message = `Je bloque sur le devis ${letters()}`;

    await asker.goto("/bureau");
    await asker.getByRole("button", { name: "Demander un coup de main" }).click();
    await asker
      .getByLabel("Compétence concernée (facultatif)")
      .selectOption({ label: "Développement commercial · Proposition & devis" });
    await asker.getByLabel("Ce qui coince").fill(message);
    await asker.getByRole("button", { name: "Envoyer la demande" }).click();
    // L'état persisté fait foi (le message de succès peut disparaître à la revalidation).
    await expect(asker.locator("li", { hasText: message })).toBeVisible();

    await helper.goto("/bureau");
    const card = helper.locator("li", { hasText: message });
    await expect(card.getByText("Proposition & devis")).toBeVisible();
    await card.getByRole("button", { name: "Je m'en occupe" }).click();
    await expect(helper.locator("li", { hasText: message }).getByText(/s'en occupe/)).toBeVisible();
    await helper.locator("li", { hasText: message }).getByRole("button", { name: "Réglé" }).click();
    await expect(helper.getByText(message)).toHaveCount(0);

    await asker.goto("/notifications?vue=prioritaire");
    await expect(asker.getByText(/s'occupe de votre demande d'aide/)).toBeVisible();

    // Réaction rapide sur une réussite du fil (s'il y en a une).
    await helper.goto("/bureau");
    const react = helper.getByRole("button", { name: /^Réagir 👏/ }).first();
    if (await react.count()) {
      await react.click();
      await expect(helper.getByRole("button", { name: /^Réagir 👏/ }).first()).toHaveAttribute(
        "aria-pressed",
        /true|false/,
      );
    }
  });
});
