# ADR-0009 — Une maquette Figma pour chaque lot

- **Statut** : Acceptée — 10/10/2026

## Décision

Chaque lot est accompagné de sa maquette dans le fichier Figma
**[Every1.ate OS — Maquettes](https://www.figma.com/design/bjxpFBYomtYT8yJOZKCV4X)** :

| Page Figma              | Contenu                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Fondations              | Variables (couleurs, rayons), styles de texte, icônes, composants (Bouton, Statut, Champ, Barre basse, Rail, Logo) |
| Lot N · … (livré)       | Rendu de ce qui est réellement livré                                                                               |
| Lot N · … (proposition) | Écrans proposés, présentés **avant** le développement                                                              |

Chaque écran existe en **mobile (390 px)** et **ordinateur (1440 px)**.

## Déroulé d'un lot

1. Maquette Figma « proposition » → validation des associés.
2. Développement → tests → CI.
3. La page passe en « livré » et reflète le rendu réel.

## Conséquences

- Les tokens du code (`src/app/globals.css`) et les variables Figma portent les mêmes valeurs ; un changement se fait des deux côtés.
