-- CreateEnum
CREATE TYPE "Impact" AS ENUM ('FAIBLE', 'MOYEN', 'FORT');

-- CreateEnum
CREATE TYPE "TimeSource" AS ENUM ('TIMER', 'MANUEL');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "impact" "Impact" NOT NULL DEFAULT 'MOYEN',
ADD COLUMN     "priorityLocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reachedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "source" "TimeSource" NOT NULL,
    "comment" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "projectId" TEXT,
    "taskId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "milestone_projectId_date_idx" ON "milestone"("projectId", "date");

-- CreateIndex
CREATE INDEX "time_entry_userId_date_idx" ON "time_entry"("userId", "date");

-- CreateIndex
CREATE INDEX "time_entry_taskId_idx" ON "time_entry"("taskId");

-- CreateIndex
CREATE INDEX "time_entry_projectId_idx" ON "time_entry"("projectId");

-- CreateIndex
CREATE INDEX "task_comment_taskId_createdAt_idx" ON "task_comment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_userId_dedupeKey_key" ON "notification"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestone" ADD CONSTRAINT "milestone_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un seul chronomètre actif par utilisateur (§8).
CREATE UNIQUE INDEX "time_entry_one_active_timer" ON "time_entry"("userId") WHERE "endedAt" IS NULL AND "source" = 'TIMER' AND "deletedAt" IS NULL;
