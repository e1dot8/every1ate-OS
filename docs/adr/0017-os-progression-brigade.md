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

## Lot G2 — Temps et estimation

8. **Pause** : elle clôt le segment de chronomètre (le temps de pause n'est jamais compté) et le
   marque « reprenable » ; « Reprendre » ouvre un nouveau segment sur la même tâche. Démarrer un
   autre chronomètre ou terminer la session efface la pause en attente.
9. **Catégories de tâche** (client, développement agence, gestion, personal branding,
   apprentissage, entraide, rituel) : seule « client » compte comme temps client.
10. **Tâches sans client** : rangées dans un projet interne unique, « La maison Every1.ate »
    (`project.internal`, index unique partiel), créé au premier besoin. Il est exclu de la liste
    des projets, de la finance, des analyses et des signaux commerciaux ; la liste des projets
    garde un lien vers lui.
11. **Estimation** : durées rapides, puis la médiane observée des tâches terminées de même
    catégorie et complexité dès 3 exemples (taille de l'échantillon affichée) ; sinon une plage
    indicative selon la complexité. Toujours une suggestion modifiable.
12. **Temps restant** saisi par le responsable ; à défaut, estimation − temps suivi.
13. **Mini-bilan** proposé une seule fois, tâche terminée, si le réel dépasse l'estimation de
    plus de 25 % et d'au moins 30 minutes ; facultatif (« Passer »), réservé au responsable.
14. **Rapport** : « Moi » ou « La brigade » en totaux agrégés, jamais de détail par personne.

## Lot G3 — Briefings

15. **La mise en place** (`daily_briefing`, un par associé et par jour) : l'OS pré-remplit les
    priorités et la charge prévue (temps restant des priorités face à la capacité hebdomadaire ÷ 5,
    hypothèse affichée) ; l'associé ajoute s'il le souhaite son état du jour (privé sauf partage
    explicite), un blocage, une demande d'aide (prévient la brigade une fois par jour) et un
    objectif personnel. Valider confirme les priorités suggérées. Aucune XP, aucune heure imposée,
    aucune pénalité en cas d'absence.
16. **Le menu de la semaine** (`weekly_briefing`, unique par lundi, et `weekly_item`) : l'OS
    prépare le bilan des 7 jours précédents, les échéances à deux semaines, retards, blocages,
    décisions en attente et la charge par associé ; la brigade note au plus 3 objectifs
    collectifs et 3 blocages, ainsi que décisions et actions (responsable, échéance). Les
    objectifs de la semaine précédente sont repris dans le bilan pour comparer le prévu au réel.
    La page reste modifiable après validation ; toutes les modifications sont journalisées.
17. **Objectifs collectifs vs personnels** : les objectifs de la semaine sont collectifs ;
    l'objectif personnel vit dans la mise en place.

## Lot G4 — Le courrier et La Cuisine

18. **Le courrier** : chaque type de notification appartient à un niveau (`tiers.ts`) —
    _Prioritaire_ (assignation, mention, blocage, retard, escalade, demande d'aide, décision,
    menu), _À suivre_ (commentaire, échéance, planning, relance, import), _Information_ (badge,
    félicitations). Le compteur ne compte que les deux premiers. Une notification se classe
    (`archivedAt`) et reste consultable dans « Archivé ».
19. **Mentions** : « @Prénom » dans un commentaire prévient l'associé (niveau prioritaire). Un
    prénom porté par plusieurs associés est ambigu : la mention est ignorée plutôt que mal
    adressée.
20. **La Cuisine** : quatre vues calculées à partir des données existantes (opportunités,
    échéancier de facturation, encaissements, satisfaction, signaux commerciaux), jamais des
    étiquettes manuelles. Chaque entrée donne la règle déclenchée, la raison, le responsable
    (« À attribuer » s'il n'y en a pas), la prochaine action, l'échéance et une priorité. Un
    même client peut apparaître dans plusieurs vues. Les seuils (silence, délai de paiement,
    horizon de facturation, satisfaction basse) sont réglables dans Réglages CRM et journalisés ;
    les règles sont décrites sur la page.
