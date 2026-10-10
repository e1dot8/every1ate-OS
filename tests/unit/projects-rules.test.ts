import { describe, expect, it } from "vitest";
import { checkProjectTransition, checkTaskTransition, findDependencyCycle } from "@/features/projects/rules";
import { CLOSURE_ITEMS, TEMPLATES, getTemplate, planTemplate } from "@/features/projects/templates";
import { addDays, formatDay, parseDateInput, toDateInput } from "@/lib/dates";

const ctx = { reason: null, closureComplete: false, actorIsOwner: true };

describe("transitions de projet", () => {
  it("autorise À préparer → Actif", () =>
    expect(checkProjectTransition("A_PREPARER", "ACTIF", ctx).ok).toBe(true));
  it("refuse À préparer → Terminé", () =>
    expect(checkProjectTransition("A_PREPARER", "TERMINE", ctx).ok).toBe(false));
  it("exige une raison pour Bloqué", () => {
    expect(checkProjectTransition("ACTIF", "BLOQUE", ctx).ok).toBe(false);
    expect(checkProjectTransition("ACTIF", "BLOQUE", { ...ctx, reason: "Client injoignable" }).ok).toBe(true);
  });
  it("refuse la clôture si la checklist est incomplète", () => {
    const r = checkProjectTransition("ACTIF", "TERMINE", ctx);
    expect(r.ok).toBe(false);
  });
  it("réserve la clôture au responsable global", () => {
    expect(
      checkProjectTransition("ACTIF", "TERMINE", { ...ctx, closureComplete: true, actorIsOwner: false }).ok,
    ).toBe(false);
    expect(checkProjectTransition("ACTIF", "TERMINE", { ...ctx, closureComplete: true }).ok).toBe(true);
  });
  it("archive seulement un projet terminé, et le restaure", () => {
    expect(checkProjectTransition("ACTIF", "ARCHIVE", ctx).ok).toBe(false);
    expect(checkProjectTransition("TERMINE", "ARCHIVE", ctx).ok).toBe(true);
    expect(checkProjectTransition("ARCHIVE", "TERMINE", { ...ctx, actorIsOwner: false }).ok).toBe(true);
  });
});

describe("transitions de tâche", () => {
  const none = { reason: null, unfinishedPredecessors: [] };
  it("exige une raison pour bloquer ou annuler", () => {
    expect(checkTaskTransition("EN_COURS", "BLOQUE", none).ok).toBe(false);
    expect(checkTaskTransition("EN_COURS", "ANNULE", none).ok).toBe(false);
    expect(checkTaskTransition("EN_COURS", "BLOQUE", { ...none, reason: "Studio indisponible" }).ok).toBe(
      true,
    );
  });
  it("refuse Terminé tant qu'une tâche attendue n'est pas finie", () => {
    const r = checkTaskTransition("EN_COURS", "TERMINE", {
      reason: null,
      unfinishedPredecessors: ["« Shooting »"],
    });
    expect(r).toEqual({ ok: false, error: "Terminez d'abord : « Shooting »." });
  });
  it("autorise de démarrer malgré une dépendance non terminée", () => {
    expect(
      checkTaskTransition("A_FAIRE", "EN_COURS", { reason: null, unfinishedPredecessors: ["« Shooting »"] })
        .ok,
    ).toBe(true);
  });
});

describe("détection des boucles de dépendances", () => {
  const edges = [
    { taskId: "B", dependsOnId: "A" },
    { taskId: "C", dependsOnId: "B" },
  ];
  it("accepte une dépendance sans boucle", () => expect(findDependencyCycle(edges, "D", "C")).toBeNull());
  it("refuse une tâche qui s'attend elle-même", () =>
    expect(findDependencyCycle(edges, "A", "A")).not.toBeNull());
  it("refuse une boucle indirecte et renvoie le chemin", () => {
    expect(findDependencyCycle(edges, "A", "C")).toEqual(["A", "C", "B", "A"]);
  });
  it("une dépendance ne concerne que les tâches reliées", () =>
    expect(findDependencyCycle(edges, "X", "A")).toBeNull());
});

describe("modèles de projet", () => {
  it("propose les 4 modèles du cahier des charges", () => {
    expect(TEMPLATES.map((t) => t.name)).toEqual([
      "Production audiovisuelle",
      "Campagne créative",
      "Conseil / stratégie",
      "Projet vierge",
    ]);
  });
  it("recalcule les dates depuis la date de début", () => {
    const start = parseDateInput("2026-11-02")!;
    const { lots, plannedEnd } = planTemplate(getTemplate("campagne-creative")!, start);
    expect(toDateInput(lots[0].tasks[0].startDate)).toBe("2026-11-02");
    expect(toDateInput(lots[0].tasks[0].dueDate)).toBe("2026-11-04");
    expect(plannedEnd).toEqual(addDays(start, 52));
  });
  it("chaque dépendance de modèle référence une tâche existante", () => {
    for (const t of TEMPLATES) {
      const titles = new Set(t.lots.flatMap((l) => l.tasks.map((x) => x.title)));
      for (const task of t.lots.flatMap((l) => l.tasks))
        if (task.after) expect(titles.has(task.after)).toBe(true);
    }
  });
  it("la checklist de clôture couvre les 6 points du §14.3", () => expect(CLOSURE_ITEMS).toHaveLength(6));
});

describe("dates calendrier", () => {
  it("rejette une date invalide", () => {
    expect(parseDateInput("2026-02-30")).toBeNull();
    expect(parseDateInput("pas une date")).toBeNull();
  });
  it("formate sans décalage de fuseau", () =>
    expect(formatDay(parseDateInput("2026-11-03"), new Date("2026-10-10T12:00:00Z"))).toBe("3 nov."));
});
