/**
 * Règles pures du lot 3 : priorité suggérée, retard et escalade, cascade de dates,
 * durées. Aucune dépendance serveur : testées unitairement.
 */
import { addDays, daysBetween } from "@/lib/dates";

export type PriorityLevel = "BASSE" | "NORMALE" | "HAUTE" | "URGENTE";
export type ImpactLevel = "FAIBLE" | "MOYEN" | "FORT";

const LEVELS: PriorityLevel[] = ["BASSE", "NORMALE", "HAUTE", "URGENTE"];

export type PriorityInput = {
  impact: ImpactLevel;
  dueDate: Date | null;
  today: Date;
  /** Nombre de tâches non terminées qui attendent celle-ci. */
  blockingCount: number;
  done: boolean;
};

export type PrioritySuggestion = { priority: PriorityLevel; score: number; reasons: string[] };

/**
 * Score transparent (§7.4) : impact + proximité de l'échéance + retard + dépendances.
 * Chaque point attribué est expliqué dans `reasons`.
 */
export function suggestPriority(input: PriorityInput): PrioritySuggestion {
  const reasons: string[] = [];
  if (input.done) return { priority: "BASSE", score: 0, reasons: ["Tâche terminée ou annulée."] };
  let score = 0;
  if (input.impact === "FORT") {
    score += 2;
    reasons.push("Impact fort (+2)");
  } else if (input.impact === "MOYEN") {
    score += 1;
    reasons.push("Impact moyen (+1)");
  } else reasons.push("Impact faible (+0)");

  if (input.dueDate) {
    const days = daysBetween(input.today, input.dueDate);
    if (days < 0) {
      score += 3;
      reasons.push(`En retard de ${-days} jour${days < -1 ? "s" : ""} (+3)`);
    } else if (days <= 2) {
      score += 2;
      reasons.push(
        days === 0 ? "Échéance aujourd'hui (+2)" : `Échéance dans ${days} jour${days > 1 ? "s" : ""} (+2)`,
      );
    } else if (days <= 7) {
      score += 1;
      reasons.push(`Échéance dans ${days} jours (+1)`);
    } else reasons.push(`Échéance dans ${days} jours (+0)`);
  } else reasons.push("Sans échéance (+0)");

  if (input.blockingCount >= 3) {
    score += 2;
    reasons.push(`Bloque ${input.blockingCount} tâches (+2)`);
  } else if (input.blockingCount > 0) {
    score += 1;
    reasons.push(`Bloque ${input.blockingCount} tâche${input.blockingCount > 1 ? "s" : ""} (+1)`);
  }

  const priority: PriorityLevel =
    score >= 6 ? "URGENTE" : score >= 4 ? "HAUTE" : score >= 2 ? "NORMALE" : "BASSE";
  return { priority, score, reasons };
}

export function comparePriority(a: PriorityLevel, b: PriorityLevel) {
  return LEVELS.indexOf(a) - LEVELS.indexOf(b);
}

/**
 * Niveau de retard d'une tâche non terminée (§13.3) :
 * 0 = à l'heure, 1 = en retard (notifier le responsable),
 * 2 = plus de 48 h de retard (notifier aussi le responsable global du projet).
 * Une tâche due le jour J est en retard à partir de J+1 00:00 ; 48 h plus tard = J+3.
 */
export function overdueLevel(dueDate: Date | null, today: Date): 0 | 1 | 2 {
  if (!dueDate) return 0;
  const late = daysBetween(dueDate, today);
  if (late >= 3) return 2;
  if (late >= 1) return 1;
  return 0;
}

/** Échéance proche : due aujourd'hui ou dans les 2 jours. */
export function isDueSoon(dueDate: Date | null, today: Date) {
  if (!dueDate) return false;
  const days = daysBetween(today, dueDate);
  return days >= 0 && days <= 2;
}

// ─── Cascade de dates (roadmap) ─────────────────────────────────────────────

export type PlanTask = {
  id: string;
  title: string;
  startDate: Date | null;
  dueDate: Date | null;
  done: boolean;
};
export type PlanEdge = { taskId: string; dependsOnId: string };
export type DateChange = { id: string; title: string; from: [Date | null, Date | null]; to: [Date, Date] };
export type PlanConflict = { id: string; title: string; message: string };

/**
 * Règle explicite (§7.6) : déplacer une tâche ne déplace jamais les autres d'office.
 * - `conflicts` liste les incohérences fin→début créées par le déplacement ;
 * - `cascade` propose le décalage MINIMAL des tâches suivantes (non terminées) pour
 *   qu'elles commencent au plus tôt le lendemain de la fin de leur prédécesseur,
 *   en conservant leur durée. Elle n'est appliquée qu'après confirmation.
 */
export function planMove(
  tasks: PlanTask[],
  edges: PlanEdge[],
  movedId: string,
  newStart: Date,
  newDue: Date,
): { conflicts: PlanConflict[]; cascade: DateChange[] } {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const moved = byId.get(movedId);
  if (!moved) return { conflicts: [], cascade: [] };
  const conflicts: PlanConflict[] = [];

  for (const e of edges.filter((e) => e.taskId === movedId)) {
    const pred = byId.get(e.dependsOnId);
    if (pred?.dueDate && !pred.done && newStart <= pred.dueDate)
      conflicts.push({
        id: pred.id,
        title: pred.title,
        message: `Commence avant la fin de « ${pred.title} ».`,
      });
  }

  const planned = new Map<string, [Date, Date]>([[movedId, [newStart, newDue]]]);
  const cascade: DateChange[] = [];
  const queue = [movedId];
  while (queue.length) {
    const current = queue.shift()!;
    const [, end] = planned.get(current)!;
    for (const e of edges.filter((e) => e.dependsOnId === current)) {
      const succ = byId.get(e.taskId);
      if (!succ || succ.done) continue;
      const [start, due] = planned.get(succ.id) ?? [succ.startDate, succ.dueDate];
      if (!start || !due) continue;
      if (start > end) continue;
      if (current === movedId)
        conflicts.push({
          id: succ.id,
          title: succ.title,
          message: `« ${succ.title} » commence avant la nouvelle fin.`,
        });
      const shift = daysBetween(start, end) + 1;
      const next: [Date, Date] = [addDays(start, shift), addDays(due, shift)];
      planned.set(succ.id, next);
      const existing = cascade.findIndex((c) => c.id === succ.id);
      const change = {
        id: succ.id,
        title: succ.title,
        from: [succ.startDate, succ.dueDate] as [Date | null, Date | null],
        to: next,
      };
      if (existing >= 0) cascade[existing] = change;
      else cascade.push(change);
      queue.push(succ.id);
    }
  }
  return { conflicts, cascade };
}

// ─── Durées ─────────────────────────────────────────────────────────────────

/** Accepte « 1h30 », « 1:30 », « 1,5 », « 90min », « 2 », « 45 ». Retourne des minutes. */
export function parseDuration(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!v) return null;
  let m = /^(\d{1,3})h(\d{1,2})?(min)?$/.exec(v);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d{1,3}):(\d{2})$/.exec(v);
  if (m && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,4})(min|m)$/.exec(v);
  if (m) return Number(m[1]);
  m = /^(\d{1,2})[.,](\d{1,2})h?$/.exec(v);
  if (m) return Math.round(Number(`${m[1]}.${m[2]}`) * 60);
  m = /^(\d{1,2})h$/.exec(v);
  if (m) return Number(m[1]) * 60;
  // Nombre seul : jusqu'à 12 = heures, au-delà = minutes (« 2 » = 2 h, « 45 » = 45 min).
  m = /^(\d{1,4})$/.exec(v);
  if (m) return Number(m[1]) <= 12 ? Number(m[1]) * 60 : Number(m[1]);
  return null;
}

export function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Minutes entières entre deux instants (indépendant des changements d'heure). */
export function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}
