-- CreateEnum
CREATE TYPE "TaskComplexity" AS ENUM ('SIMPLE', 'MOYENNE', 'COMPLEXE');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "complexity" "TaskComplexity";

-- CreateTable
CREATE TABLE "xp_transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "reversesId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_priority" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "taskId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_priority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "xp_transaction_idempotencyKey_key" ON "xp_transaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "xp_transaction_reversesId_key" ON "xp_transaction"("reversesId");

-- CreateIndex
CREATE INDEX "xp_transaction_userId_createdAt_idx" ON "xp_transaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "daily_priority_userId_day_taskId_key" ON "daily_priority"("userId", "day", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_priority_userId_day_position_key" ON "daily_priority"("userId", "day", "position");

-- AddForeignKey
ALTER TABLE "xp_transaction" ADD CONSTRAINT "xp_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_transaction" ADD CONSTRAINT "xp_transaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "xp_transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_priority" ADD CONSTRAINT "daily_priority_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_priority" ADD CONSTRAINT "daily_priority_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
