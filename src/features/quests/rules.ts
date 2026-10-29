import { MAX_ACTIVE_QUESTS } from "./catalog";

export type QuestProgress = { value: number; target: number; percent: number; reached: boolean };

/** Progression bornée : la barre ne dépasse jamais 100 %, la valeur réelle reste affichée. */
export function progressOf(value: number, target: number): QuestProgress {
  const v = Math.max(0, Math.floor(value));
  return { value: v, target, percent: Math.min(100, Math.round((v / target) * 100)), reached: v >= target };
}

/** Peut-on accepter cette quête cette semaine ? */
export function canAccept(
  key: string,
  enrolled: { questKey: string; completedAt: Date | null }[],
  max = MAX_ACTIVE_QUESTS,
): { ok: true } | { ok: false; error: string } {
  if (enrolled.some((e) => e.questKey === key))
    return { ok: false, error: "Quête déjà acceptée cette semaine." };
  if (enrolled.length >= max)
    return { ok: false, error: `${max} quêtes par semaine au plus : terminez ou abandonnez-en une.` };
  return { ok: true };
}

/** Clé d'idempotence des XP : une quête ne rapporte qu'une fois par associé et par semaine. */
export const questXpKey = (key: string, weekStart: Date, userId: string) =>
  `quest:${key}:${weekStart.toISOString().slice(0, 10)}:${userId}`;
