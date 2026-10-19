import { expect, test } from "@playwright/test";
import { withDb } from "./support/db";
import { activateAssociate } from "./support/flows";
import { createProjectFromTemplate } from "./support/projects";

const unique = (name: string) =>
  `${name} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
/** Suffixe en lettres seulement : « @Prénom » ne lit que des lettres. */
const letters = (n = 6) =>
  Array.from({ length: n }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
};

/** Demain (jour calendaire à Paris), AAAA-MM-JJ : ce que le serveur lit dans « demain ». */
function tomorrowInParis() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

test.describe("comptes rendus → actions", () => {
  for (const route of ["/notes", "/notes/nouvelle"]) {
    test(`${route} est inaccessible sans session`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/connexion/);
    });
  }

  test("deux lignes « [ ] » deviennent deux tâches, une seule fois", async ({ page, browser }) => {
    // Associé mentionné : prénom unique pour que « @Prénom » le désigne sans ambiguïté (base partagée).
    const charlesName = `Charles${letters()}`;
    const charlesContext = await browser.newContext();
    const charles = await charlesContext.newPage();
    await activateAssociate(charles, charlesName);

    await activateAssociate(page, "Johan");
    const projectName = unique("Campagne CR");
    const projectId = await createProjectFromTemplate(page, projectName, "Projet vierge");

    // Depuis l'onglet Docs du projet : le projet est présélectionné.
    await page.goto(`/projets/${projectId}?onglet=docs`);
    await page.getByRole("link", { name: "Nouveau compte rendu" }).click();
    await expect(page).toHaveURL(new RegExp(`/notes/nouvelle\\?projet=${projectId}`));
    await expect(page.getByLabel("Projet (facultatif)")).toHaveValue(projectId);

    const title = unique("Point hebdo");
    await page.getByLabel("Titre").fill(title);
    await page
      .getByLabel("Compte rendu", { exact: true })
      .fill(
        [
          "Point d'avancement avec le client.",
          `[ ] Envoyer le planning @${charlesName} demain`,
          "[ ] Réserver le studio",
          "Le client valide la direction artistique.",
        ].join("\n"),
      );
    // Aperçu local (sans IA) avant l'enregistrement.
    await expect(page.getByText("2 actions détectées")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const noteId = page.url().split("/notes/")[1].split(/[?#]/)[0];

    // Actions proposées : responsable et échéance lus dans la ligne, projet du compte rendu.
    const first = page.getByRole("group", { name: /^Action 1/ });
    const second = page.getByRole("group", { name: /^Action 2/ });
    await expect(first.getByLabel("Titre")).toHaveValue("Envoyer le planning");
    await expect(first.getByLabel("Responsable").locator("option:checked")).toHaveText(charlesName);
    await expect(first.getByLabel("Échéance")).toHaveValue(tomorrowInParis());
    await expect(first.getByRole("checkbox", { name: "Créer cette tâche" })).toBeChecked();
    await expect(second.getByLabel("Titre")).toHaveValue("Réserver le studio");
    await expect(page.getByRole("group", { name: /^Action/ }).getByLabel("Projet")).toHaveCount(0);

    // Un deuxième onglet garde l'ancien formulaire : son envoi tardif ne doit rien dupliquer.
    const staleTab = await page.context().newPage();
    await staleTab.goto(`/notes/${noteId}`);
    await expect(staleTab.getByRole("button", { name: "Créer les tâches" })).toBeVisible();

    await page.getByRole("button", { name: "Créer les tâches" }).click();
    await expect(page.getByText("2 tâches créées.")).toBeVisible();
    const justCreated = page.getByRole("list", { name: "Tâches qui viennent d'être créées" });
    await expect(justCreated.getByRole("link", { name: "Envoyer le planning" })).toBeVisible();
    await expect(justCreated.getByRole("link", { name: "Réserver le studio" })).toBeVisible();

    await staleTab.getByRole("button", { name: "Créer les tâches" }).click();
    await expect(staleTab.getByText("Ces actions ont déjà été transformées en tâches.")).toBeVisible();
    await staleTab.close();

    // Au rechargement : plus aucune action proposée, les lignes sont marquées « [x] ».
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer les tâches" })).toHaveCount(0);
    await expect(page.getByText(/Aucune action en attente/)).toBeVisible();
    await expect(page.getByText(`[x] Envoyer le planning @${charlesName} demain`)).toBeVisible();
    const linked = page.getByRole("list", { name: "Tâches créées depuis ce compte rendu" });
    await expect(linked.getByRole("link", { name: "Envoyer le planning" })).toBeVisible();
    await expect(linked.getByRole("link", { name: "Réserver le studio" })).toBeVisible();

    // Exactement deux tâches dans le projet, avec responsable et échéance.
    const rows = await withDb(
      async (c) =>
        (
          await c.query(
            `select t.title, u.name as owner, to_char(t."dueDate", 'YYYY-MM-DD') as due, t.status
             from task t left join "user" u on u.id = t."ownerId"
             where t."projectId" = $1 order by t.position`,
            [projectId],
          )
        ).rows,
    );
    expect(rows).toEqual([
      { title: "Envoyer le planning", owner: charlesName, due: tomorrowInParis(), status: "A_FAIRE" },
      { title: "Réserver le studio", owner: null, due: null, status: "A_FAIRE" },
    ]);

    // Le compte rendu apparaît dans l'onglet Docs ; les tâches dans l'onglet Tâches.
    await page.goto(`/projets/${projectId}?onglet=docs`);
    await expect(
      page.getByRole("list", { name: "Comptes rendus" }).getByRole("link", { name: title }),
    ).toBeVisible();
    await page.goto(`/projets/${projectId}?onglet=taches`);
    await expect(page.getByRole("link", { name: "Envoyer le planning" })).toBeVisible();

    // Le responsable mentionné est prévenu.
    await charles.goto("/notifications");
    await expect(charles.getByText(/vous a assigné « Envoyer le planning »/)).toBeVisible();
    await charlesContext.close();
  });

  test("depuis une réunion du calendrier : titre et date préremplis, compte rendu lié", async ({ page }) => {
    await activateAssociate(page, "Charles");
    const day = nextMonday();
    const eventTitle = unique("Atelier client");
    await page.goto("/calendrier/nouveau");
    await page.getByLabel("Titre").fill(eventTitle);
    await page.getByLabel("Début (heure de Paris)").fill(`${day}T10:00`);
    await page.getByLabel("Fin").fill(`${day}T11:00`);
    await page.getByRole("button", { name: "Créer l'événement" }).click();
    await expect(page.getByRole("heading", { level: 1, name: eventTitle })).toBeVisible();
    const eventId = page.url().split("/calendrier/")[1].split(/[?#]/)[0];

    await page.getByRole("link", { name: "Rédiger le compte rendu" }).click();
    await expect(page).toHaveURL(new RegExp(`/notes/nouvelle\\?evenement=${eventId}`));
    await expect(page.getByLabel("Titre")).toHaveValue(`Compte rendu — ${eventTitle}`);
    await expect(page.getByLabel("Date", { exact: true })).toHaveValue(day);
    await page.getByLabel("Compte rendu", { exact: true }).fill("Tour de table, rien à signaler.");
    await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Compte rendu — ${eventTitle}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `Réunion : ${eventTitle}` })).toBeVisible();

    await page.goto(`/calendrier/${eventId}`);
    await expect(
      page
        .getByRole("list", { name: "Comptes rendus" })
        .getByRole("link", { name: `Compte rendu — ${eventTitle}` }),
    ).toBeVisible();
  });

  test("sans action détectée, la syntaxe est expliquée", async ({ page }) => {
    await activateAssociate(page, "Pierre");
    await page.goto("/notes/nouvelle");
    const title = unique("Notes libres");
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Compte rendu", { exact: true }).fill("Échange informel, rien à faire.");
    await expect(page.getByText("Aucune action détectée pour l'instant.")).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer le compte rendu" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Aucune action détectée dans ce compte rendu.")).toBeVisible();
    await expect(page.getByText(/Une action par ligne/).first()).toBeVisible();
    await page.goto("/notes");
    await expect(
      page.getByRole("list", { name: "Comptes rendus" }).getByRole("link", { name: title }),
    ).toBeVisible();
  });
});
