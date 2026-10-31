# Décisions d'architecture (ADR)

Une décision = un fichier. Statuts : **Acceptée**, **En attente**, **Remplacée par ADR-XXXX**.
Une décision n'est jamais réécrite : on en crée une nouvelle qui remplace l'ancienne.

| #                                               | Décision                                               | Statut          |
| ----------------------------------------------- | ------------------------------------------------------ | --------------- |
| [0001](0001-depot-prive-separe.md)              | Dépôt privé séparé du site vitrine                     | Acceptée        |
| [0002](0002-stack-et-versions.md)               | Stack et versions bloquées                             | Acceptée        |
| [0003](0003-base-de-donnees-neon.md)            | PostgreSQL hébergé sur Neon (UE)                       | Acceptée        |
| [0004](0004-authentification-better-auth.md)    | Authentification Better Auth (MFA : voir 0008)         | Acceptée        |
| [0005](0005-emails-resend.md)                   | E-mails transactionnels via Resend                     | Acceptée        |
| [0006](0006-stockage-objet.md)                  | Stockage objet des médias lourds                       | En attente (V2) |
| [0008](0008-mfa-retiree-v1.md)                  | Pas de MFA en V1                                       | Acceptée        |
| [0009](0009-maquette-figma-par-lot.md)          | Une maquette Figma pour chaque lot                     | Acceptée        |
| [0010](0010-securite-connexion.md)              | Détails de sécurité de la connexion                    | Acceptée        |
| [0016](0016-v1-1-pilotage-gratuit-sans-ia.md)   | V1.1 : pilotage gratuit et sans IA                     | Acceptée        |
| [0017](0017-os-progression-brigade.md)          | Cockpit, progression et vie de brigade (G1-G5)         | Acceptée        |
| [0018](0018-la-maison-univers.md)               | La maison : bâtiment, avatars, appartement (G6)        | Acceptée        |
| [0019](0019-direction-editoriale-et-niveaux.md) | Direction éditoriale, 3 niveaux, noms des espaces (G7) | Acceptée        |
| [0020](0020-panneaux-et-style-photocopie.md)    | Panneaux de la maquette, style photocopie (G8)         | Acceptée        |
| [0021](0021-quetes-hebdomadaires.md)            | Quêtes de la semaine (G9)                              | Acceptée        |
