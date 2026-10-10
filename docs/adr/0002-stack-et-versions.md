# ADR-0002 — Stack et versions bloquées

- **Statut** : Acceptée — 10/10/2026

## Contexte

Le cahier des charges (§18.1) fixe Next.js, TypeScript, Tailwind CSS, shadcn/ui, Prisma,
PostgreSQL et Netlify. Vérification des versions npm au 10/10/2026 :

| Paquet                  | `latest` npm         | Retenu            | Raison                                                                                                                                                                                            |
| ----------------------- | -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| next                    | 16.4.0               | 16.4.0            | Stable. Cache Components activé (rendu partiel).                                                                                                                                                  |
| react / react-dom       | 19.3.0               | 19.3.0            | Requis par Next 16.                                                                                                                                                                               |
| typescript              | 7.0.2                | **6.0.3**         | TS 7 (compilateur natif) : compatibilité de l'API JS avec l'outillage Next non garantie. Montée en version dans un lot dédié. Build validé avec 6.0.3.                                            |
| tailwindcss             | 4.3.3                | 4.3.3             | Intégré via le loader Turbopack.                                                                                                                                                                  |
| prisma / @prisma/client | 8.0.0-rc.22 / 7.10.0 | **7.10.0**        | Le tag `latest` du CLI pointe sur une _release candidate_. Better Auth accepte Prisma ≤ 7.                                                                                                        |
| shadcn/ui               | CLI 4.21.4           | composants copiés | Composants au format shadcn (Radix + CVA). Le registre en ligne était inaccessible depuis l'environnement de développement initial ; la CLI reste utilisable ensuite (`components.json` présent). |
| Node.js                 | —                    | 22 LTS            | `.nvmrc`, `NODE_VERSION` Netlify.                                                                                                                                                                 |
| pnpm                    | —                    | 10.28.0           | Champ `packageManager`.                                                                                                                                                                           |

## Décision

Versions **exactes** (sans `^`) dans `package.json`, lockfile commité, installation
`--frozen-lockfile` en CI. Toute montée de version majeure passe par une ADR.

## Contraintes Netlify retenues

- Fonctions serveur à durée courte : traitements longs (imports) → Background Functions.
- Tâches récurrentes → Netlify Scheduled Functions (`netlify/functions/`), jamais déclenchées par une visite.
- Connexions base : pooler Neon + driver adapter `@prisma/adapter-pg`, client Prisma unique par processus.
- Gros fichiers : upload direct navigateur → stockage objet via URL signée (V2), jamais via une fonction.
