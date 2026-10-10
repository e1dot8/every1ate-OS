# Sauvegardes et restauration

Analogie : la base de données est le **coffre** ; la sauvegarde est une **photocopie scellée**
(chiffrée) rangée dans un autre bâtiment, et le test de restauration consiste à vérifier
régulièrement qu'on sait ouvrir l'enveloppe et que la copie est complète.

## Ce qui est en place

| Couche                    | Mécanisme                                                                               | Fréquence               | Rétention                        |
| ------------------------- | --------------------------------------------------------------------------------------- | ----------------------- | -------------------------------- |
| Base (Neon)               | Restauration à un instant (PITR) du fournisseur                                         | continue                | selon le plan Neon (à confirmer) |
| Base (copie indépendante) | `scripts/backup.sh` via GitHub Actions (`backup.yml`) : `pg_dump` + chiffrement AES-256 | quotidienne (03:17 UTC) | 30 jours (artefacts GitHub)      |
| Vérification              | même workflow : restauration dans une base PostgreSQL éphémère + comptages              | quotidienne             | —                                |
| Fichiers                  | Google Drive (versionnement natif) ; l'outil ne stocke que des références               | —                       | selon Drive                      |
| Code                      | GitHub                                                                                  | à chaque commit         | illimitée                        |

Alerte : un échec du workflow déclenche l'e-mail GitHub aux administrateurs du dépôt.

## Configuration (une fois)

Dans GitHub → Settings → Secrets and variables → Actions :

- `BACKUP_DATABASE_URL` : URL **directe** (sans pooler) de la base de production, idéalement un
  rôle en lecture seule ;
- `BACKUP_PASSPHRASE` : phrase secrète longue, conservée aussi hors de GitHub (gestionnaire de
  mots de passe des associés). **Sans elle, les sauvegardes sont illisibles.**

## Restaurer (procédure)

1. Télécharger l'artefact `sauvegarde-…` du jour voulu (GitHub → Actions → Sauvegarde quotidienne).
2. Créer une base **vide** (branche Neon dédiée recommandée).
3. `RESTORE_DATABASE_URL=… BACKUP_PASSPHRASE=… scripts/restore.sh every1ate-….dump.enc`
   - l'empreinte SHA-256 est vérifiée ;
   - une base non vide est refusée (aucun écrasement implicite).
4. Vérifier, puis basculer `DATABASE_URL` vers la base restaurée (ou utiliser la PITR Neon pour
   revenir à un instant précis sans manipuler de fichier).

Test complet en local : `BACKUP_DATABASE_URL=… BACKUP_PASSPHRASE=… RESTORE_ADMIN_URL=…/postgres scripts/restore-test.sh`
(dernier essai : 10/10/2026, 10 tables comparées, journal d'audit toujours protégé, OK).

## Cohérence base / fichiers

Les documents restent dans Drive : la base ne contient que des liens. Après une restauration à
J‑n, des liens ajoutés depuis peuvent manquer, et un fichier supprimé de Drive peut être signalé
« lien supprimé » (bouton « Vérifier le lien »).

## À définir par les associés (§24)

- **RPO** (perte de données maximale acceptée) : proposition 24 h (copie quotidienne) / quelques
  minutes avec la PITR Neon.
- **RTO** (délai de remise en service) : proposition 4 h ouvrées.
- Durée de conservation des sauvegardes, du journal d'audit et des archives.
