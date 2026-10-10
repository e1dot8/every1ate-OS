# ADR-0007 — Déploiement économe en crédits Netlify

- **Statut** : Acceptée — 10/10/2026

## Contexte

Netlify facture en crédits (grille vérifiée le 10/10/2026) :

| Action                                         | Coût              |
| ---------------------------------------------- | ----------------- |
| Déploiement de production réussi               | 15 crédits        |
| Deploy preview, branch deploy                  | 0 crédit          |
| Déploiement échoué ou ignoré                   | 0 crédit          |
| Calcul des fonctions, requêtes, bande passante | facturé à l'usage |

Il reste 75 crédits sur le compte, soit 5 mises en production au maximum.

## Décision

1. **Tout est développé et vérifié hors Netlify** : en local (PostgreSQL local) et dans la CI GitHub
   (base PostgreSQL jetable, tests unitaires et end-to-end sur le build de production).
2. **Garde-fou** (`scripts/netlify-ignore.sh`, déclaré dans `netlify.toml`) : un build de production
   n'est lancé que si le dernier commit contient `[deploy]`. Sinon, Netlify l'annule sans consommer de crédit.
3. **Tests en conditions réelles, si nécessaire** : utiliser un branch deploy ou une deploy preview (0 crédit).
4. **Une seule mise en production** à la fin de la V1, puis une par livraison majeure.

## Conséquences

- Un oubli de `[deploy]` ne publie rien : il suffit d'un nouveau commit marqué.
- Le site vitrine, s'il est sur le même compte Netlify, consomme le même stock de crédits.
- Avant la mise en production : vérifier le solde de crédits et le forfait.
