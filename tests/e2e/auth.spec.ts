import { expect, test } from "@playwright/test";
import { insertInvitation, lastEmailTo, uniqueEmail, withDb } from "./support/db";
import { STRONG_PASSWORD, activateAssociate, signIn, signOut } from "./support/flows";

test.describe("invitation", () => {
  test("une invitation active le compte et ouvre Mon espace", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    await expect(page).toHaveURL(/\/$/);
  });

  test("une invitation déjà utilisée ne sert plus", async ({ page, browser }) => {
    const email = uniqueEmail("reuse");
    const token = await insertInvitation(email, "Alex");
    await page.goto(`/invitation/${token}`);
    await page.getByLabel("Nouveau mot de passe").fill(STRONG_PASSWORD);
    await page.getByLabel("Confirmer le mot de passe").fill(STRONG_PASSWORD);
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Alex");

    const other = await browser.newPage();
    await other.goto(`/invitation/${token}`);
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Invitation indisponible");
    await other.close();
  });

  test("une invitation expirée est refusée", async ({ page }) => {
    const token = await insertInvitation(uniqueEmail("expired"), "Sam", -1000);
    await page.goto(`/invitation/${token}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Invitation indisponible");
  });

  test("un mot de passe trop court est refusé et l'invitation reste valable", async ({ page }) => {
    const token = await insertInvitation(uniqueEmail("short"), "Lou");
    await page.goto(`/invitation/${token}`);
    await page.getByLabel("Nouveau mot de passe").fill("court");
    await page.getByLabel("Confirmer le mot de passe").fill("court");
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(page.getByText("au moins 12 caractères")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bienvenue, Lou");
  });
});

test.describe("connexion", () => {
  test("déconnexion puis reconnexion, avec retour à la page demandée", async ({ page }) => {
    const { email, password } = await activateAssociate(page);
    await signOut(page);

    await page.goto("/plus/securite");
    await expect(page).toHaveURL(/\/connexion\?next=%2Fplus%2Fsecurite/);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sécurité");
  });

  test("message neutre en cas d'erreur, e-mail conservé", async ({ page }) => {
    const { email } = await activateAssociate(page);
    await signOut(page);
    await signIn(page, email, "mauvais-mot-de-passe");
    await expect(page.getByRole("alert").first()).toContainText("E-mail ou mot de passe incorrect.");
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue(email);
    await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveValue("");
  });

  test("5 échecs suspendent la connexion du compte", async ({ page }) => {
    const { email, password } = await activateAssociate(page);
    await signOut(page);
    for (let attempt = 1; attempt <= 5; attempt++) {
      await signIn(page, email, `faux-${attempt}`);
      await expect(page.getByRole("alert").first()).toContainText("E-mail ou mot de passe incorrect.");
    }
    // Même le bon mot de passe est refusé pendant la suspension.
    await signIn(page, email, password);
    await expect(page.getByRole("alert").first()).toContainText("Trop de tentatives.");
  });

  test("une redirection externe est ignorée après connexion", async ({ page }) => {
    const { email, password } = await activateAssociate(page);
    await signOut(page);
    await page.goto("/connexion?next=//exemple-malveillant.test");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });
});

test.describe("mot de passe", () => {
  test("réinitialisation par e-mail : l'ancien mot de passe ne fonctionne plus", async ({ page }) => {
    const { email, password } = await activateAssociate(page);
    await signOut(page);

    await page.goto("/mot-de-passe-oublie");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vérifiez vos e-mails");

    const mail = await lastEmailTo(email);
    expect(mail?.subject).toBe("Réinitialiser votre mot de passe");
    const link = mail!.text.match(/https?:\/\/\S+/)![0];
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nouveau mot de passe");

    const newPassword = "Dressage-Service-2027?";
    await page.getByLabel("Nouveau mot de passe").fill(newPassword);
    await page.getByLabel("Confirmer le mot de passe").fill(newPassword);
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page.getByText("Mot de passe modifié.")).toBeVisible();

    await signIn(page, email, password);
    await expect(page.getByRole("alert").first()).toContainText("E-mail ou mot de passe incorrect.");
    await signIn(page, email, newPassword);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour Camille");

    // Le lien ne sert qu'une fois.
    await page.goto(link);
    await expect(page.getByText("Ce lien a expiré ou a déjà servi.")).toBeVisible();
  });

  test("une adresse inconnue reçoit la même réponse", async ({ page }) => {
    await page.goto("/mot-de-passe-oublie");
    await page.getByLabel("Adresse e-mail").fill(uniqueEmail("inconnu"));
    await page.getByRole("button", { name: "Envoyer le lien" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vérifiez vos e-mails");
  });

  test("changement de mot de passe depuis Sécurité", async ({ page }) => {
    const { password } = await activateAssociate(page);
    await page.goto("/plus/securite");
    await page.getByLabel("Mot de passe actuel").fill("pas-le-bon-mot-de-passe");
    await page.getByLabel("Nouveau mot de passe").fill("Nouvelle-Recette-2028!");
    await page.getByLabel("Confirmer le mot de passe").fill("Nouvelle-Recette-2028!");
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Mot de passe actuel incorrect.");

    await page.getByLabel("Mot de passe actuel").fill(password);
    await page.getByLabel("Nouveau mot de passe").fill("Nouvelle-Recette-2028!");
    await page.getByLabel("Confirmer le mot de passe").fill("Nouvelle-Recette-2028!");
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Mot de passe mis à jour.")).toBeVisible();
  });
});

test.describe("appareils et associés", () => {
  test("déconnecter un autre appareil coupe sa session", async ({ page, browser }) => {
    const { email, password } = await activateAssociate(page);
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await signIn(other, email, password);
    await expect(other.getByRole("heading", { level: 1 })).toHaveText("Bonjour Camille");

    await page.goto("/plus/securite");
    await expect(page.getByTestId("session-row")).toHaveCount(2);
    await page.getByRole("button", { name: "Déconnecter", exact: true }).click();
    await expect(page.getByTestId("session-row")).toHaveCount(1);

    await other.goto("/plus");
    await expect(other).toHaveURL(/\/connexion/);
    await otherContext.close();
  });

  test("inviter un associé envoie l'e-mail et l'affiche comme invité", async ({ page }) => {
    const { email: memberEmail } = await activateAssociate(page);
    const invitee = uniqueEmail("charles");
    await page.goto("/plus/associes");
    await page.getByLabel("Prénom").fill("Charles");
    await page.getByLabel("Adresse e-mail").fill(invitee);
    await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(page.getByText(`Invitation envoyée à ${invitee}.`)).toBeVisible();
    await expect(page.getByRole("list", { name: "Associés" }).getByText(invitee)).toBeVisible();
    expect((await lastEmailTo(invitee))?.text).toContain("/invitation/");

    // Une adresse déjà membre est refusée.
    await page.getByLabel("Prénom").fill("Doublon");
    await page.getByLabel("Adresse e-mail").fill(memberEmail);
    await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(page.getByText("Un compte existe déjà pour cette adresse.")).toBeVisible();

    const pending = await withDb(
      async (c) =>
        (
          await c.query(
            `select count(*)::int as n from invitation where email = $1 and "acceptedAt" is null and "revokedAt" is null`,
            [invitee],
          )
        ).rows[0].n,
    );
    expect(pending).toBe(1);
  });
});
