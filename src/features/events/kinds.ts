/**
 * Événements du QG (V1.2) : ce qui peut déclencher une notification dans l'app, sur le téléphone
 * (push) ou sur WhatsApp. Module pur : partagé par le serveur, les réglages et les tests.
 */
export const EVENT_KINDS = [
  "livrable.coche",
  "livrable.assigne",
  "livrable.etape",
  "livrable.livre",
  "livrable.bloque",
  "tache.terminee",
  "passation.demandee",
  "passation.repondue",
  "mention",
  "message.direct",
  "standup.bloque",
  "rappel",
  "opportunite.gagnee",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export const eventLabels: Record<EventKind, string> = {
  "livrable.coche": "Un point de checklist d'un livrable est coché",
  "livrable.assigne": "On te confie un point de checklist",
  "livrable.etape": "Un livrable passe à l'étape suivante",
  "livrable.livre": "Un livrable est livré",
  "livrable.bloque": "Un livrable est bloqué",
  "tache.terminee": "Une tâche est terminée",
  "passation.demandee": "On te propose une tâche ou un client",
  "passation.repondue": "Réponse à ta proposition",
  mention: "On te mentionne dans une discussion",
  "message.direct": "Nouveau message direct",
  "standup.bloque": "Un associé est bloqué (stand-up)",
  rappel: "Tes rappels",
  "opportunite.gagnee": "Une opportunité est signée",
};
