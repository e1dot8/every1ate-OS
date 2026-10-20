/** Libellés lisibles des actions du journal d'un projet. */
const LABELS: Record<string, string> = {
  "project.created": "a créé le projet",
  "project.updated": "a modifié le projet",
  "project.status_changed": "a changé le statut",
  "project.owner_changed": "a changé le responsable global",
  "project.closed": "a clôturé le projet",
  "project.archived": "a archivé le projet",
  "project.restored": "a restauré le projet",
  "project.closure_item": "a mis à jour la checklist de clôture",
  "project.review_saved": "a renseigné le bilan",
  "lot.created": "a créé un lot",
  "lot.updated": "a modifié un lot",
  "lot.archived": "a archivé un lot",
  "lot.restored": "a restauré un lot",
  "task.created": "a créé une tâche",
  "task.updated": "a modifié une tâche",
  "task.status_changed": "a changé le statut d'une tâche",
  "task.archived": "a archivé une tâche",
  "task.restored": "a restauré une tâche",
  "task.dependency_added": "a ajouté une dépendance",
  "task.dependency_removed": "a retiré une dépendance",
  "task.rescheduled": "a déplacé une tâche sur la roadmap",
  "task.priority_recalculated": "a recalculé la priorité",
  "task.commented": "a commenté une tâche",
  "task.comment_deleted": "a supprimé un commentaire",
  "project.milestone_created": "a ajouté un jalon",
  "project.milestone_updated": "a modifié un jalon",
  "project.milestone_moved": "a déplacé un jalon",
  "project.milestone_archived": "a retiré un jalon",
  "time.timer_started": "a démarré un chronomètre",
  "time.timer_stopped": "a arrêté un chronomètre",
  "time.entry_created": "a saisi du temps",
  "time.entry_corrected": "a corrigé une saisie de temps",
  "time.entry_deleted": "a supprimé une saisie de temps",
  "finance.budget_revised": "a révisé le budget",
  "finance.cost_saved": "a enregistré un coût",
  "finance.billing_saved": "a mis à jour l'échéancier",
  "finance.payment_recorded": "a enregistré un encaissement",
  "project.note_updated": "a modifié un compte rendu",
  "project.note_archived": "a archivé un compte rendu",
  "project.satisfaction": "a noté la satisfaction client",
};

export function journalLabel(action: string) {
  return LABELS[action] ?? action;
}

/** Résumé court des valeurs avant/après (dates, statuts…). */
export function journalDetail(before: unknown, after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const a = after as Record<string, unknown>;
  const b = (before ?? {}) as Record<string, unknown>;
  const parts = Object.keys(a)
    .slice(0, 4)
    .map((k) => {
      const fmt = (v: unknown) =>
        v === null || v === undefined
          ? "—"
          : typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)
            ? v.slice(0, 10)
            : String(v);
      return k in b ? `${k} : ${fmt(b[k])} → ${fmt(a[k])}` : `${k} : ${fmt(a[k])}`;
    });
  return parts.length ? parts.join(" · ") : null;
}
