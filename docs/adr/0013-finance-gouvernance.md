# ADR-0013 — Finance, imports et gouvernance (lot 5)

## Principes
- Outil de **pilotage**, pas de comptabilité. Montants HT, TVA séparée si connue.
- `Decimal(12,2)` en base ; tous les calculs en **centimes entiers** (`src/features/finance/calc.ts`, testé).
- Statuts distincts : coût prévu → engagé → reçu/facturé → payé (ou annulé) ; échéance attendue →
  facturée → partiellement encaissée → encaissée (ces deux derniers et « en retard » sont **calculés**).

## Formules (affichées dans l'interface)
- Coûts prévisionnels = max(budget de coûts approuvé, lignes de coûts non annulées) : un coût
  **engagé** pèse sur la marge prévisionnelle sans attendre son paiement.
- Marge prévisionnelle = revenus prévus (budget, sinon échéancier) − coûts prévisionnels.
- Marge réelle = facturé − coûts reçus/facturés ou payés. Refacturable ≠ marge (affiché à part).
- MRR = somme mensuelle des contrats **actifs à la date du jour**.

## Budgets et gouvernance
- Le premier budget d'un périmètre (projet ou lot) est le budget initial de référence ; les
  révisions sont historisées avec motif.
- Seuils (dépassement %, retard % et/ou jours) : **non définis au départ**, configurables, journalisés.
- Seuil dépassé → `DecisionRequest`, notification in-app + e-mail des autres associés. Si la règle
  est bloquante, la révision (ou la nouvelle date de fin) n'est appliquée qu'après approbation.
- Dépouillement provisoire : approuvée à N avis « pour » (N configurable, 2 par défaut), refusée dès
  que N devient inatteignable. **Règle de majorité/quorum à confirmer par les associés.**

## Imports CSV/Excel
Parcours : fichier → type détecté → aperçu → correspondance des colonnes → validation (formats,
montants, dates, identifiants) → doublons (fichier et base, par identifiant externe ou empreinte
date+montant+tiers) → confirmation explicite → rapport → identifiant d'import conservé.
- Aucune donnée existante n'est modifiée ; confirmation idempotente (verrou sur le statut du lot).
- Encaissements rapprochés d'une échéance uniquement sur référence de facture identique.
- Annulation **logique** (archivage), refusée si une ligne importée a été modifiée depuis.
- Pas d'API Pennylane/Qonto en V1 (à étudier : accès, limites, coûts).
