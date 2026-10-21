-- CreateEnum
CREATE TYPE "DayMood" AS ENUM ('EN_FORME', 'NORMAL', 'CHARGE_ELEVEE', 'BESOIN_ALLEGER');

-- CreateEnum
CREATE TYPE "WeeklyItemKind" AS ENUM ('OBJECTIF', 'BLOCAGE', 'DECISION', 'ACTION');

-- CreateEnum
CREATE TYPE "WeeklyItemStatus" AS ENUM ('OUVERT', 'ATTEINT', 'NON_ATTEINT', 'FAIT');

-- CreateTable
CREATE TABLE "daily_briefing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "mood" "DayMood",
    "moodShared" BOOLEAN NOT NULL DEFAULT false,
    "blocker" TEXT,
    "helpWanted" BOOLEAN NOT NULL DEFAULT false,
    "personalGoal" TEXT,
    "plannedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_briefing" (
    "id" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "progressFocus" TEXT,
    "notes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_briefing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_item" (
    "id" TEXT NOT NULL,
    "briefingId" TEXT NOT NULL,
    "kind" "WeeklyItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "ownerId" TEXT,
    "dueDate" DATE,
    "status" "WeeklyItemStatus" NOT NULL DEFAULT 'OUVERT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_briefing_userId_day_key" ON "daily_briefing"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_briefing_weekStart_key" ON "weekly_briefing"("weekStart");

-- CreateIndex
CREATE INDEX "weekly_item_briefingId_kind_idx" ON "weekly_item"("briefingId", "kind");

-- AddForeignKey
ALTER TABLE "daily_briefing" ADD CONSTRAINT "daily_briefing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_item" ADD CONSTRAINT "weekly_item_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "weekly_briefing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_item" ADD CONSTRAINT "weekly_item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
