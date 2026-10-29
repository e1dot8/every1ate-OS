# ADR-0020 — Panneaux de la maquette et style « photocopie » (lot G8)

- **Statut** : Acceptée — 28/10/2026
- **Complète** : ADR-0019 (G7)

## Contexte

Retour des associés sur G7 : le rendu ne ressemblait pas assez à la maquette « Bienvenue à la
maison » (panneaux blancs arrondis sur fond gris, rail en carte, étiquettes flottantes, colonne
brigade/objectifs/activités, pages d'espaces en onglets). Les associés ont fourni leur style
graphique : portraits « photocopie » noir et blanc très contrastés et une vidéo « WOK » à
utiliser en bannière. Consigne pour les images : variées, **aucun humain visible**, des
textures d'ambiance inspirées de la vidéo.

## Décisions

1. **Jetons** : fond gris chaud `#ecebe6`, panneaux blancs `rounded-2xl`, rayon de base 14 px,
   jaune pâle `--highlight-soft` pour la sélection du menu et les objectifs ; le jaune vif reste
   réservé aux actions prioritaires et aux réussites. Police manuscrite (Permanent Marker) pour
   les annotations éditoriales (« SAME RECIPE, BIGGER PLANS. », « CREATE PRODUCE SHARE… »).
   Cette décision remplace le point 2 de l'ADR-0019 (cartes à 8 px).
2. **Shell** : rail et contenu sont des panneaux. Le rail garde les trois niveaux ; courrier,
   recherche et réglages forment une rangée d'icônes en pied, au-dessus de la carte de profil
   (rang, niveau, XP du niveau). Compteur de tâches ouvertes à côté de « Mes tâches ». Barre du
   haut : la brigade (vers le bureau commun), la série si elle est lancée, recherche, Créer,
   courrier.
3. **Composants partagés** : `Panel`, `SpaceTitle`, `SpaceTabs` (onglets en pastilles, aussi
   utilisés par `Tabs`), `PanelTitle`, `BrigadeToday`, `WeekGoals`, `LatestActivity`. Les espaces
   (maison, appartement, bureau commun, carnet, CRM) se ressemblent parce qu'ils partagent ces
   briques.
4. **Images** : textures tirées de la vidéo « WOK » (recadrages, négatifs, contours), en niveaux
   de gris, sans personne visible, dans `public/maison/` (14 textures, ~800 Ko). Une recette reçoit
   une texture stable calculée depuis son identifiant (`textureIndex`) pour varier les cartes.
   Une image absente ne casse rien : la page garde sa version neutre.
5. **Bannière** : la vidéo « WOK » (MP4 recompressé, 1,8 Mo, muette, en boucle) en tête du
   cockpit ; image fixe si l'utilisateur réduit les animations.
6. **Portraits** : `public/brigade/<prénom>.png` remplace l'avatar dessiné partout (rail, barre,
   brigade, appartement) dès que le fichier existe ; l'atelier d'avatar garde le dessin.
   Correspondance par prénom (minuscules, sans accent), suffisante pour trois associés.
7. **Bâtiment** : choix d'un rendu réaliste. Le composant accepte une image (`public/maison/
batiment.*`, zones de pièces en pourcentage, surlignage jaune au survol) ; tant qu'elle n'est
   pas fournie, le dessin axonométrique reste affiché. Les zones seront ajustées sur l'image
   définitive.

8. **Nomenclature explicite** (demande des associés) : le nom fonctionnel d'abord, le nom
   d'univers en second (sous-titre, fil d'Ariane, petite ligne). Source unique :
   `src/lib/spaces.ts`.

   | Écran            | Nom affiché        | Nom d'univers            |
   | ---------------- | ------------------ | ------------------------ |
   | `/appartement`   | Mon profil         | Mon appartement          |
   | `/bureau`        | Équipe             | Le bureau commun         |
   | `/crm/salle`     | Clients à suivre   | La Salle                 |
   | `/cuisine`       | Production         | La Cuisine               |
   | `/recettes`      | Méthodes & modèles | Le carnet de recettes    |
   | `/service`       | Point hebdo        | Le service de la semaine |
   | `/mise-en-place` | Briefing du jour   | La mise en place         |
   | `/notifications` | Notifications      | Le courrier              |

   Le groupe « La maison » du rail devient « Espaces ». Cette règle prime sur le point 5 de
   l'ADR-0019 (noms d'univers en titre).

9. **Responsive** (passe mobile du 29/10/2026) : le rail latéral n'apparaît qu'à partir de
   1024 px (tablette paysage, ordinateur). En dessous (téléphone, tablette portrait), barre basse
   à cinq entrées, logo en tête et bouton « + » flottant : le rail laissait à peine 500 px au
   contenu sur une tablette en portrait.

## Conséquences

- Aucun changement de schéma ni de règle métier ; tests unitaires ajoutés pour `formatRelative`,
  `portraitSlug` et `textureIndex`.
- Le titre du profil devient « Mon profil » (h1), le nom de l'associé passe en h2.
