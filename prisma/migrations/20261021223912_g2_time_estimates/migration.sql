-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('CLIENT', 'AGENCE', 'GESTION', 'BRANDING', 'APPRENTISSAGE', 'ENTRAIDE', 'RITUEL');

-- CreateEnum
CREATE TYPE "OverrunReason" AS ENUM ('ESTIMATION_COURTE', 'BRIEF_INCOMPLET', 'RETOURS_SUPPLEMENTAIRES', 'BLOCAGE_EXTERNE', 'PERIMETRE_MODIFIE', 'QUALITE', 'AUTRE');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "internal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "category" "TaskCategory" NOT NULL DEFAULT 'CLIENT',
ADD COLUMN     "overrunNote" TEXT,
ADD COLUMN     "overrunReason" "OverrunReason",
ADD COLUMN     "overrunReviewedAt" TIMESTAMP(3),
ADD COLUMN     "remainingMinutes" INTEGER;

-- AlterTable
ALTER TABLE "time_entry" ADD COLUMN     "resumable" BOOLEAN NOT NULL DEFAULT false;

-- Un seul projet interne (« La maison ») : index unique partiel.
CREATE UNIQUE INDEX "project_single_internal" ON "project" ("internal") WHERE "internal";

-- Les tâches déjà rangées dans le projet interne ne sont pas des tâches client.
UPDATE "task" SET "category" = 'AGENCE' WHERE "projectId" IN (SELECT "id" FROM "project" WHERE "internal");
