export const costStatusLabels = {
  PREVU: "Prévu",
  ENGAGE: "Engagé",
  FACTURE: "Reçu / facturé",
  PAYE: "Payé",
  ANNULE: "Annulé",
} as const;

export const pricingLabels = {
  FORFAIT: "Forfait",
  TEMPS: "Temps / TJM",
  FRAIS: "Frais et production",
} as const;

export const billingKindLabels = {
  ACOMPTE: "Acompte",
  INTERMEDIAIRE: "Intermédiaire",
  SOLDE: "Solde",
  AUTRE: "Autre",
} as const;

export const contractStatusLabels = {
  BROUILLON: "Brouillon",
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  RESILIE: "Résilié",
  TERMINE: "Terminé",
} as const;

export const decisionStatusLabels = {
  OUVERTE: "En attente d'avis",
  APPROUVEE: "Approuvée",
  REFUSEE: "Refusée",
  ANNULEE: "Retirée",
} as const;
export const decisionKindLabels = { BUDGET: "Budget", PLANNING: "Planning", PERIMETRE: "Périmètre" } as const;
export const voteLabels = { POUR: "Pour", CONTRE: "Contre", ABSTENTION: "Abstention" } as const;
