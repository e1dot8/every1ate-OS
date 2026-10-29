# ADR-0021 — Quêtes de la semaine (lot G9)

- **Statut** : Acceptée — 29/10/2026
- **Complète** : ADR-0017 (progression), ADR-0018 (quêtes exclues du MVP, « lot ultérieur »)

## Contexte

La gamification devait être « discrète mais profonde » : la tâche terminée donne des XP, le
badge se célèbre, et la quête donne un but à la semaine. Les associés ont choisi ce lot le
29/10/2026, en attendant les portraits et le rendu du bâtiment.

## Décisions

1. **Catalogue en code** (`src/features/quests/catalog.ts`), comme le barème d'XP : 7 quêtes
   hebdomadaires, chacune liée à une donnée réelle (tâches terminées, échanges clients notés,
   méthodes écrites, jours de briefing, temps suivi, coups de main réglés, félicitations).
   Les objectifs et les XP sont des hypothèses de départ, à calibrer.
2. **Rien ne se coche à la main** : la progression n'est jamais stockée, elle se calcule à la
   lecture sur la semaine en cours (lundi → lundi). Les changements d'étape du CRM, automatiques,
   ne comptent pas comme des échanges.
3. **Trois quêtes au plus par semaine**, validées comprises (une quête validée ne libère pas sa
   place). Abandonner une quête non validée libère la place.
4. **Validation explicite** (« Valider la quête ») : la progression est recalculée côté serveur,
   la quête est marquée sous condition (`completedAt` nul) puis les XP sont inscrits au registre
   avec la clé `quest:<clé>:<semaine>:<associé>` : un double envoi ne rapporte rien de plus.
   Célébration brève (message qui s'efface), plus visible qu'une tâche, moins qu'un badge.
5. **Avancée discrète** : après une tâche terminée, si une quête acceptée mesure les tâches, la
   notification d'XP ajoute « Quête « … » : 3 / 5 » ou « prête à valider ».
6. **Pas de classement** : une quête ne concerne que son associé ; rien n'est comparé.
7. **Données** : table `quest_enrollment` (migration versionnée `quetes_hebdomadaires`), unique
   par associé, quête et semaine. Aucune donnée sensible.

## Conséquences

- Nouvelles entrées : menu « Quêtes » (Mon travail), page `/quetes`, carte « Mes quêtes » au cockpit.
- Tests : règles pures (`tests/unit/quests.test.ts`) et parcours complet (`tests/e2e/quetes.spec.ts`).
