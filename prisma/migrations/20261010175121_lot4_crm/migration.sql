-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('A_CONTACTER', 'PREMIER_ECHANGE', 'QUALIFICATION', 'PROPOSITION_ENVOYEE', 'NEGOCIATION', 'GAGNE', 'PERDU');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('OUTBOUND', 'INBOUND', 'RECOMMANDATION', 'RESEAU', 'PARTENAIRE');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('ECHANGE', 'REUNION', 'PROPOSITION', 'NOTE', 'RELANCE', 'ETAPE');

-- AlterTable
ALTER TABLE "client" ADD COLUMN     "address" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "client_contact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "ownerId" TEXT NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'A_CONTACTER',
    "source" "LeadSource",
    "amount" DECIMAL(12,2),
    "probability" INTEGER,
    "expectedCloseDate" DATE,
    "nextAction" TEXT,
    "nextActionDate" DATE,
    "lossReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "projectId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_activity" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "ActivityKind" NOT NULL,
    "body" TEXT,
    "fromStage" "OpportunityStage",
    "toStage" "OpportunityStage",
    "fileUrl" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_stage_setting" (
    "stage" "OpportunityStage" NOT NULL,
    "probability" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_stage_setting_pkey" PRIMARY KEY ("stage")
);

-- CreateIndex
CREATE INDEX "client_contact_clientId_idx" ON "client_contact"("clientId");

-- CreateIndex
CREATE INDEX "client_contact_lastName_idx" ON "client_contact"("lastName");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_projectId_key" ON "opportunity"("projectId");

-- CreateIndex
CREATE INDEX "opportunity_stage_archivedAt_idx" ON "opportunity"("stage", "archivedAt");

-- CreateIndex
CREATE INDEX "opportunity_ownerId_idx" ON "opportunity"("ownerId");

-- CreateIndex
CREATE INDEX "opportunity_clientId_idx" ON "opportunity"("clientId");

-- CreateIndex
CREATE INDEX "opportunity_nextActionDate_idx" ON "opportunity"("nextActionDate");

-- CreateIndex
CREATE INDEX "opportunity_activity_opportunityId_occurredAt_idx" ON "opportunity_activity"("opportunityId", "occurredAt");

-- AddForeignKey
ALTER TABLE "client_contact" ADD CONSTRAINT "client_contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "client_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activity" ADD CONSTRAINT "opportunity_activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_activity" ADD CONSTRAINT "opportunity_activity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Probabilités par défaut (modifiables dans Réglages CRM).
INSERT INTO "crm_stage_setting" ("stage", "probability", "updatedAt") VALUES
  ('A_CONTACTER', 10, now()), ('PREMIER_ECHANGE', 20, now()), ('QUALIFICATION', 35, now()),
  ('PROPOSITION_ENVOYEE', 55, now()), ('NEGOCIATION', 75, now()), ('GAGNE', 100, now()), ('PERDU', 0, now())
ON CONFLICT DO NOTHING;

-- Probabilité bornée.
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_probability_range" CHECK ("probability" IS NULL OR ("probability" BETWEEN 0 AND 100));
ALTER TABLE "crm_stage_setting" ADD CONSTRAINT "crm_stage_setting_probability_range" CHECK ("probability" BETWEEN 0 AND 100);
ALTER TABLE "opportunity" ADD CONSTRAINT "opportunity_amount_positive" CHECK ("amount" IS NULL OR "amount" >= 0);
