@AGENTS.md

## Pour travailler à plusieurs

Lire [`CONTRIBUER.md`](CONTRIBUER.md) : une branche par fonctionnalité (`prenom/sujet`), pull request
relue par un autre associé, jamais de commit direct sur `main`, mise en production seulement par
un commit `[deploy]` décidé ensemble.

## Pièges connus de ce dépôt

- Next.js 16 avec Cache Components : toute lecture au moment de la requête (session, base,
  `searchParams`) se fait dans un composant enfant enveloppé de `<Suspense>`. Modèle :
  `src/app/(app)/plus/page.tsx`.
- Avant `tsc` : `pnpm exec prisma generate && pnpm exec next typegen` (ou `pnpm typecheck`).
- Base locale uniquement pour le développement et les données de démonstration (`pnpm demo:seed`
  refuse toute autre base). Migrations : `pnpm exec prisma migrate dev --name <nom>` en local,
  additives ; jamais `migrate reset` ni `db push` sur une base partagée.
- Jours stockés en `@db.Date` UTC ; « aujourd'hui » = `todayDate()` de `src/lib/dates.ts`
  (jour de Paris). Montants financiers en `Decimal(12,2)`, coûts horaires en centimes (`Int`).
- Tests e2e : `pnpm build` d'abord, puis `pnpm test:e2e` (projets mobile et ordinateur).
- Montrer l'écran (mobile + ordinateur) avant de coder une fonctionnalité visible, et attendre
  l'accord de l'associé qui l'a demandée.
