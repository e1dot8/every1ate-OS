# ADR-0011 — Roadmap, suivi du temps et notifications (lot 3)

## Décisions

1. **Déplacement sur la roadmap** : déplacer une tâche ne déplace jamais les autres d'office.
   Le serveur calcule (`planMove`) les conflits fin→début et propose une **cascade minimale**
   (chaque tâche suivante non terminée commence le lendemain de la fin de son prédécesseur,
   durée conservée). L'utilisateur choisit « Déplacer et décaler » ou « Déplacer seulement
   cette tâche ». Chaque date modifiée est journalisée (`task.rescheduled`).
   Alternative accessible : flèches clavier sur la barre (Maj = durée) puis Entrée, et le
   formulaire « Modifier » de la tâche.
2. **Priorité** : « Automatique » = score transparent (impact, échéance, retard, tâches
   bloquées) recalculé chaque heure ; une valeur choisie est **verrouillée** et jamais modifiée.
3. **Temps** : un seul chronomètre actif par utilisateur, garanti par un index unique partiel
   en base ; démarrer ailleurs demande confirmation. Instants stockés en UTC, jour rattaché
   calculé en Europe/Paris ; durées en minutes réelles (changements d'heure corrects).
   Corrections limitées à ses propres saisies, historisées dans l'audit ; suppression logique.
4. **Notifications** : table `notification` avec clé de dédoublonnage unique par utilisateur
   (pas d'alerte répétée, historique conservé). Retard J+1 → responsable ; J+3 (48 h de
   retard) → responsable global, aussi par e-mail. Blocage → e-mail.
5. **Planification** : fonction Netlify `scheduled-scan` (horaire) qui appelle
   `POST /api/cron/scan` avec `Authorization: Bearer CRON_SECRET`. Sans secret, l'endpoint
   répond 503. Coût : une requête courte par heure.

## À configurer en production

- `CRON_SECRET` (32 caractères minimum) dans les variables Netlify.
