import { expect, test, type Page } from "@playwright/test";
import { activateAssociate } from "./support/flows";
import {
  auditTrail,
  deliveriesFor,
  insertPushSubscription,
  pushSubscriptionCount,
  whatsappColumns,
} from "./support/alerts";

// Serveur de test : PUSH_TRANSPORT=outbox, WHATSAPP_TRANSPORT=outbox (aucun appel réseau externe).

const region = (page: Page, name: string) => page.getByRole("region", { name });

test.describe("alertes push et WhatsApp", () => {
  test("la page s'affiche depuis Plus, sans débordement horizontal", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    await page.goto("/plus");
    await page.getByRole("link", { name: /^Alertes/ }).click();
    await expect(page).toHaveURL(/\/plus\/alertes$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alertes");
    for (const name of [
      "Notifications sur cet appareil",
      "WhatsApp (gratuit, via CallMeBot)",
      "Que recevoir ?",
      "Derniers envois",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    await expect(
      region(page, "Notifications sur cet appareil").getByText("Sur cet appareil :"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "installez d'abord l'application" })).toHaveAttribute(
      "href",
      "/plus/installer",
    );
    await expect(page.getByText("Aucun envoi pour l'instant.")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("WhatsApp : numéro + clé chiffrée, envoi de test journalisé, suppression", async ({ page }) => {
    const { email } = await activateAssociate(page, "Charles");
    await page.goto("/plus/alertes");
    const whatsapp = region(page, "WhatsApp (gratuit, via CallMeBot)");

    // Numéro national refusé : le format international est exigé.
    await whatsapp.getByLabel("Numéro WhatsApp").fill("06 12 34 56 78");
    await whatsapp.getByLabel("Clé API CallMeBot").fill("123456");
    await whatsapp.getByRole("button", { name: "Enregistrer" }).click();
    await expect(whatsapp.getByText("Format international attendu, ex. +33 6 12 34 56 78.")).toBeVisible();
    // La clé n'est jamais renvoyée au navigateur.
    await expect(whatsapp.getByLabel("Clé API CallMeBot")).toHaveValue("");

    await whatsapp.getByLabel("Numéro WhatsApp").fill("+33 6 12 34 56 78");
    await whatsapp.getByLabel("Clé API CallMeBot").fill("123456");
    await whatsapp.getByRole("button", { name: "Enregistrer" }).click();
    await expect(
      whatsapp.getByText("WhatsApp enregistré. Envoyez-vous un test pour vérifier."),
    ).toBeVisible();
    await expect(whatsapp.getByText("Clé enregistrée ✓")).toBeVisible();
    await expect(whatsapp.getByLabel("Clé API CallMeBot")).toHaveValue("");

    const stored = await whatsappColumns(email);
    expect(stored.phone).toBe("+33612345678");
    expect(stored.key).toMatch(/^v1:/);
    expect(stored.key).not.toContain("123456");

    await whatsapp.getByRole("button", { name: "Envoyer un test" }).click();
    await expect(whatsapp.getByText(/Mode test : envoi journalisé/)).toBeVisible();
    expect(await deliveriesFor(email)).toEqual([
      { channel: "whatsapp", eventKind: "test", title: "Test Every1.ate OS", status: "outbox" },
    ]);
    const sent = page.getByRole("list", { name: "Derniers envois" });
    await expect(sent.getByText("Test Every1.ate OS")).toBeVisible();
    await expect(sent.getByText("Mode test (rien n'est parti)")).toBeVisible();

    await whatsapp.getByRole("button", { name: "Supprimer" }).click();
    await expect(whatsapp.getByText("Numéro et clé WhatsApp supprimés.")).toBeVisible();
    expect(await whatsappColumns(email)).toEqual({ phone: null, key: null });

    // Journal : actions tracées, jamais le numéro complet ni la clé.
    const audit = await auditTrail(email);
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining(["notification.whatsapp_configured", "notification.whatsapp_removed"]),
    );
    for (const entry of audit.filter((a) => a.action.startsWith("notification."))) {
      expect(entry.data).not.toContain("612345");
      expect(entry.data).not.toContain("123456");
    }
  });

  test("les préférences persistent après rechargement et se rétablissent", async ({ page }) => {
    const { email } = await activateAssociate(page, "Johan");
    await page.goto("/plus/alertes");
    const prefs = region(page, "Que recevoir ?");
    const whatsappDelivered = prefs.getByRole("checkbox", {
      name: "WhatsApp : Un livrable est livré",
      exact: true,
    });
    const pushDelivered = prefs.getByRole("checkbox", { name: "Push : Un livrable est livré", exact: true });
    const pushTaskDone = prefs.getByRole("checkbox", { name: "Push : Une tâche est terminée", exact: true });
    const inApp = prefs.getByRole("checkbox", {
      name: "Dans l'app (toujours) : Un livrable est livré",
      exact: true,
    });

    // Réglages par défaut : push sauf tâches terminées, WhatsApp nulle part ; l'app toujours.
    await expect(inApp).toBeChecked();
    await expect(inApp).toBeDisabled();
    await expect(pushDelivered).toBeChecked();
    await expect(pushTaskDone).not.toBeChecked();
    await expect(whatsappDelivered).not.toBeChecked();

    await whatsappDelivered.check();
    await pushDelivered.uncheck();
    await prefs.getByRole("button", { name: "Enregistrer" }).click();
    await expect(prefs.getByText("Préférences enregistrées.")).toBeVisible();

    await page.reload();
    await expect(whatsappDelivered).toBeChecked();
    await expect(pushDelivered).not.toBeChecked();
    await expect(pushTaskDone).not.toBeChecked();

    await prefs.getByRole("button", { name: "Rétablir les réglages recommandés" }).click();
    await expect(prefs.getByText("Réglages recommandés rétablis.")).toBeVisible();
    await expect(pushDelivered).toBeChecked();
    await expect(
      prefs.getByRole("checkbox", { name: "WhatsApp : On te mentionne dans une discussion" }),
    ).toBeChecked();
    await page.reload();
    await expect(pushDelivered).toBeChecked();
    await expect(whatsappDelivered).toBeChecked();

    expect((await auditTrail(email)).map((a) => a.action)).toContain("notification.prefs_updated");
  });

  test("push : un appareil abonné reçoit l'envoi de test (journalisé), puis se retire", async ({ page }) => {
    const { email } = await activateAssociate(page, "Camille");
    await insertPushSubscription(email);
    await page.goto("/plus/alertes");
    const device = region(page, "Notifications sur cet appareil");
    await expect(device.getByRole("heading", { name: "Mes appareils (1)" })).toBeVisible();

    await device.getByRole("button", { name: "Envoyer un test" }).click();
    await expect(
      device.getByText(/Mode test : envoi journalisé, rien n'est parti \(1 appareil\)/),
    ).toBeVisible();
    expect(await deliveriesFor(email)).toEqual([
      { channel: "push", eventKind: "test", title: "Test Every1.ate OS", status: "outbox" },
    ]);
    await expect(
      page.getByRole("list", { name: "Derniers envois" }).getByText("Push", { exact: false }),
    ).toBeVisible();

    await device.getByRole("button", { name: "Retirer l'appareil Android · Chrome" }).click();
    await expect(device.getByText("Aucun appareil ne reçoit encore vos notifications.")).toBeVisible();
    expect(await pushSubscriptionCount(email)).toBe(0);
    expect((await auditTrail(email)).map((a) => a.action)).toContain("notification.push_unsubscribed");
  });
});
