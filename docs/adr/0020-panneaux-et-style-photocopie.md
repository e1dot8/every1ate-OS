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

## Conséquences

- Aucun changement de schéma ni de règle métier ; tests unitaires ajoutés pour `formatRelative`,
  `portraitSlug` et `textureIndex`.
- Le titre de l'appartement devient « Mon appartement » (h1), le nom de l'associé passe en h2.
