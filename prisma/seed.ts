import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Seed idempotent : uniquement des données techniques, aucune donnée réelle.
const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL manquante pour le seed.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  await prisma.systemInfo.upsert({
    where: { key: "foundation_lot" },
    update: { value: "0" },
    create: { key: "foundation_lot", value: "0" },
  });
}

main()
  .then(() => console.log("Seed terminé."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
