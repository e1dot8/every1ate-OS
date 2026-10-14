-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('AUCUN', 'QUOTIDIEN', 'HEBDOMADAIRE');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('AUCUNE', 'HEBDOMADAIRE', 'MENSUELLE');

-- CreateEnum
CREATE TYPE "ChargeFrequency" AS ENUM ('MENSUELLE', 'TRIMESTRIELLE', 'ANNUELLE');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "clientSatisfaction" INTEGER,
ADD COLUMN     "satisfactionNote" TEXT;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "nextOccurrenceId" TEXT,
ADD COLUMN     "recurrence" "Recurrence" NOT NULL DEFAULT 'AUCUNE',
ADD COLUMN     "recurrenceUntil" DATE;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "digestFrequency" "DigestFrequency" NOT NULL DEFAULT 'AUCUN',
ADD COLUMN     "hourlyCostCents" INTEGER,
ADD COLUMN     "weeklyCapacityHours" INTEGER;

-- CreateTable
CREATE TABLE "agency_setting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "defaultHourlyCostCents" INTEGER,
    "defaultWeeklyHours" INTEGER NOT NULL DEFAULT 35,
    "cashBalance" DECIMAL(12,2),
    "cashBalanceDate" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_charge" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" "ChargeFrequency" NOT NULL DEFAULT 'MENSUELLE',
    "nextDate" DATE NOT NULL,
    "endDate" DATE,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_objective" (
    "year" INTEGER NOT NULL,
    "revenue" DECIMAL(12,2),
    "margin" DECIMAL(12,2),
    "projectCount" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annual_objective_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "meeting_note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "occurredAt" DATE NOT NULL,
    "authorId" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "opportunityId" TEXT,
    "eventId" TEXT,
    "createdTasks" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_note_projectId_idx" ON "meeting_note"("projectId");

-- CreateIndex
CREATE INDEX "meeting_note_clientId_idx" ON "meeting_note"("clientId");

-- CreateIndex
CREATE INDEX "meeting_note_opportunityId_idx" ON "meeting_note"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "task_nextOccurrenceId_key" ON "task"("nextOccurrenceId");

-- AddForeignKey
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Recherche globale insensible aux accents (extension « de confiance », disponible sur Neon).
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Bornes de cohérence.
ALTER TABLE "project" ADD CONSTRAINT "project_satisfaction_range" CHECK ("clientSatisfaction" IS NULL OR "clientSatisfaction" BETWEEN 1 AND 5);
ALTER TABLE "user" ADD CONSTRAINT "user_hourly_cost_positive" CHECK ("hourlyCostCents" IS NULL OR "hourlyCostCents" >= 0);
ALTER TABLE "user" ADD CONSTRAINT "user_weekly_hours_range" CHECK ("weeklyCapacityHours" IS NULL OR "weeklyCapacityHours" BETWEEN 1 AND 80);
ALTER TABLE "recurring_charge" ADD CONSTRAINT "recurring_charge_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "agency_setting" ADD CONSTRAINT "agency_setting_single_row" CHECK ("id" = 'default');
ALTER TABLE "agency_setting" ADD CONSTRAINT "agency_setting_weekly_hours_range" CHECK ("defaultWeeklyHours" BETWEEN 1 AND 80);
INSERT INTO "agency_setting" ("id", "defaultWeeklyHours", "updatedAt") VALUES ('default', 35, now()) ON CONFLICT DO NOTHING;
