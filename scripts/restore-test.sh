#!/usr/bin/env bash
# Test de restauration : sauvegarde → restauration dans une base temporaire → contrôles → suppression.
#
#   BACKUP_DATABASE_URL=…  BACKUP_PASSPHRASE=…  RESTORE_ADMIN_URL=postgresql://…/postgres  scripts/restore-test.sh
#
# Contrôles : mêmes nombres de lignes sur les tables métier, journal d'audit toujours protégé
# (les déclencheurs refusent la modification), dernière migration présente.
set -euo pipefail
: "${BACKUP_DATABASE_URL:?}"; : "${BACKUP_PASSPHRASE:?}"; : "${RESTORE_ADMIN_URL:?base administrateur pour créer la base temporaire}"

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
db="restore_test_$(date -u +%s)"

"$here/backup.sh" "$work" >/dev/null
file="$(ls "$work"/*.dump.enc)"
psql "$RESTORE_ADMIN_URL" -qc "create database $db"
target="$(echo "$RESTORE_ADMIN_URL" | sed -E "s#/[^/?]+(\?|$)#/$db\1#")"
cleanup() { psql "$RESTORE_ADMIN_URL" -qc "drop database if exists $db" >/dev/null; rm -rf "$work"; }
trap cleanup EXIT

RESTORE_DATABASE_URL="$target" "$here/restore.sh" "$file" >/dev/null

status=0
for t in "user" project task time_entry opportunity cost_item billing_milestone payment_record calendar_event audit_event; do
  a="$(psql "$BACKUP_DATABASE_URL" -Atc "select count(*) from \"$t\"")"
  b="$(psql "$target" -Atc "select count(*) from \"$t\"")"
  if [ "$a" = "$b" ]; then echo "OK   $t : $b lignes"; else echo "ÉCART $t : source $a / restauré $b"; status=1; fi
done
if psql "$target" -qc "update audit_event set action = action where false" >/dev/null 2>&1 && \
   ! psql "$target" -qc "delete from audit_event where id = (select id from audit_event limit 1)" >/dev/null 2>&1; then
  echo "OK   journal d'audit toujours protégé"
else
  echo "ÉCART journal d'audit : protection absente"; status=1
fi
last="$(psql "$target" -Atc "select migration_name from _prisma_migrations order by finished_at desc limit 1")"
echo "OK   dernière migration : $last"
[ "$status" = 0 ] && echo "Test de restauration réussi ($(du -h "$file" | cut -f1) chiffrés)." || echo "Test de restauration ÉCHOUÉ." >&2
exit "$status"
