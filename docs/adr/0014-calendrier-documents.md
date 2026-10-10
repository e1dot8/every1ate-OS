# ADR-0014 — Calendrier, abonnement ICS et références Drive (lot 6)

## Calendrier interne (source de vérité)
- Every1.ate OS est la **source de vérité** des événements internes. Instants en UTC, saisie et
  affichage en Europe/Paris (heures inexistantes/ambiguës des changements d'heure gérées et testées).
- Visibilité par défaut « Occupé » : les associés non invités voient un créneau sans détail.
- Conflits d'agenda (chevauchement partageant une personne) : signalés, non bloquants.
- Modifications concurrentes : verrou optimiste (`version`) ; l'utilisateur choisit
  « Garder ma version » (écrasement journalisé) ou « Garder l'autre version ».

## Google Agenda / Apple Calendrier : V1 = abonnement ICS en lecture seule
- Le fournisseur le plus simple et compatible avec les deux : un flux ICS personnel
  (`/api/calendrier/<jeton>.ics`), jeton de 256 bits dont seule l'empreinte SHA-256 est stockée,
  renouvelable (l'ancien lien cesse immédiatement), dernière lecture visible.
- **Limites documentées dans l'interface** : lecture seule, rafraîchissement 8–24 h côté Google,
  pas de retour des modifications. Aucune synchronisation n'est simulée.
- Étape suivante (à valider) : API Google Calendar (OAuth, scope `calendar.events`), file de
  synchronisation, journal, reprise sur erreur, règles de doublons (UID iCal).

## Google Drive
- Références uniquement (titre, type, propriétaire, date, identifiant Drive extrait de l'URL) rattachées
  à un projet, lot, tâche ou client ; liens https uniquement ; doublons refusés par cible.
- Vérification « lien supprimé/expiré » à la demande, **limitée aux domaines Google** (pas de requête
  serveur vers un domaine arbitraire). L'accès réel reste contrôlé par Google à l'ouverture.
- OAuth Drive (scope minimal `drive.file`) et stockage objet des médias volumineux : à venir.

## E-mails transactionnels
Invitations, réinitialisation, escalade 48 h, blocage, demande de décision, invitation à un événement.
