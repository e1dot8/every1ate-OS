-- AlterTable
ALTER TABLE "project" ADD COLUMN     "baselineEndDate" DATE;

-- Référence initiale : la fin prévue actuelle des projets existants.
UPDATE "project" SET "baselineEndDate" = "plannedEndDate" WHERE "baselineEndDate" IS NULL;
