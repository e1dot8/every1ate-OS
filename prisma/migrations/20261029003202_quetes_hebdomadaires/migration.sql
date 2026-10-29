-- CreateTable
CREATE TABLE "quest_enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questKey" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "quest_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quest_enrollment_userId_weekStart_idx" ON "quest_enrollment"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "quest_enrollment_userId_questKey_weekStart_key" ON "quest_enrollment"("userId", "questKey", "weekStart");

-- AddForeignKey
ALTER TABLE "quest_enrollment" ADD CONSTRAINT "quest_enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
