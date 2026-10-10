# ADR-0001 — Dépôt privé séparé du site vitrine

- **Statut** : Acceptée — 10/10/2026
- **Décideurs** : associés EVERY1.ATE

## Contexte

Le dépôt `agbovijohan/Every1.ate` est public et héberge le site vitrine statique, déployé
par Netlify depuis sa branche par défaut. Every1.ate OS manipule des données internes
(finance, CRM, marges) et des règles métier confidentielles.

## Décision

Every1.ate OS vit dans un dépôt **privé** distinct (`every1ate-os`), déployé sur un **site
Netlify distinct**. Le site vitrine n'est pas modifié.

## Conséquences

- Aucun risque de casser le site vitrine par une fusion ou une configuration Netlify.
- Le code, le schéma de données et la CI restent confidentiels.
- Les assets de marque (logo) sont copiés, pas partagés : une mise à jour du logo se fait dans les deux dépôts.
