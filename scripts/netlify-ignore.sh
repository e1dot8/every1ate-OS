#!/usr/bin/env bash
# Netlify : exit 0 = build ignoré (aucun crédit consommé), exit 1 = build lancé.
# Seule la production est filtrée ; voir docs/adr/0007-deploiement-econome.md.
if [ "${CONTEXT:-}" != "production" ]; then
  exit 1
fi
if git log -1 --pretty=%B | grep -qF "[deploy]"; then
  echo "Commit marqué [deploy] : déploiement de production autorisé."
  exit 1
fi
echo "Production ignorée : ajouter [deploy] au message du commit pour publier."
exit 0
