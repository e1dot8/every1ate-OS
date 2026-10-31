/** Chiffrage par l'historique (pur) : repères tirés des projets passés comparables. */
export type HistoryProject = {
  id: string;
  name: string;
  templateKey: string | null;
  clientId: string | null;
  revenue: number; // centimes (budget approuvé, sinon facturé)
  costs: number; // coûts engagés
  minutes: number; // temps passé
  durationDays: number | null;
  closed: boolean;
};

export type Stat = { count: number; min: number; median: number; max: number } | null;

export function stat(values: number[]): Stat {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  const median = v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
  return { count: v.length, min: v[0], median, max: v[v.length - 1] };
}

/**
 * Projets de même modèle avec des données (revenu ou coûts). Les projets clôturés sont
 * privilégiés ; à défaut, les projets en cours servent de repère (signalé).
 */
export function estimateFromHistory(
  history: HistoryProject[],
  templateKey: string | null,
  excludeId?: string,
) {
  const same = history.filter(
    (h) =>
      h.id !== excludeId && h.templateKey === templateKey && (h.revenue > 0 || h.costs > 0 || h.minutes > 0),
  );
  const closed = same.filter((h) => h.closed);
  const basis = closed.length >= 2 ? closed : same;
  const margins = basis
    .filter((h) => h.revenue > 0)
    .map((h) => Math.round(((h.revenue - h.costs) / h.revenue) * 1000) / 10);
  return {
    basis: closed.length >= 2 ? ("clotures" as const) : ("en-cours" as const),
    projects: basis.map((h) => ({ id: h.id, name: h.name })),
    revenue: stat(basis.filter((h) => h.revenue > 0).map((h) => h.revenue)),
    costs: stat(basis.filter((h) => h.costs > 0).map((h) => h.costs)),
    minutes: stat(basis.filter((h) => h.minutes > 0).map((h) => h.minutes)),
    durationDays: stat(basis.map((h) => h.durationDays ?? NaN)),
    marginRate: stat(margins),
  };
}

/** Rentabilité agrégée par clé (modèle, client) : revenu, coûts, temps, marge. */
export function profitabilityBy<K extends string>(
  rows: { key: K; label: string; revenue: number; costs: number; timeCost: number | null }[],
) {
  const map = new Map<
    K,
    {
      key: K;
      label: string;
      projects: number;
      revenue: number;
      costs: number;
      timeCost: number;
      timeKnown: boolean;
    }
  >();
  for (const r of rows) {
    const g = map.get(r.key) ?? {
      key: r.key,
      label: r.label,
      projects: 0,
      revenue: 0,
      costs: 0,
      timeCost: 0,
      timeKnown: true,
    };
    g.projects++;
    g.revenue += r.revenue;
    g.costs += r.costs;
    if (r.timeCost == null) g.timeKnown = false;
    else g.timeCost += r.timeCost;
    map.set(r.key, g);
  }
  return [...map.values()]
    .map((g) => {
      const margin = g.revenue - g.costs - (g.timeKnown ? g.timeCost : 0);
      return { ...g, margin, marginRate: g.revenue ? Math.round((margin / g.revenue) * 1000) / 10 : null };
    })
    .sort((a, b) => b.margin - a.margin);
}
