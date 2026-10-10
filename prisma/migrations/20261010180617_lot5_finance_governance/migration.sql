-- CreateEnum
CREATE TYPE "CostStatus" AS ENUM ('PREVU', 'ENGAGE', 'FACTURE', 'PAYE', 'ANNULE');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FORFAIT', 'TEMPS', 'FRAIS');

-- CreateEnum
CREATE TYPE "RecordSource" AS ENUM ('MANUEL', 'IMPORT');

-- CreateEnum
CREATE TYPE "BillingKind" AS ENUM ('ACOMPTE', 'INTERMEDIAIRE', 'SOLDE', 'AUTRE');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('ATTENDU', 'FACTURE', 'ANNULE');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('BROUILLON', 'ACTIF', 'SUSPENDU', 'RESILIE', 'TERMINE');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('APPLIQUEE', 'EN_ATTENTE', 'REFUSEE');

-- CreateEnum
CREATE TYPE "DecisionKind" AS ENUM ('BUDGET', 'PLANNING', 'PERIMETRE');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('OUVERTE', 'APPROUVEE', 'REFUSEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('POUR', 'CONTRE', 'ABSTENTION');

-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('COUTS', 'ENCAISSEMENTS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('BROUILLON', 'IMPORTE', 'ANNULE');

-- CreateTable
CREATE TABLE "budget_revision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "plannedRevenue" DECIMAL(12,2) NOT NULL,
    "plannedCost" DECIMAL(12,2) NOT NULL,
    "pricingMode" "PricingMode",
    "reason" TEXT,
    "status" "RevisionStatus" NOT NULL DEFAULT 'APPLIQUEE',
    "decisionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_item" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "supplier" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "pricingMode" "PricingMode" NOT NULL DEFAULT 'FRAIS',
    "quantity" DECIMAL(12,3),
    "unit" TEXT,
    "unitRate" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2),
    "amountTTC" DECIMAL(12,2),
    "status" "CostStatus" NOT NULL DEFAULT 'PREVU',
    "committedAt" DATE,
    "invoiceDate" DATE,
    "dueDate" DATE,
    "paidAt" DATE,
    "documentRef" TEXT,
    "rebillable" BOOLEAN NOT NULL DEFAULT false,
    "source" "RecordSource" NOT NULL DEFAULT 'MANUEL',
    "importBatchId" TEXT,
    "externalId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "label" TEXT NOT NULL,
    "kind" "BillingKind" NOT NULL DEFAULT 'AUTRE',
    "plannedDate" DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2),
    "status" "BillingStatus" NOT NULL DEFAULT 'ATTENDU',
    "invoiceRef" TEXT,
    "invoiceUrl" TEXT,
    "invoicedAt" DATE,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_record" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "billingMilestoneId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedAt" DATE NOT NULL,
    "reference" TEXT,
    "label" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'MANUEL',
    "importBatchId" TEXT,
    "externalId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_contract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "label" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "durationMonths" INTEGER,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIF',
    "renewalDate" DATE,
    "noticeDays" INTEGER,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batch" (
    "id" TEXT NOT NULL,
    "kind" "ImportKind",
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'BROUILLON',
    "headers" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "mapping" JSONB,
    "projectId" TEXT,
    "report" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,

    CONSTRAINT "import_batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_setting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "budgetOverrunPct" INTEGER,
    "delayPct" INTEGER,
    "delayMinDays" INTEGER,
    "requiredApprovals" INTEGER NOT NULL DEFAULT 2,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_request" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "DecisionKind" NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "consequences" TEXT,
    "before" JSONB,
    "after" JSONB,
    "status" "DecisionStatus" NOT NULL DEFAULT 'OUVERTE',
    "requiredApprovals" INTEGER NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "decision_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_vote" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_revision_decisionId_key" ON "budget_revision"("decisionId");

-- CreateIndex
CREATE INDEX "budget_revision_projectId_workPackageId_createdAt_idx" ON "budget_revision"("projectId", "workPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "cost_item_projectId_status_idx" ON "cost_item"("projectId", "status");

-- CreateIndex
CREATE INDEX "cost_item_workPackageId_idx" ON "cost_item"("workPackageId");

-- CreateIndex
CREATE INDEX "cost_item_importBatchId_idx" ON "cost_item"("importBatchId");

-- CreateIndex
CREATE INDEX "cost_item_externalId_idx" ON "cost_item"("externalId");

-- CreateIndex
CREATE INDEX "billing_milestone_projectId_plannedDate_idx" ON "billing_milestone"("projectId", "plannedDate");

-- CreateIndex
CREATE INDEX "billing_milestone_invoiceRef_idx" ON "billing_milestone"("invoiceRef");

-- CreateIndex
CREATE INDEX "payment_record_projectId_receivedAt_idx" ON "payment_record"("projectId", "receivedAt");

-- CreateIndex
CREATE INDEX "payment_record_billingMilestoneId_idx" ON "payment_record"("billingMilestoneId");

-- CreateIndex
CREATE INDEX "payment_record_importBatchId_idx" ON "payment_record"("importBatchId");

-- CreateIndex
CREATE INDEX "recurring_contract_status_idx" ON "recurring_contract"("status");

-- CreateIndex
CREATE INDEX "import_batch_createdAt_idx" ON "import_batch"("createdAt");

-- CreateIndex
CREATE INDEX "import_batch_fileHash_idx" ON "import_batch"("fileHash");

-- CreateIndex
CREATE INDEX "decision_request_status_createdAt_idx" ON "decision_request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "decision_request_projectId_idx" ON "decision_request"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_vote_decisionId_userId_key" ON "decision_vote"("decisionId", "userId");

-- AddForeignKey
ALTER TABLE "budget_revision" ADD CONSTRAINT "budget_revision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revision" ADD CONSTRAINT "budget_revision_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revision" ADD CONSTRAINT "budget_revision_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_milestone" ADD CONSTRAINT "billing_milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_milestone" ADD CONSTRAINT "billing_milestone_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_billingMilestoneId_fkey" FOREIGN KEY ("billingMilestoneId") REFERENCES "billing_milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_record_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_contract" ADD CONSTRAINT "recurring_contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_contract" ADD CONSTRAINT "recurring_contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_request" ADD CONSTRAINT "decision_request_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_request" ADD CONSTRAINT "decision_request_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_vote" ADD CONSTRAINT "decision_vote_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_vote" ADD CONSTRAINT "decision_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Montants positifs ; une seule ligne de réglages de gouvernance.
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "billing_milestone" ADD CONSTRAINT "billing_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "payment_record" ADD CONSTRAINT "payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "recurring_contract" ADD CONSTRAINT "contract_amount_positive" CHECK ("monthlyAmount" >= 0);
ALTER TABLE "budget_revision" ADD CONSTRAINT "budget_amounts_positive" CHECK ("plannedRevenue" >= 0 AND "plannedCost" >= 0);
ALTER TABLE "governance_setting" ADD CONSTRAINT "governance_single_row" CHECK ("id" = 'default');
INSERT INTO "governance_setting" ("id", "requiredApprovals", "blocking", "updatedAt") VALUES ('default', 2, true, now()) ON CONFLICT DO NOTHING;
