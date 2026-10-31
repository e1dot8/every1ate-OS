/**
 * Clôture semi-automatique (pure) : pour chaque point vérifiable de la checklist, dit si les
 * données le confirment et pourquoi. La coche reste un geste humain.
 */
export type ClosureFacts = {
  openTasks: number;
  costsNotPaid: number; // coûts prévus/engagés/facturés non payés
  billingNotCollected: number; // échéances non annulées non entièrement encaissées
  hasReview: boolean;
  documents: number;
};

export type ClosureHint = { verifiable: boolean; ok: boolean; reason: string };

export function closureHints(f: ClosureFacts): Record<string, ClosureHint> {
  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? "s" : ""}`;
  return {
    taches: f.openTasks
      ? {
          verifiable: true,
          ok: false,
          reason: `${plural(f.openTasks, "tâche")} encore ouverte${f.openTasks > 1 ? "s" : ""}.`,
        }
      : { verifiable: true, ok: true, reason: "Toutes les tâches sont terminées ou annulées." },
    couts: f.costsNotPaid
      ? {
          verifiable: true,
          ok: false,
          reason: `${plural(f.costsNotPaid, "coût")} pas encore payé${f.costsNotPaid > 1 ? "s" : ""}.`,
        }
      : { verifiable: true, ok: true, reason: "Tous les coûts sont payés ou annulés." },
    facturation: f.billingNotCollected
      ? {
          verifiable: true,
          ok: false,
          reason: `${plural(f.billingNotCollected, "échéance")} pas entièrement encaissée${f.billingNotCollected > 1 ? "s" : ""}.`,
        }
      : { verifiable: true, ok: true, reason: "Toutes les échéances sont encaissées ou annulées." },
    bilan: f.hasReview
      ? { verifiable: true, ok: true, reason: "Bilan renseigné." }
      : { verifiable: true, ok: false, reason: "Bilan à rédiger (onglet Clôture)." },
    livrables: f.documents
      ? {
          verifiable: false,
          ok: true,
          reason: `${plural(f.documents, "document")} référencé${f.documents > 1 ? "s" : ""} : à confirmer.`,
        }
      : { verifiable: false, ok: false, reason: "Aucun document référencé dans le projet." },
    archives: { verifiable: false, ok: false, reason: "À confirmer manuellement." },
  };
}
