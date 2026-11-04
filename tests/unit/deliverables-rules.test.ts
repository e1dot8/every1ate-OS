import { describe, expect, it } from "vitest";
import type { DeliverableStage } from "@/generated/prisma/enums";
import { parseDateInput } from "@/lib/dates";
import {
  DELIVERABLE_ARCHIVED_ISSUE,
  FORMATS,
  PROJECT_ARCHIVED_ISSUE,
  STAGES,
  WORK_STAGES,
  activityText,
  advanceOnCheck,
  autoAdvanceTarget,
  blockReasonIssue,
  calendarGroups,
  deliverableLockIssue,
  endOfWeek,
  formatEmojis,
  formatLabels,
  globalProgress,
  isDueWithin,
  isHttpsUrl,
  isLate,
  nextStage,
  previousStage,
  shouldAutoAdvance,
  stageLabels,
  stageProgress,
  startOfMonth,
  upcomingWeeks,
} from "@/features/deliverables/rules";

const d = (s: string) => parseDateInput(s)!;
const iso = (x: Date) => x.toISOString().slice(0, 10);
const today = d("2026-11-04"); // mercredi
const done = new Date("2026-11-03T10:00:00Z");
const item = (stage: DeliverableStage, checked: boolean) => ({ stage, doneAt: checked ? done : null });

describe("étapes et formats", () => {
  it("six étapes dans l'ordre, libellées en français", () => {
    expect(STAGES.map((s) => stageLabels[s])).toEqual([
      "Préparation",
      "Création",
      "Production",
      "Montage",
      "Livraison",
      "Livré",
    ]);
    expect(WORK_STAGES).not.toContain("LIVRE");
  });

  it("nextStage / previousStage", () => {
    expect(nextStage("PREPARATION")).toBe("CREATION");
    expect(nextStage("MONTAGE")).toBe("LIVRAISON");
    expect(nextStage("LIVRAISON")).toBe("LIVRE");
    expect(nextStage("LIVRE")).toBeNull();
    expect(previousStage("PREPARATION")).toBeNull();
    expect(previousStage("LIVRE")).toBe("LIVRAISON");
  });

  it("chaque format a un libellé et un emoji", () => {
    for (const f of FORMATS) {
      expect(formatLabels[f]).toBeTruthy();
      expect(formatEmojis[f]).toBeTruthy();
    }
    expect(formatLabels.CAROUSEL).toBe("Carrousel");
    expect(formatLabels.VIDEO).toBe("Vidéo");
  });
});

describe("progression", () => {
  const items = [
    item("PREPARATION", true),
    item("PREPARATION", true),
    item("CREATION", true),
    item("CREATION", false),
    item("CREATION", false),
    item("MONTAGE", false),
  ];

  it("progression d'une étape : cochés / total", () => {
    expect(stageProgress(items, "PREPARATION")).toEqual({ done: 2, total: 2 });
    expect(stageProgress(items, "CREATION")).toEqual({ done: 1, total: 3 });
    expect(stageProgress(items, "PRODUCTION")).toEqual({ done: 0, total: 0 });
  });

  it("progression globale : part des points cochés, 100 % une fois livré", () => {
    expect(globalProgress(items, "CREATION")).toEqual({ done: 3, total: 6, percent: 50 });
    expect(globalProgress(items, "LIVRE").percent).toBe(100);
    // Sans checklist : position dans les étapes.
    expect(globalProgress([], "PREPARATION").percent).toBe(0);
    expect(globalProgress([], "MONTAGE").percent).toBe(60);
  });
});

describe("retards", () => {
  it("en retard : échéance avant aujourd'hui et pas livré", () => {
    expect(isLate({ dueDate: d("2026-11-03"), stage: "MONTAGE" }, today)).toBe(true);
    expect(isLate({ dueDate: d("2026-11-04"), stage: "MONTAGE" }, today)).toBe(false);
    expect(isLate({ dueDate: d("2026-11-03"), stage: "LIVRE" }, today)).toBe(false);
    expect(isLate({ dueDate: null, stage: "CREATION" }, today)).toBe(false);
  });

  it("échéance sous n jours, semaine et mois", () => {
    expect(isDueWithin(d("2026-11-11"), today, 7)).toBe(true);
    expect(isDueWithin(d("2026-11-12"), today, 7)).toBe(false);
    expect(isDueWithin(d("2026-11-03"), today, 7)).toBe(false);
    expect(isDueWithin(null, today, 7)).toBe(false);
    expect(iso(endOfWeek(today))).toBe("2026-11-08");
    expect(iso(startOfMonth(today))).toBe("2026-11-01");
  });
});

describe("passage automatique d'étape", () => {
  it("toute l'étape cochée (au moins un point) → passage", () => {
    expect(shouldAutoAdvance([item("MONTAGE", true), item("MONTAGE", true)], "MONTAGE")).toBe(true);
    expect(shouldAutoAdvance([item("MONTAGE", true), item("MONTAGE", false)], "MONTAGE")).toBe(false);
    // Étape vide : passage laissé à l'équipe.
    expect(shouldAutoAdvance([item("CREATION", true)], "MONTAGE")).toBe(false);
    // Les points des autres étapes ne comptent pas.
    expect(shouldAutoAdvance([item("MONTAGE", true), item("LIVRAISON", false)], "MONTAGE")).toBe(true);
    expect(shouldAutoAdvance([], "LIVRE")).toBe(false);
  });

  it("enchaîne les étapes déjà complètes et s'arrête à la première incomplète ou vide", () => {
    const items = [
      item("PREPARATION", true),
      item("CREATION", true),
      item("PRODUCTION", false),
      item("MONTAGE", true),
    ];
    expect(autoAdvanceTarget(items, "PREPARATION")).toBe("PRODUCTION");
    expect(autoAdvanceTarget(items, "PRODUCTION")).toBeNull();
    // Montage complet, Livraison sans point : on s'arrête en Livraison.
    expect(autoAdvanceTarget(items, "MONTAGE")).toBe("LIVRAISON");
  });

  it("Livraison complète → Livré", () => {
    expect(autoAdvanceTarget([item("LIVRAISON", true), item("LIVRAISON", true)], "LIVRAISON")).toBe("LIVRE");
    expect(autoAdvanceTarget([item("LIVRAISON", true)], "LIVRE")).toBeNull();
  });

  it("seul un point coché de l'étape courante fait avancer", () => {
    const items = [item("CREATION", true), item("CREATION", true), item("PRODUCTION", true)];
    expect(advanceOnCheck({ items, stage: "CREATION", itemStage: "CREATION", done: true })).toBe("MONTAGE");
    // Coché en avance (autre étape) : rien ne bouge.
    expect(advanceOnCheck({ items, stage: "CREATION", itemStage: "PRODUCTION", done: true })).toBeNull();
    // Décocher ne fait jamais reculer ni avancer.
    expect(advanceOnCheck({ items, stage: "CREATION", itemStage: "CREATION", done: false })).toBeNull();
    // Dernier point de Livraison : livré.
    expect(
      advanceOnCheck({
        items: [item("LIVRAISON", true)],
        stage: "LIVRAISON",
        itemStage: "LIVRAISON",
        done: true,
      }),
    ).toBe("LIVRE");
  });
});

describe("validation", () => {
  it("motif de blocage : 3 caractères minimum", () => {
    expect(blockReasonIssue("ab")).not.toBeNull();
    expect(blockReasonIssue("   ab  ")).not.toBeNull();
    expect(blockReasonIssue(null)).not.toBeNull();
    expect(blockReasonIssue("Attente rushes")).toBeNull();
    expect(blockReasonIssue("x".repeat(501))).not.toBeNull();
  });

  it("lecture seule : livrable archivé ou projet archivé", () => {
    const open = { archivedAt: null, project: { archivedAt: null } };
    expect(deliverableLockIssue(open)).toBeNull();
    expect(deliverableLockIssue({ ...open, archivedAt: done })).toBe(DELIVERABLE_ARCHIVED_ISSUE);
    expect(deliverableLockIssue({ ...open, project: { archivedAt: done } })).toBe(PROJECT_ARCHIVED_ISSUE);
    expect(PROJECT_ARCHIVED_ISSUE).toMatch(/Projet archivé/);
    expect(deliverableLockIssue({ archivedAt: done, project: { archivedAt: done } })).toBe(
      DELIVERABLE_ARCHIVED_ISSUE,
    );
  });

  it("lien : https uniquement", () => {
    expect(isHttpsUrl("https://drive.google.com/drive/folders/abc")).toBe(true);
    expect(isHttpsUrl("http://exemple.test")).toBe(false);
    expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsUrl("drive.google.com")).toBe(false);
  });
});

describe("calendrier", () => {
  it("six semaines du lundi au dimanche, à partir de la semaine en cours", () => {
    const weeks = upcomingWeeks(today);
    expect(weeks).toHaveLength(6);
    expect(iso(weeks[0].start)).toBe("2026-11-02");
    expect(iso(weeks[0].end)).toBe("2026-11-08");
    expect(iso(weeks[5].start)).toBe("2026-12-07");
  });

  it("« En retard » puis échéances et publications groupées par semaine", () => {
    const rows = [
      { id: "late", dueDate: d("2026-10-30"), publishDate: null, stage: "MONTAGE" as const },
      { id: "week", dueDate: d("2026-11-06"), publishDate: d("2026-11-12"), stage: "CREATION" as const },
      { id: "done", dueDate: d("2026-11-05"), publishDate: d("2026-11-09"), stage: "LIVRE" as const },
      { id: "far", dueDate: d("2027-03-01"), publishDate: null, stage: "PREPARATION" as const },
    ];
    const { late, weeks } = calendarGroups(rows, today);
    expect(late.map((r) => r.id)).toEqual(["late"]);
    expect(weeks[0].entries.map((e) => `${e.item.id}:${e.kind}`)).toEqual(["week:echeance"]);
    // Livré : plus d'échéance, mais sa publication reste au calendrier.
    expect(weeks[1].entries.map((e) => `${e.item.id}:${e.kind}`)).toEqual([
      "done:publication",
      "week:publication",
    ]);
    expect(weeks.flatMap((w) => w.entries).some((e) => e.item.id === "far")).toBe(false);
  });
});

describe("activité lisible", () => {
  it("décrit chaque action du journal", () => {
    expect(activityText("deliverable.item_checked", null, { label: "Script validé" })).toBe(
      "a coché « Script validé »",
    );
    expect(activityText("deliverable.item_unchecked", null, { label: "Script validé" })).toBe(
      "a décoché « Script validé »",
    );
    expect(activityText("deliverable.stage_changed", { stage: "PRODUCTION" }, { stage: "MONTAGE" })).toBe(
      "a passé le livrable en Montage",
    );
    expect(activityText("deliverable.stage_changed", null, { stage: "MONTAGE", auto: true })).toBe(
      "a coché le dernier point : passage automatique en Montage",
    );
    expect(activityText("deliverable.blocked", null, { blockedReason: "Attente musique" })).toBe(
      "a bloqué le livrable : Attente musique",
    );
    expect(activityText("deliverable.item_renamed", { label: "A" }, { label: "B" })).toBe(
      "a renommé « A » en « B »",
    );
    expect(
      activityText("deliverable.item_assigned", null, {
        label: "Sous-titres",
        assigneeName: "Pierre",
        dueDate: "2026-11-06T00:00:00.000Z",
      }),
      // L'année n'est affichée que si elle diffère de l'année en cours.
    ).toMatch(/^a confié « Sous-titres » à Pierre pour le 6 nov\./);
    expect(activityText("deliverable.inconnu", null, null)).toBe("a modifié le livrable");
  });
});
