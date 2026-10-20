/**
 * Valorisation du temps (pure) : minutes × coût horaire interne de l'associé
 * (ou taux par défaut de l'agence). Sans taux, le temps reste « non valorisé ».
 */
export type RateOf = (userId: string | null) => number | null;

export function rateResolver(rates: Map<string, number | null>, defaultRate: number | null): RateOf {
  return (userId) => (userId ? (rates.get(userId) ?? defaultRate) : defaultRate);
}

export const minutesCost = (minutes: number, rateCents: number) => Math.round((minutes * rateCents) / 60);

/** Temps passé : coût total et minutes sans taux. */
export function loggedTimeCost(entries: { userId: string; minutes: number }[], rateOf: RateOf) {
  let cost = 0;
  let unvalued = 0;
  for (const e of entries) {
    const r = rateOf(e.userId);
    if (r == null) unvalued += e.minutes;
    else cost += minutesCost(e.minutes, r);
  }
  return { cost, unvaluedMinutes: unvalued };
}

/**
 * Temps prévu : pour chaque tâche non annulée, la plus grande valeur entre l'estimation
 * et le temps déjà passé, au taux du responsable (taux par défaut si non assignée).
 * Minutes des tâches dont le responsable n'a aucun taux (ni le sien, ni celui de l'agence) :
 * comptées à part, comme pour le temps passé.
 */
export function plannedTimeCost(
  tasks: {
    ownerId: string | null;
    estimatedMinutes: number | null;
    loggedMinutes: number;
    cancelled: boolean;
  }[],
  rateOf: RateOf,
) {
  let cost = 0;
  let unvalued = 0;
  for (const t of tasks) {
    if (t.cancelled) continue;
    const minutes = Math.max(t.estimatedMinutes ?? 0, t.loggedMinutes);
    const r = rateOf(t.ownerId);
    if (r == null) unvalued += minutes;
    else cost += minutesCost(minutes, r);
  }
  return { cost, unvaluedMinutes: unvalued };
}
