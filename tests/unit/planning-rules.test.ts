import { describe, expect, it } from "vitest";
import { parseDateInput, startOfWeek, todayDate } from "@/lib/dates";
import {
  formatMinutes,
  isDueSoon,
  minutesBetween,
  overdueLevel,
  parseDuration,
  planMove,
  suggestPriority,
} from "@/features/planning/rules";

const d = (s: string) => parseDateInput(s)!;
const today = d("2026-10-12");

describe("suggestPriority", () => {
  it("explique chaque point et reste basse sans signal", () => {
    const s = suggestPriority({ impact: "FAIBLE", dueDate: null, today, blockingCount: 0, done: false });
    expect(s.priority).toBe("BASSE");
    expect(s.reasons).toContain("Sans échéance (+0)");
  });
  it("monte à urgente pour une tâche en retard, à fort impact, bloquante", () => {
    const s = suggestPriority({
      impact: "FORT",
      dueDate: d("2026-10-10"),
      today,
      blockingCount: 3,
      done: false,
    });
    expect(s.priority).toBe("URGENTE");
    expect(s.score).toBe(7);
    expect(s.reasons).toContain("En retard de 2 jours (+3)");
  });
  it("prend en compte la proximité de l'échéance", () => {
    expect(
      suggestPriority({ impact: "MOYEN", dueDate: d("2026-10-13"), today, blockingCount: 1, done: false })
        .priority,
    ).toBe("HAUTE");
    expect(
      suggestPriority({ impact: "MOYEN", dueDate: d("2026-10-30"), today, blockingCount: 0, done: false })
        .priority,
    ).toBe("BASSE");
  });
  it("ignore une tâche terminée", () => {
    expect(
      suggestPriority({ impact: "FORT", dueDate: d("2026-10-01"), today, blockingCount: 5, done: true })
        .priority,
    ).toBe("BASSE");
  });
});

describe("overdueLevel", () => {
  it("à l'heure le jour de l'échéance", () => expect(overdueLevel(d("2026-10-12"), today)).toBe(0));
  it("en retard le lendemain", () => expect(overdueLevel(d("2026-10-11"), today)).toBe(1));
  it("escalade après 48 h de retard", () => {
    expect(overdueLevel(d("2026-10-10"), today)).toBe(1);
    expect(overdueLevel(d("2026-10-09"), today)).toBe(2);
  });
  it("sans échéance : jamais en retard", () => expect(overdueLevel(null, today)).toBe(0));
  it("échéance proche", () => {
    expect(isDueSoon(d("2026-10-14"), today)).toBe(true);
    expect(isDueSoon(d("2026-10-15"), today)).toBe(false);
    expect(isDueSoon(d("2026-10-11"), today)).toBe(false);
  });
});

describe("planMove", () => {
  const tasks = [
    { id: "A", title: "Brief", startDate: d("2026-10-01"), dueDate: d("2026-10-05"), done: false },
    { id: "B", title: "Tournage", startDate: d("2026-10-06"), dueDate: d("2026-10-08"), done: false },
    { id: "C", title: "Montage", startDate: d("2026-10-09"), dueDate: d("2026-10-12"), done: false },
    { id: "D", title: "Indépendante", startDate: d("2026-10-01"), dueDate: d("2026-10-20"), done: false },
  ];
  const edges = [
    { taskId: "B", dependsOnId: "A" },
    { taskId: "C", dependsOnId: "B" },
  ];

  it("n'impose rien quand le déplacement reste compatible", () => {
    const r = planMove(tasks, edges, "A", d("2026-09-28"), d("2026-10-02"));
    expect(r.conflicts).toEqual([]);
    expect(r.cascade).toEqual([]);
  });

  it("signale le conflit et propose une cascade minimale qui garde les durées", () => {
    const r = planMove(tasks, edges, "A", d("2026-10-03"), d("2026-10-07"));
    expect(r.conflicts.map((c) => c.id)).toEqual(["B"]);
    expect(
      r.cascade.map((c) => [c.id, c.to[0].toISOString().slice(0, 10), c.to[1].toISOString().slice(0, 10)]),
    ).toEqual([
      ["B", "2026-10-08", "2026-10-10"],
      ["C", "2026-10-11", "2026-10-14"],
    ]);
    // La tâche indépendante n'est jamais touchée.
    expect(r.cascade.some((c) => c.id === "D")).toBe(false);
  });

  it("signale un démarrage avant la fin d'un prédécesseur", () => {
    const r = planMove(tasks, edges, "C", d("2026-10-07"), d("2026-10-10"));
    expect(r.conflicts[0].message).toContain("Tournage");
    expect(r.cascade).toEqual([]);
  });

  it("ne décale pas une tâche suivante déjà terminée", () => {
    const withDone = tasks.map((t) => (t.id === "B" ? { ...t, done: true } : t));
    expect(planMove(withDone, edges, "A", d("2026-10-03"), d("2026-10-07")).cascade).toEqual([]);
  });
});

describe("durées", () => {
  it.each([
    ["1h30", 90],
    ["1:30", 90],
    ["1,5", 90],
    ["2h", 120],
    ["2", 120],
    ["45", 45],
    ["90min", 90],
    ["0h45", 45],
  ])("%s → %i min", (raw, expected) => expect(parseDuration(raw)).toBe(expected));
  it("rejette les saisies illisibles", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("1:75")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
  it("formate", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(90)).toBe("1 h 30");
    expect(formatMinutes(120)).toBe("2 h");
  });
  it("compte les minutes réelles à travers le passage à l'heure d'hiver", () => {
    // 25 oct. 2026 : 03:00 Paris → 02:00. De 01:30 à 03:30 heure locale = 3 h réelles.
    const start = new Date("2026-10-24T23:30:00Z");
    const end = new Date("2026-10-25T02:30:00Z");
    expect(minutesBetween(start, end)).toBe(180);
  });
  it("jour Paris et début de semaine", () => {
    expect(todayDate(new Date("2026-10-11T22:30:00Z")).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(startOfWeek(d("2026-10-15")).toISOString().slice(0, 10)).toBe("2026-10-12");
    expect(startOfWeek(d("2026-10-18")).toISOString().slice(0, 10)).toBe("2026-10-12");
  });
});
