
-- AlterTable
ALTER TABLE "message" ADD COLUMN     "aboutDeliverableId" TEXT,
ADD COLUMN     "aboutTaskId" TEXT;

-- AlterTable
ALTER TABLE "task_comment" ADD COLUMN     "movedToMessageId" TEXT;

-- CreateTable
CREATE TABLE "morning_report" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "morning_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "morning_report_date_key" ON "morning_report"("date");

-- CreateIndex
CREATE INDEX "message_aboutTaskId_createdAt_idx" ON "message"("aboutTaskId", "createdAt");

-- CreateIndex
CREATE INDEX "message_aboutDeliverableId_createdAt_idx" ON "message"("aboutDeliverableId", "createdAt");

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_aboutTaskId_fkey" FOREIGN KEY ("aboutTaskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_aboutDeliverableId_fkey" FOREIGN KEY ("aboutDeliverableId") REFERENCES "deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Une seule racine de discussion par tâche et par livrable.
CREATE UNIQUE INDEX "message_about_task_root" ON "message" ("aboutTaskId") WHERE "parentId" IS NULL AND "aboutTaskId" IS NOT NULL;
CREATE UNIQUE INDEX "message_about_deliverable_root" ON "message" ("aboutDeliverableId") WHERE "parentId" IS NULL AND "aboutDeliverableId" IS NOT NULL;
-- Un message porte au plus un élément.
ALTER TABLE "message" ADD CONSTRAINT "message_about_one" CHECK (("aboutTaskId" IS NOT NULL)::int + ("aboutDeliverableId" IS NOT NULL)::int <= 1);
