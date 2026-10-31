/**
 * Progression de la maison (pure) : collective, séparée des niveaux individuels, nourrie par des
 * réussites réelles de l'agence. Paliers configurables ici.
 */
export const HOUSE_MILESTONES = [1, 5, 10, 25, 50, 100];

export type HouseProgress = { points: number; reached: number; next: number | null; percent: number };

/** Points de la maison = projets livrés + objectifs hebdomadaires atteints. */
export function houseProgress(delivered: number, goalsReached: number): HouseProgress {
  const points = delivered + goalsReached;
  const reached = HOUSE_MILESTONES.filter((m) => points >= m).length;
  const next = HOUSE_MILESTONES.find((m) => points < m) ?? null;
  const prev = reached ? HOUSE_MILESTONES[reached - 1] : 0;
  return {
    points,
    reached,
    next,
    percent: next ? Math.round(((points - prev) / (next - prev)) * 100) : 100,
  };
}
