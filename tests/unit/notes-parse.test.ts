import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/dates";
import { DONE_MARK, markLinesDone, parseActions, reconcileActions } from "@/features/notes/parse";
import { canReceiveTasks, pendingActionsLabel, tasksCreatedLabel } from "@/features/notes/rules";

const today = parseDateInput("2026-10-14")!; // mercredi
const people = [
  { id: "j", name: "Johan" },
  { id: "c", name: "Charles" },
  { id: "p", name: "Pierre" },
];

const BODY = [
  "Point d'avancement",
  "- [ ] Envoyer le devis V2 @Charles demain",
  "TODO : relancer le photographe @johan vendredi",
  "Le client valide la DA.",
  "→ Préparer le moodboard le 15/11",
  "  * À faire : réserver le studio",
  "Action : appeler la régie",
  "-> Vérifier les droits",
].join("\n");

describe("markLinesDone", () => {
  it("remplace le marqueur par « [x] » en gardant puce, indentation et texte", () => {
    const out = markLinesDone(BODY, [2, 3, 5, 6, 7, 8]).split("\n");
    expect(out).toEqual([
      "Point d'avancement",
      "- [x] Envoyer le devis V2 @Charles demain",
      "[x] relancer le photographe @johan vendredi",
      "Le client valide la DA.",
      "[x] Préparer le moodboard le 15/11",
      "  * [x] réserver le studio",
      "[x] appeler la régie",
      "[x] Vérifier les droits",
    ]);
  });

  it("ne touche ni aux lignes ordinaires ni aux numéros hors du texte", () => {
    expect(markLinesDone(BODY, [1, 4, 99])).toBe(BODY);
    expect(markLinesDone(BODY, [])).toBe(BODY);
  });

  it("conserve les fins de ligne \\r\\n (texte envoyé par un formulaire)", () => {
    const crlf = "Intro\r\n[ ] Action A\r\n[ ] Action B\r\n";
    expect(markLinesDone(crlf, [3])).toBe("Intro\r\n[ ] Action A\r\n[x] Action B\r\n");
  });

  it("une ligne « [x] » n'est jamais détectée comme action", () => {
    for (const line of ["[x] Fait", "- [x] Fait", "[X] Fait", `  * ${DONE_MARK} Fait`])
      expect(parseActions(line, people, today)).toEqual([]);
  });
});

describe("aller-retour parse → marque → parse", () => {
  it("les lignes marquées ne sont plus proposées, les autres gardent leur numéro", () => {
    const first = parseActions(BODY, people, today);
    expect(first.map((a) => a.line)).toEqual([2, 3, 5, 6, 7, 8]);
    const marked = markLinesDone(
      BODY,
      first.filter((a) => a.line !== 6).map((a) => a.line),
    );
    const second = parseActions(marked, people, today);
    expect(second.map((a) => [a.line, a.title])).toEqual([[6, "Réserver le studio"]]);
    expect(parseActions(markLinesDone(marked, [6]), people, today)).toEqual([]);
  });

  it("marquer deux fois ne change plus rien (idempotent)", () => {
    const once = markLinesDone(BODY, [2, 3]);
    expect(markLinesDone(once, [2, 3])).toBe(once);
  });

  it("le responsable et l'échéance restent lisibles après marquage", () => {
    const [a] = parseActions(BODY, people, today);
    expect([a.title, a.ownerId, a.dueDate?.toISOString().slice(0, 10)]).toEqual([
      "Envoyer le devis V2",
      "c",
      "2026-10-15",
    ]);
    expect(markLinesDone(BODY, [a.line])).toContain("- [x] Envoyer le devis V2 @Charles demain");
  });
});

describe("reconcileActions (idempotence côté serveur)", () => {
  const detected = parseActions(BODY, people, today);
  const sent = (line: number, raw?: string) => ({
    line,
    raw: raw ?? detected.find((d) => d.line === line)?.raw ?? "",
    title: `L${line}`,
  });

  it("retient les lignes encore détectées et identiques", () => {
    const r = reconcileActions(detected, [sent(2), sent(3)]);
    expect(r.accepted.map((a) => a.line)).toEqual([2, 3]);
    expect(r).toMatchObject({ skipped: 0, stale: false });
  });

  it("un nouvel envoi après succès ne recrée rien (lignes déjà « [x] »)", () => {
    const after = parseActions(markLinesDone(BODY, [2, 3]), people, today);
    const r = reconcileActions(after, [sent(2), sent(3)]);
    expect(r.accepted).toEqual([]);
    expect(r).toMatchObject({ skipped: 2, stale: false });
  });

  it("signale un compte rendu modifié entre-temps", () => {
    const r = reconcileActions(detected, [sent(2, "[ ] Autre chose")]);
    expect(r).toMatchObject({ accepted: [], stale: true });
  });

  it("une même ligne envoyée deux fois n'est retenue qu'une fois", () => {
    const r = reconcileActions(detected, [sent(5), sent(5)]);
    expect(r.accepted).toHaveLength(1);
  });

  it("tolère les espaces autour du texte d'origine", () => {
    const raw = detected.find((d) => d.line === 6)!.raw;
    expect(reconcileActions(detected, [sent(6, `  ${raw} `)]).accepted).toHaveLength(1);
  });
});

describe("règles des comptes rendus", () => {
  it("seuls les projets en cours reçoivent des tâches", () => {
    expect(canReceiveTasks({ status: "ACTIF", archivedAt: null })).toBe(true);
    expect(canReceiveTasks({ status: "A_PREPARER", archivedAt: null })).toBe(true);
    expect(canReceiveTasks({ status: "BLOQUE", archivedAt: null })).toBe(true);
    expect(canReceiveTasks({ status: "TERMINE", archivedAt: null })).toBe(false);
    expect(canReceiveTasks({ status: "ARCHIVE", archivedAt: null })).toBe(false);
    expect(canReceiveTasks({ status: "ACTIF", archivedAt: new Date() })).toBe(false);
  });

  it("libellés au singulier et au pluriel", () => {
    expect(tasksCreatedLabel(0)).toBe("Aucune tâche créée");
    expect(tasksCreatedLabel(1)).toBe("1 tâche créée");
    expect(tasksCreatedLabel(2)).toBe("2 tâches créées");
    expect(pendingActionsLabel(1)).toBe("1 action à traiter");
    expect(pendingActionsLabel(3)).toBe("3 actions à traiter");
  });
});
