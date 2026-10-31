# ADR-0016 — V1.1 : pilotage gratuit et sans IA

## Contexte

Les associés veulent un outil qui sert au quotidien (pas seulement à suivre des projets), en
restant **sur des offres gratuites** et **sans dépendre d'un copilote IA**. Un copilote pourra
s'ajouter plus tard comme une couche optionnelle : aucune fonctionnalité ne l'attend.

## Décisions

- **Règles explicites plutôt qu'IA.** Comptes rendus → tâches par une syntaxe lisible (`[ ]`,
  `@Prénom`, dates en français, mots entiers seulement) ; opportunités détectées par trois règles
  (préavis de contrat ≤ 60 jours, suite d'un projet réussi clôturé ≤ 120 jours, client sans
  activité ≥ 180 jours) ; chiffrage par médianes des projets passés du même modèle (projets
  terminés puis archivés compris). Rien n'est créé ni coché sans confirmation humaine.
- **Coût du temps.** Coût horaire interne par associé (à défaut, celui de l'agence). Le temps
  saisi sans aucun taux n'est jamais compté à 0 € : il est signalé « non valorisé » et les marges
  après temps ne sont pas affichées tant qu'il en reste.
- **Trésorerie 13 semaines** à partir d'un solde bancaire saisi à la main (aucune connexion
  bancaire). Le solde est arrêté en fin de journée : les mouvements datés après lui (échéances,
  encaissements reçus, coûts payés, contrats, charges fixes) s'y ajoutent. Projets archivés compris.
- **Objectifs annuels** : CA facturé dans l'année, marge = ce CA moins les coûts engagés de
  l'année, projets démarrés ; jauge avec le rythme attendu à date.
- **Recherche** : `unaccent` + `LIKE` paramétré (requêtes typées, jokers échappés), 8 résultats
  par groupe ; les réunions privées des autres ne sont jamais renvoyées.
- **Récap e-mail** opt-in (désactivé par défaut), envoyé par la passe planifiée existante entre
  7 h et 11 h (Paris) ; jamais de message vide ; un échec d'envoi libère le jour pour réessayer.
- **Tâches récurrentes** hebdomadaires ou mensuelles : l'occurrence suivante est créée à la
  clôture, une seule fois (contrainte d'unicité) ; terminée en retard, elle saute les périodes
  manquées.
- **Clôture semi-automatique** : les points vérifiables sont recontrôlés côté serveur au moment
  de cocher.

## Contraintes des offres gratuites (à connaître)

- Netlify Free : 300 crédits/mois. **Crédits épuisés = tous les sites de l'équipe en pause.**
  Déploiement de production ≈ 15 crédits ; la passe horaire ≈ 10 crédits/mois. Déployer rarement
  (commit contenant `[deploy]`).
- Neon Free : restauration à un instant limitée à 6 h → la copie quotidienne chiffrée (GitHub
  Actions) est indispensable.
- Resend Free : 100 e-mails/jour, **domaine vérifié (DKIM/SPF) obligatoire** pour écrire à de
  vrais destinataires.
- GitHub Free (dépôt privé) : 2 000 minutes d'Actions/mois ; la CI ne tourne que sur `main`.
- Google : la lecture Gmail est un périmètre « restreint » (audit payant hors Workspace interne) :
  le rattachement automatique des e-mails est reporté.

## Limites connues

- Récurrence mensuelle : après un mois court, l'échéance suit le jour de la dernière occurrence
  (31 janv. → 28 févr. → 28 mars). Corriger demande un champ « jour d'ancrage » (migration).
- Création de tâches depuis un compte rendu : quelques requêtes par action (sans impact à 3
  utilisateurs).
