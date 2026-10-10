-- CreateEnum
CREATE TYPE "ProjectPhase" AS ENUM ('RECETTE', 'PREPARATION', 'CUISSON', 'DRESSAGE', 'SERVICE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('A_PREPARER', 'ACTIF', 'EN_ATTENTE', 'BLOQUE', 'TERMINE', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('A_FAIRE', 'EN_COURS', 'EN_REVUE', 'TERMINE', 'EN_ATTENTE', 'BLOQUE', 'ANNULE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('BASSE', 'NORMALE', 'HAUTE', 'URGENTE');

-- AlterTable
ALTER TABLE "audit_event" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "templateKey" TEXT,
    "ownerId" TEXT NOT NULL,
    "phase" "ProjectPhase" NOT NULL DEFAULT 'RECETTE',
    "status" "ProjectStatus" NOT NULL DEFAULT 'A_PREPARER',
    "statusReason" TEXT,
    "startDate" DATE,
    "plannedEndDate" DATE,
    "actualStartDate" DATE,
    "actualEndDate" DATE,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closingReview" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_package" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "plannedStart" DATE,
    "plannedEnd" DATE,
    "actualStart" DATE,
    "actualEnd" DATE,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_package_member" (
    "workPackageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "work_package_member_pkey" PRIMARY KEY ("workPackageId","userId")
);

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'A_FAIRE',
    "ownerId" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMALE',
    "startDate" DATE,
    "dueDate" DATE,
    "estimatedMinutes" INTEGER,
    "blockedReason" TEXT,
    "blockedNextAction" TEXT,
    "blockedReviewDate" DATE,
    "cancelReason" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_contributor" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "task_contributor_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "task_dependency" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "closure_item" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "checkedById" TEXT,
    "note" TEXT,

    CONSTRAINT "closure_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_name_idx" ON "client"("name");

-- CreateIndex
CREATE INDEX "project_status_archivedAt_idx" ON "project"("status", "archivedAt");

-- CreateIndex
CREATE INDEX "project_ownerId_idx" ON "project"("ownerId");

-- CreateIndex
CREATE INDEX "project_clientId_idx" ON "project"("clientId");

-- CreateIndex
CREATE INDEX "work_package_projectId_position_idx" ON "work_package"("projectId", "position");

-- CreateIndex
CREATE INDEX "task_projectId_archivedAt_idx" ON "task"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "task_ownerId_status_idx" ON "task"("ownerId", "status");

-- CreateIndex
CREATE INDEX "task_dueDate_idx" ON "task"("dueDate");

-- CreateIndex
CREATE INDEX "task_workPackageId_position_idx" ON "task"("workPackageId", "position");

-- CreateIndex
CREATE INDEX "task_dependency_dependsOnId_idx" ON "task_dependency"("dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependency_taskId_dependsOnId_key" ON "task_dependency"("taskId", "dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "closure_item_projectId_key_key" ON "closure_item"("projectId", "key");

-- CreateIndex
CREATE INDEX "audit_event_projectId_createdAt_idx" ON "audit_event"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package" ADD CONSTRAINT "work_package_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package" ADD CONSTRAINT "work_package_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package_member" ADD CONSTRAINT "work_package_member_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_package_member" ADD CONSTRAINT "work_package_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_contributor" ADD CONSTRAINT "task_contributor_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_contributor" ADD CONSTRAINT "task_contributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_item" ADD CONSTRAINT "closure_item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closure_item" ADD CONSTRAINT "closure_item_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
