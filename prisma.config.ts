import "dotenv/config";
import { defineConfig } from "prisma/config";

// Le CLI Prisma (migrations) utilise la connexion DIRECTE, sans pooler.
// L'application, elle, utilise DATABASE_URL (poolée) — voir src/lib/db/client.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  },
});
