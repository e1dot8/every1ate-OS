import type { XpAward } from "./service";

/** Message de célébration discret, affiché après l'action (jamais une fenêtre bloquante). */
export function xpMessage(xp: Pick<XpAward, "amount" | "levelUp">): string {
  if (xp.amount <= 0) return "Tâche inscrite à votre progression (plafond d'XP du jour atteint).";
  const gain = `+${xp.amount} XP.`;
  if (!xp.levelUp) return gain;
  const rank = xp.levelUp.rankTitle ? ` Nouveau rang : ${xp.levelUp.rankTitle} !` : "";
  return `${gain} Niveau ${xp.levelUp.level} atteint !${rank}`;
}
