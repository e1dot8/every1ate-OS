/**
 * Libellés du journal pour les actions du QG (V1.2). À fusionner dans
 * `src/features/projects/journal-labels.ts` (hors périmètre du module QG).
 */
const LABELS: Record<string, string> = {
  "task.assigned": "a changé le responsable",
  "task.wip_override": "a dépassé la limite de tâches en cours (motif)",
  "handoff.proposed": "a proposé une passation",
  "handoff.accepted": "a accepté une passation",
  "handoff.refused": "a refusé une passation",
  "handoff.cancelled": "a annulé une passation",
  "opportunity.owner_changed": "a changé le responsable commercial",
};

export function qgJournalLabel(action: string): string | undefined {
  return LABELS[action];
}
