#!/usr/bin/env bash
# Restauration d'une sauvegarde chiffrée DANS UNE BASE CIBLE EXPLICITE.
#
#   RESTORE_DATABASE_URL=postgresql://…/base_vide  BACKUP_PASSPHRASE=…  scripts/restore.sh fichier.dump.enc
#
# Garde-fous :
# - vérifie l'empreinte SHA-256 si le fichier .sha256 est présent ;
# - refuse une base cible qui contient déjà des tables, sauf RESTORE_ALLOW_NON_EMPTY=1
#   (jamais de --clean implicite : aucune donnée existante n'est écrasée par défaut).
set -euo pipefail

file="${1:?Usage : scripts/restore.sh fichier.dump.enc}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL manquante (base cible)}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE manquante}"

if [ -f "$file.sha256" ]; then
  expected="$(cat "$file.sha256")"
  actual="$(sha256sum "$file" | awk '{print $1}')"
  if [ "$expected" != "$actual" ]; then
    echo "Empreinte invalide : fichier corrompu ou modifié." >&2
    exit 1
  fi
fi

tables="$(psql "$RESTORE_DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema='public'")"
if [ "$tables" != "0" ] && [ "${RESTORE_ALLOW_NON_EMPTY:-0}" != "1" ]; then
  echo "La base cible contient déjà $tables table(s). Restaurez dans une base vide (ou RESTORE_ALLOW_NON_EMPTY=1 en connaissance de cause)." >&2
  exit 1
fi

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$file" \
  | pg_restore --no-owner --no-privileges --exit-on-error --dbname="$RESTORE_DATABASE_URL"
echo "Restauration terminée dans la base cible."
