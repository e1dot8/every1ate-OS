/**
 * Livrables (V1.2) : règles pures, sans base ni horloge implicite.
 * Étapes, formats, progression, retards, passage automatique d'étape, libellés d'activité.
 */
import type { DeliverableFormat, DeliverableStage } from "@/generated/prisma/enums";
import { addDays, formatDay, startOfWeek } from "@/lib/dates";

// ─── Étapes ─────────────────────────────────────────────────────────────────

export const STAGES = ["PREPARATION", "CREATION", "PRODUCTION", "MONTAGE", "LIVRAISON", "LIVRE"] as const;

/** Étapes de travail (avec une checklist). « Livré » est l'état final. */
export const WORK_STAGES = ["PREPARATION", "CREATION", "PRODUCTION", "MONTAGE", "LIVRAISON"] as const;
export type WorkStage = (typeof WORK_STAGES)[number];

export const stageLabels: Record<DeliverableStage, string> = {
  PREPARATION: "Préparation",
  CREATION: "Création",
  PRODUCTION: "Production",
  MONTAGE: "Montage",
  LIVRAISON: "Livraison",
  LIVRE: "Livré",
};

export const isStage = (value: unknown): value is DeliverableStage =>
  typeof value === "string" && (STAGES as readonly string[]).includes(value);

export const isWorkStage = (value: unknown): value is WorkStage =>
  typeof value === "string" && (WORK_STAGES as readonly string[]).includes(value);

export const stageIndex = (stage: DeliverableStage) => STAGES.indexOf(stage);

export function nextStage(stage: DeliverableStage): DeliverableStage | null {
  return STAGES[stageIndex(stage) + 1] ?? null;
}

export function previousStage(stage: DeliverableStage): DeliverableStage | null {
  const i = stageIndex(stage);
  return i > 0 ? STAGES[i - 1] : null;
}

// ─── Formats ────────────────────────────────────────────────────────────────

export const FORMATS = [
  "VIDEO",
  "REEL",
  "PHOTO",
  "POST",
  "CAROUSEL",
  "STORY",
  "VISUEL",
  "ARTICLE",
  "PRINT",
  "AUTRE",
] as const;

export const formatLabels: Record<DeliverableFormat, string> = {
  VIDEO: "Vidéo",
  REEL: "Reel",
  PHOTO: "Photo",
  POST: "Post",
  CAROUSEL: "Carrousel",
  STORY: "Story",
  VISUEL: "Visuel",
  ARTICLE: "Article",
  PRINT: "Print",
  AUTRE: "Autre",
};

export const formatEmojis: Record<DeliverableFormat, string> = {
  VIDEO: "🎬",
  REEL: "🎞️",
  PHOTO: "📸",
  POST: "🖼️",
  CAROUSEL: "🎠",
  STORY: "📲",
  VISUEL: "🎨",
  ARTICLE: "📰",
  PRINT: "🖨️",
  AUTRE: "📦",
};

export const isFormat = (value: unknown): value is DeliverableFormat =>
  typeof value === "string" && (FORMATS as readonly string[]).includes(value);

/** Suggestions du champ « Canal » (texte libre). */
export const CHANNEL_SUGGESTIONS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "Site", "Print"] as const;

// ─── Progression ────────────────────────────────────────────────────────────

export type CheckLike = { stage: DeliverableStage; doneAt: Date | null };

/** Points cochés / total d'une étape. */
export function stageProgress(items: CheckLike[], stage: DeliverableStage) {
  const inStage = items.filter((i) => i.stage === stage);
  return { done: inStage.filter((i) => i.doneAt).length, total: inStage.length };
}

/**
 * Avancement global : part des points cochés (toutes étapes) ; 100 % une fois livré ;
 * sans checklist, la position dans les étapes.
 */
export function globalProgress(items: CheckLike[], stage: DeliverableStage) {
  const total = items.length;
  const done = items.filter((i) => i.doneAt).length;
  if (stage === "LIVRE") return { done, total, percent: 100 };
  if (!total) return { done, total, percent: Math.round((stageIndex(stage) / WORK_STAGES.length) * 100) };
  return { done, total, percent: Math.round((done / total) * 100) };
}

// ─── Retards et échéances ───────────────────────────────────────────────────

/** En retard : échéance passée (avant aujourd'hui) et pas encore livré. */
export function isLate(d: { dueDate: Date | null; stage: DeliverableStage }, today: Date): boolean {
  return !!d.dueDate && d.dueDate.getTime() < today.getTime() && d.stage !== "LIVRE";
}

/** Échéance entre aujourd'hui et dans `days` jours (inclus). */
export function isDueWithin(date: Date | null, today: Date, days: number): boolean {
  if (!date) return false;
  return date.getTime() >= today.getTime() && date.getTime() <= addDays(today, days).getTime();
}

/** Dimanche de la semaine en cours (fin de « cette semaine »). */
export const endOfWeek = (today: Date) => addDays(startOfWeek(today), 6);

/** 1er du mois d'une date calendrier. */
export const startOfMonth = (day: Date) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));

// ─── Passage automatique d'étape ────────────────────────────────────────────

/** Tous les points de l'étape (au moins un) sont cochés : l'étape est terminée. */
export function shouldAutoAdvance(items: CheckLike[], stage: DeliverableStage): boolean {
  if (stage === "LIVRE") return false;
  const { done, total } = stageProgress(items, stage);
  return total > 0 && done === total;
}

/**
 * Étape atteinte en enchaînant les étapes déjà complètes (une étape sans point s'arrête :
 * passer une étape vide reste une décision humaine). null si rien ne bouge.
 */
export function autoAdvanceTarget(items: CheckLike[], stage: DeliverableStage): DeliverableStage | null {
  let current = stage;
  for (let guard = 0; guard < STAGES.length && shouldAutoAdvance(items, current); guard++) {
    current = nextStage(current)!;
  }
  return current === stage ? null : current;
}

/**
 * Après avoir coché ou décoché un point : passage automatique seulement si le point coché
 * appartient à l'étape courante (cocher en avance ne fait jamais sauter une étape revue à la main).
 */
export function advanceOnCheck(input: {
  items: CheckLike[];
  stage: DeliverableStage;
  itemStage: DeliverableStage;
  done: boolean;
}): DeliverableStage | null {
  if (!input.done || input.itemStage !== input.stage) return null;
  return autoAdvanceTarget(input.items, input.stage);
}

// ─── Validation ─────────────────────────────────────────────────────────────

export const BLOCK_REASON_MIN = 3;

export function blockReasonIssue(reason: string | null | undefined): string | null {
  const r = (reason ?? "").trim();
  if (r.length < BLOCK_REASON_MIN) return "Indiquez le motif du blocage (3 caractères minimum).";
  if (r.length > 500) return "Motif trop long (500 caractères maximum).";
  return null;
}

/** Lien vers les fichiers : https uniquement. */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname;
  } catch {
    return false;
  }
}

// ─── Calendrier ─────────────────────────────────────────────────────────────

/** Les `count` semaines à venir (lundi → dimanche), à partir de la semaine en cours. */
export function upcomingWeeks(today: Date, count = 6): { start: Date; end: Date }[] {
  const monday = startOfWeek(today);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(monday, i * 7);
    return { start, end: addDays(start, 6) };
  });
}

export type CalendarEntry<T> = { date: Date; kind: "echeance" | "publication"; item: T };

/**
 * Vue calendrier : « En retard » (échéances passées non livrées), puis échéances et dates de
 * publication groupées par semaine. Un livrable livré n'a plus d'échéance, mais sa publication compte.
 */
export function calendarGroups<
  T extends { dueDate: Date | null; publishDate: Date | null; stage: DeliverableStage },
>(items: T[], today: Date, weeks = 6) {
  const late = items
    .filter((d) => isLate(d, today))
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  const entries: CalendarEntry<T>[] = [];
  for (const item of items) {
    if (item.dueDate && item.stage !== "LIVRE" && !isLate(item, today))
      entries.push({ date: item.dueDate, kind: "echeance", item });
    if (item.publishDate) entries.push({ date: item.publishDate, kind: "publication", item });
  }
  const groups = upcomingWeeks(today, weeks).map((w) => ({
    ...w,
    entries: entries
      .filter((e) => e.date.getTime() >= w.start.getTime() && e.date.getTime() <= w.end.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.kind.localeCompare(b.kind)),
  }));
  return { late, weeks: groups };
}

// ─── Activité (journal lisible) ─────────────────────────────────────────────

type Json = Record<string, unknown> | null | undefined;
const str = (v: unknown) => (typeof v === "string" ? v : null);
const quoted = (v: unknown) => `« ${str(v) ?? "—"} »`;
const stageName = (v: unknown) => (isStage(v) ? stageLabels[v] : "—");
const dayOf = (v: unknown) => {
  const s = str(v);
  return s ? formatDay(new Date(s)) : null;
};

/** Ce qu'a fait l'auteur, en français : « a coché « Script validé » ». */
export function activityText(action: string, before: unknown, after: unknown): string {
  const a = (after ?? {}) as NonNullable<Json>;
  const b = (before ?? {}) as NonNullable<Json>;
  switch (action) {
    case "deliverable.created":
      return "a créé le livrable";
    case "deliverable.updated":
      return "a modifié les propriétés";
    case "deliverable.notes_updated":
      return "a modifié les notes";
    case "deliverable.archived":
      return "a archivé le livrable";
    case "deliverable.restored":
      return "a restauré le livrable";
    case "deliverable.stage_changed":
      if (a.auto)
        return a.stage === "LIVRE"
          ? "a coché le dernier point : livrable livré automatiquement"
          : `a coché le dernier point : passage automatique en ${stageName(a.stage)}`;
      return a.stage === "LIVRE"
        ? "a marqué le livrable comme livré"
        : `a passé le livrable en ${stageName(a.stage)}`;
    case "deliverable.blocked":
      return str(a.blockedReason) ? `a bloqué le livrable : ${str(a.blockedReason)}` : "a bloqué le livrable";
    case "deliverable.unblocked":
      return "a débloqué le livrable";
    case "deliverable.item_checked":
      return `a coché ${quoted(a.label)}`;
    case "deliverable.item_unchecked":
      return `a décoché ${quoted(a.label)}`;
    case "deliverable.item_added":
      return `a ajouté ${quoted(a.label)} (${stageName(a.stage)})`;
    case "deliverable.item_renamed":
      return `a renommé ${quoted(b.label)} en ${quoted(a.label)}`;
    case "deliverable.item_deleted":
      return `a supprimé ${quoted(a.label ?? b.label)}`;
    case "deliverable.item_assigned": {
      const due = dayOf(a.dueDate);
      if (!str(a.assigneeName))
        return `a retiré l'assignation de ${quoted(a.label)}${due ? ` (pour le ${due})` : ""}`;
      return `a confié ${quoted(a.label)} à ${str(a.assigneeName)}${due ? ` pour le ${due}` : ""}`;
    }
    default:
      return "a modifié le livrable";
  }
}

/** Libellés courts des actions « deliverable.* » pour le journal du projet. */
export const deliverableJournalLabels: Record<string, string> = {
  "deliverable.created": "a créé un livrable",
  "deliverable.updated": "a modifié un livrable",
  "deliverable.notes_updated": "a modifié les notes d'un livrable",
  "deliverable.archived": "a archivé un livrable",
  "deliverable.restored": "a restauré un livrable",
  "deliverable.stage_changed": "a changé l'étape d'un livrable",
  "deliverable.blocked": "a bloqué un livrable",
  "deliverable.unblocked": "a débloqué un livrable",
  "deliverable.item_checked": "a coché un point de checklist",
  "deliverable.item_unchecked": "a décoché un point de checklist",
  "deliverable.item_added": "a ajouté un point de checklist",
  "deliverable.item_renamed": "a renommé un point de checklist",
  "deliverable.item_deleted": "a supprimé un point de checklist",
  "deliverable.item_assigned": "a assigné un point de checklist",
};
