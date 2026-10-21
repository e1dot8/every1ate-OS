# ADR-0017 — Cockpit, progression et vie de brigade (lots G1 à G5)

- **Statut** : Acceptée — 21/10/2026

## Contexte

Le brief « Every1.ate OS » du 21/10/2026 demande un outil de travail qui donne envie de revenir :
cockpit minimaliste, suivi du temps non punitif, briefings, CRM orienté action, et une progression
inspirée de Duolingo et des MMORPG, dans l'univers « creative & strategic kitchen » du site.

## Décisions

1. **Ce brief remplace deux décisions du dépôt `Every1ate-world`** (maquette du QG) : la métaphore
   de cuisine revient comme langage (rangs, « La Cuisine » pour le CRM, « mise en place »,
   « menu de la semaine ») et les badges peuvent être personnels. L'interdiction de tout classement
   entre associés est maintenue.
2. **Maquettes (exception à l'ADR-0009)** : pour les lots G1 à G5, validés par les associés le
   21/10/2026, les écrans sont développés directement ; les captures mobile + ordinateur du rendu
   réel tiennent lieu de maquette et sont validées après coup. Le portail client (G6) revient à la
   règle de l'ADR-0009.
3. **Registre d'XP** (`xp_transaction`) : chaque gain est une ligne, jamais un compteur sur le
   profil. Clé d'idempotence unique : une tâche ne rapporte qu'une fois (`task.done:<id>`), même
   rouverte puis refermée ou envoyée deux fois. Une erreur se corrige par une ligne inverse
   (`reverse:<id>`), journalisée dans l'audit avec sa raison ; seul le bénéficiaire corrige ses XP.
4. **Barème central** : `src/features/progression/config.ts` est le seul endroit où vivent les XP,
   le plafond quotidien, les paliers de niveau et les rangs. Valeurs initiales : tâche simple 10,
   intermédiaire 25, complexe 50 ; plafond de 150 XP de tâches par jour (au-delà, la clôture est
   inscrite à 0 XP avec la raison) ; niveau 2 à 100 XP, chaque palier coûte 50 XP de plus.
5. **Complexité** choisie (ou confirmée) dans le formulaire de tâche ; jamais déduite du temps
   passé. Aucune XP pour les clics, la présence, la vitesse ou l'ouverture d'un écran.
6. **Rangs** (Apprenti, Commis, Chef de partie, Sous-chef, Chef exécutif) : titres de parcours,
   sans aucune permission dans l'application ni lien avec la rémunération.
7. **Priorités du jour** (`daily_priority`) : trois au plus par associé et par jour. Sans choix,
   le cockpit propose une suggestion transparente (priorité, puis échéance) à confirmer en un clic.

## Conséquences

- Les seuils sont des hypothèses : on les recalibre après quelques semaines d'usage, dans
  `config.ts` uniquement.
- Les XP déjà acquis ne sont pas recalculés quand le barème change (le registre garde l'histoire).
