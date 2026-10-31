import { describe, expect, it, vi } from "vitest";
import { loadGrid, loadTone } from "@/features/planning/load-service";
import { parseDateInput } from "@/lib/dates";

vi.mock("@/lib/db/client", () => ({
  getDb: () => {
    throw new Error("Pas de base en test unitaire.");
  },
}));

const d = (s: string) => parseDateInput(s)!;
const today = d("2026-10-14"); // mercredi

describe("charge à venir : seuils", () => {
  it("chargé au-delà de 85 %, surchargé au-delà de 100 %", () => {
    expect(loadTone(0)).toBe("normal");
    expect(loadTone(85)).toBe("normal");
    expect(loadTone(86)).toBe("warning");
    expect(loadTone(100)).toBe("warning");
    expect(loadTone(101)).toBe("danger");
  });
});

describe("charge à venir : grille associé × semaine", () => {
  const associates = [
    { id: "j", name: "Johan", weeklyCapacityHours: 20 },
    { id: "c", name: "Charles", weeklyCapacityHours: null },
  ];

  it("capacité personnelle sinon celle de l'agence ; non planifié par associé", () => {
    const g = loadGrid({
      associates,
      today,
      defaultWeeklyHours: 35,
      tasks: [
        // 3 jours ouvrés (14 → 16 oct.) : 21 h sur la semaine en cours.
        { ownerId: "j", startDate: null, dueDate: d("2026-10-16"), estimatedMinutes: 1260, loggedMinutes: 0 },
        // En retard : le reste (2 h) pèse sur la semaine en cours.
        { ownerId: "c", startDate: null, dueDate: d("2026-10-01"), estimatedMinutes: 180, loggedMinutes: 60 },
        // Sans échéance : non planifié, propre à chaque associé.
        { ownerId: "j", startDate: null, dueDate: null, estimatedMinutes: 300, loggedMinutes: 60 },
        { ownerId: "c", startDate: null, dueDate: null, estimatedMinutes: 90, loggedMinutes: 0 },
        // Déjà dépassée (temps passé > estimation) ou sans estimation : ne pèse pas.
        { ownerId: "c", startDate: null, dueDate: null, estimatedMinutes: 60, loggedMinutes: 120 },
        { ownerId: "c", startDate: null, dueDate: d("2026-10-20"), estimatedMinutes: null, loggedMinutes: 0 },
      ],
    });
    expect(g.weekStarts).toHaveLength(6);
    expect(g.weekStarts[0]).toEqual(d("2026-10-12"));
    const [johan, charles] = g.rows;
    expect(johan).toMatchObject({ capacityHours: 20, capacityIsDefault: false, unplannedMinutes: 240 });
    expect(johan.cells[0]).toMatchObject({ minutes: 1260, pct: 105, tone: "danger" });
    expect(johan.cells[1]).toMatchObject({ minutes: 0, pct: 0, tone: "normal" });
    expect(charles).toMatchObject({ capacityHours: 35, capacityIsDefault: true, unplannedMinutes: 90 });
    expect(charles.cells[0]).toMatchObject({ minutes: 120, pct: 6, tone: "normal" });
  });

  it("aucune tâche : toutes les semaines à 0 %", () => {
    const g = loadGrid({ associates, today, defaultWeeklyHours: 35, tasks: [], weeks: 3 });
    expect(g.rows.map((r) => r.cells.map((c) => c.pct))).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(g.rows.every((r) => r.unplannedMinutes === 0)).toBe(true);
  });

  it("répartition sur plusieurs semaines, à partir du début de la tâche", () => {
    const g = loadGrid({
      associates: [associates[0]],
      today,
      defaultWeeklyHours: 35,
      tasks: [
        // Du lundi 19 au vendredi 30 oct. : 10 jours ouvrés, 1 h 30 par jour.
        {
          ownerId: "j",
          startDate: d("2026-10-19"),
          dueDate: d("2026-10-30"),
          estimatedMinutes: 900,
          loggedMinutes: 0,
        },
      ],
    });
    expect(g.rows[0].cells.slice(0, 4).map((c) => c.minutes)).toEqual([0, 450, 450, 0]);
    expect(g.rows[0].cells[1]).toMatchObject({ pct: 38, tone: "normal" });
  });
});
