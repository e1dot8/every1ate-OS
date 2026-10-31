import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/dates";
import {
  buildNextOccurrence,
  normalizeRecurrence,
  occurrenceCreatedMessage,
  recurrenceIssue,
  recurrenceSummary,
  type CompletedTask,
} from "@/features/projects/recurrence";

const d = (s: string) => parseDateInput(s)!;
const iso = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);
const today = d("2026-10-14");
const now = new Date("2026-10-14T10:00:00Z");

const weekly: CompletedTask = {
  projectId: "projet-1",
  workPackageId: "lot-1",
  title: "Point hebdo",
  description: "Ordre du jour partagé",
  ownerId: "johan",
  contributorIds: ["charles", "johan", "charles"],
  priority: "HAUTE",
  priorityLocked: true,
  impact: "FORT",
  recurrence: "HEBDOMADAIRE",
  recurrenceUntil: null,
  startDate: d("2026-10-12"),
  dueDate: d("2026-10-16"),
  estimatedMinutes: 90,
  nextOccurrenceId: null,
};
const open = { today, projectOpen: true };

describe("récurrence : saisie", () => {
  it("une tâche répétée exige une échéance", () => {
    expect(recurrenceIssue({ recurrence: "HEBDOMADAIRE", dueDate: null, recurrenceUntil: null })).toEqual({
      field: "dueDate",
      message: "Une tâche répétée a besoin d'une échéance.",
    });
    expect(recurrenceIssue({ recurrence: "AUCUNE", dueDate: null, recurrenceUntil: null })).toBeNull();
  });

  it("« Jusqu'au » ne précède pas l'échéance (le même jour est accepté)", () => {
    expect(
      recurrenceIssue({ recurrence: "MENSUELLE", dueDate: d("2026-10-16"), recurrenceUntil: d("2026-10-15") })
        ?.field,
    ).toBe("recurrenceUntil");
    expect(
      recurrenceIssue({
        recurrence: "MENSUELLE",
        dueDate: d("2026-10-16"),
        recurrenceUntil: d("2026-10-16"),
      }),
    ).toBeNull();
  });

  it("sans répétition, la date de fin est effacée", () => {
    expect(normalizeRecurrence({ recurrence: "AUCUNE", recurrenceUntil: d("2026-12-31") })).toEqual({
      recurrence: "AUCUNE",
      recurrenceUntil: null,
    });
    expect(normalizeRecurrence({ recurrence: "HEBDOMADAIRE", recurrenceUntil: d("2026-12-31") })).toEqual({
      recurrence: "HEBDOMADAIRE",
      recurrenceUntil: d("2026-12-31"),
    });
  });
});

describe("récurrence : libellés", () => {
  it("résumé affiché sur la tâche", () => {
    expect(recurrenceSummary("AUCUNE", null, now)).toBeNull();
    expect(recurrenceSummary("HEBDOMADAIRE", null, now)).toBe("Répète chaque semaine");
    expect(recurrenceSummary("MENSUELLE", d("2026-12-03"), now)).toBe("Répète chaque mois jusqu'au 3 déc.");
    expect(recurrenceSummary("MENSUELLE", d("2027-03-01"), now)).toBe(
      "Répète chaque mois jusqu'au 1 mars 2027",
    );
  });

  it("message de confirmation", () => {
    expect(occurrenceCreatedMessage(d("2026-10-23"), now)).toBe("Prochaine occurrence créée pour le 23 oct.");
    expect(occurrenceCreatedMessage(d("2027-05-04"), now)).toBe(
      "Prochaine occurrence créée pour le 4 mai 2027.",
    );
  });
});

describe("récurrence : occurrence suivante", () => {
  it("recopie les champs saisis et décale les dates d'une semaine", () => {
    const next = buildNextOccurrence(weekly, open)!;
    expect(next).toMatchObject({
      projectId: "projet-1",
      workPackageId: "lot-1",
      title: "Point hebdo",
      description: "Ordre du jour partagé",
      ownerId: "johan",
      priority: "HAUTE",
      priorityLocked: true,
      impact: "FORT",
      recurrence: "HEBDOMADAIRE",
      recurrenceUntil: null,
      estimatedMinutes: 90,
      status: "A_FAIRE",
    });
    expect(iso(next.startDate)).toBe("2026-10-19");
    expect(iso(next.dueDate)).toBe("2026-10-23");
    // Contributeurs sans doublon ni responsable ; aucun champ de lien recopié.
    expect(next.contributorIds).toEqual(["charles"]);
    expect(next).not.toHaveProperty("nextOccurrenceId");
  });

  it("mensuelle : reste dans le mois cible", () => {
    const next = buildNextOccurrence(
      { ...weekly, recurrence: "MENSUELLE", startDate: null, dueDate: d("2026-01-31") },
      { today: d("2026-01-31"), projectOpen: true },
    )!;
    expect(next.startDate).toBeNull();
    expect(iso(next.dueDate)).toBe("2026-02-28");
  });

  it("terminée en retard : l'occurrence suivante ne naît pas déjà en retard", () => {
    const next = buildNextOccurrence({ ...weekly, startDate: null, dueDate: d("2026-09-30") }, open)!;
    expect(iso(next.dueDate)).toBe("2026-10-14");
  });

  it("priorité automatique recalculée pour la nouvelle échéance", () => {
    // Impact faible, échéance à 9 jours : la priorité suggérée retombe à « Basse ».
    const next = buildNextOccurrence(
      { ...weekly, priority: "URGENTE", priorityLocked: false, impact: "FAIBLE" },
      open,
    )!;
    expect(next.priorityLocked).toBe(false);
    expect(next.priority).toBe("BASSE");
  });

  it("une seule occurrence : rien si elle existe déjà (réouverture puis nouvelle clôture)", () => {
    expect(buildNextOccurrence({ ...weekly, nextOccurrenceId: "tache-2" }, open)).toBeNull();
  });

  it("rien sans répétition, sans échéance, au-delà de la fin ou dans un projet fermé", () => {
    expect(buildNextOccurrence({ ...weekly, recurrence: "AUCUNE" }, open)).toBeNull();
    expect(buildNextOccurrence({ ...weekly, dueDate: null }, open)).toBeNull();
    expect(buildNextOccurrence({ ...weekly, recurrenceUntil: d("2026-10-22") }, open)).toBeNull();
    expect(buildNextOccurrence({ ...weekly, recurrenceUntil: d("2026-10-23") }, open)).not.toBeNull();
    expect(buildNextOccurrence(weekly, { today, projectOpen: false })).toBeNull();
  });
});
