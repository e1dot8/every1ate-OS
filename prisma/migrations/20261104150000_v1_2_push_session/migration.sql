-- AlterTable
ALTER TABLE "push_subscription" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "push_subscription_sessionId_idx" ON "push_subscription"("sessionId");

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

