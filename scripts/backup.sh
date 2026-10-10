#!/usr/bin/env bash
# Sauvegarde logique chiffrée de la base Every1.ate OS.
#
#   BACKUP_DATABASE_URL=postgresql://…  BACKUP_PASSPHRASE=…  scripts/backup.sh [dossier]
#
# - pg_dump au format « custom » (restauration sélective possible, compression intégrée) ;
# - chiffrement AES-256 (openssl, PBKDF2) : la phrase secrète n'est jamais écrite sur disque ;
# - empreinte SHA-256 à côté du fichier pour vérifier l'intégrité avant restauration.
# Code de sortie non nul en cas d'échec : la tâche planifiée qui l'appelle doit alerter.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL manquante (URL directe, sans pooler)}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquante}"
out_dir="${1:-backups}"
mkdir -p "$out_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="$out_dir/every1ate-$stamp.dump.enc"

pg_dump --format=custom --no-owner --no-privileges --dbname="$BACKUP_DATABASE_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$file"

if [ ! -s "$file" ]; then
  echo "Sauvegarde vide : échec." >&2
  exit 1
fi
sha256sum "$file" | awk '{print $1}' > "$file.sha256"
echo "Sauvegarde : $file ($(du -h "$file" | cut -f1))"
