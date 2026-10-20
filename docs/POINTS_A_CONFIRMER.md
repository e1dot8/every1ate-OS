# Points à confirmer avant production (§24)

| #   | Point                                                       | État dans l'application                                                                     | À décider par                   |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | Seuils de gouvernance (budget %, retard %/jours, périmètre) | Configurables, **vides par défaut** (aucun déclenchement)                                   | Associés                        |
| 2   | Règle de décision collective                                | N avis « pour » requis (2 par défaut), refus quand N devient inatteignable — **provisoire** | Associés / statuts              |
| 3   | PostgreSQL et restauration                                  | Neon (Francfort) + copie quotidienne chiffrée testée                                        | Associés (plan Neon, PITR)      |
| 4   | Authentification / MFA                                      | Better Auth, sans MFA (ADR-0008)                                                            | Fait                            |
| 5   | Stockage objet des médias                                   | Non activé (« bientôt disponible »)                                                         | Associés (coût, rétention)      |
| 6   | Google Drive / OAuth                                        | Références par lien, sans OAuth                                                             | Associés                        |
| 7   | Synchronisation Google/Apple Calendar                       | Abonnement ICS en lecture seule, limites affichées                                          | Validation technique API Google |
| 8   | Formats Pennylane / Qonto                                   | Correspondance de colonnes libre + détection ; à valider sur de vrais exports               | Associés + comptable            |
| 9   | Durées de conservation                                      | Sauvegardes 30 jours ; journal sans purge                                                   | Associés                        |
| 10  | RPO / RTO                                                   | Proposition : 24 h (copie) ou minutes (PITR) / 4 h                                          | Associés                        |
| 11  | Accès collaborateurs V2                                     | Hors V1 (lot 8)                                                                             | Associés                        |
| 12  | Seuils de marge et règles de calcul                         | Formules documentées (ADR-0013), à valider                                                  | Comptable                       |
| 13  | Coûts horaires internes et capacités                        | Saisis dans Plus › Réglages (vides = temps non valorisé) ; journalisés                      | Associés                        |
| 14  | Objectifs annuels (CA, marge, nombre de projets)            | Saisis dans Finance › Analyses ; définitions affichées sur la page (ADR-0016)               | Associés                        |
| 15  | Domaine d'envoi des e-mails (Resend)                        | Domaine de l'agence à vérifier (DKIM/SPF) avant tout envoi réel                             | Associés (accès DNS)            |
| 16  | Récap e-mail du matin                                       | Désactivé par défaut, activable par chaque associé                                          | Chaque associé                  |
