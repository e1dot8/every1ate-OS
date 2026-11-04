import { randomBytes } from "node:crypto";
import { expect, type Locator, type Page } from "@playwright/test";
import { withDb } from "./db";

/** Suffixe unique : les tests partagent la Salle commune et ne doivent jamais se mélanger. */
export const uniqueTag = () => randomBytes(4).toString("hex");

/**
 * Ligne visible d'un message (salon ou fil). Les pages déjà visitées peuvent rester montées
 * mais masquées après une navigation : on ne cible que ce qui est affiché.
 */
export function messageRow(page: Page, text: string): Locator {
  return page.locator("li[id^='m-']").filter({ hasText: text, visible: true });
}

/** Écrit dans le compositeur et envoie. */
export async function sendMessage(page: Page, text: string, label = "Message") {
  await page.getByLabel(label, { exact: true }).fill(text);
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
}

/** Écrit, envoie, puis attend que le message apparaisse. */
export async function postMessage(page: Page, text: string, label = "Message") {
  await sendMessage(page, text, label);
  await expect(messageRow(page, text)).toBeVisible();
}

/** Ouvre le menu « Actions du message » d'un message. */
export async function openMessageMenu(page: Page, text: string): Promise<Locator> {
  const row = messageRow(page, text);
  await row.getByRole("button", { name: "Actions du message" }).click();
  return row;
}

/** Associé inséré en base (sans connexion), pour les mentions et les messages directs. */
export async function insertAssociate(name: string): Promise<string> {
  const id = `e2e${randomBytes(10).toString("hex")}`;
  await withDb((c) =>
    c.query(
      `insert into "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       values ($1, $2, $3, true, 'associe', now(), now())`,
      [id, name, `${id}@example.test`],
    ),
  );
  return id;
}

/** Salon privé d'un autre associé (le lecteur n'en est pas membre). */
export async function insertPrivateChannel(ownerId: string, name: string): Promise<string> {
  const slug = `prive-${randomBytes(5).toString("hex")}`;
  const channelId = `ch${randomBytes(10).toString("hex")}`;
  await withDb(async (c) => {
    await c.query(
      `insert into channel (id, slug, name, kind, "createdById", "createdAt", "updatedAt")
       values ($1, $2, $3, 'PRIVE', $4, now(), now())`,
      [channelId, slug, name, ownerId],
    );
    await c.query(
      `insert into channel_member (id, "channelId", "userId", "lastReadAt", "createdAt")
       values ($1, $2, $3, now(), now())`,
      [`cm${randomBytes(10).toString("hex")}`, channelId, ownerId],
    );
    await c.query(
      `insert into message (id, "channelId", "authorId", body, "createdAt")
       values ($1, $2, $3, $4, now())`,
      [`msg${randomBytes(10).toString("hex")}`, channelId, ownerId, `Secret ${name}`],
    );
  });
  return slug;
}

/** Aucun défilement horizontal de la page. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
