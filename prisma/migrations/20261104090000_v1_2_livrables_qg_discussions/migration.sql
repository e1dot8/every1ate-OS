-- CreateEnum
CREATE TYPE "DeliverableStage" AS ENUM ('PREPARATION', 'CREATION', 'PRODUCTION', 'MONTAGE', 'LIVRAISON', 'LIVRE');

-- CreateEnum
CREATE TYPE "DeliverableFormat" AS ENUM ('VIDEO', 'REEL', 'PHOTO', 'POST', 'CAROUSEL', 'STORY', 'VISUEL', 'ARTICLE', 'PRINT', 'AUTRE');

-- CreateEnum
CREATE TYPE "PresenceState" AS ENUM ('DISPO', 'FOCUS', 'REUNION', 'ABSENT');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "ChannelKind" AS ENUM ('PUBLIC', 'PRIVE', 'DIRECT', 'PERSO');

-- AlterTable
ALTER TABLE "agency_setting" ADD COLUMN     "wipLimit" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "wipOverrideReason" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "notifyPrefs" JSONB,
ADD COLUMN     "presenceNote" TEXT,
ADD COLUMN     "presenceShared" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "presenceState" "PresenceState" NOT NULL DEFAULT 'DISPO',
ADD COLUMN     "presenceUntil" TIMESTAMP(3),
ADD COLUMN     "whatsappKey" TEXT,
ADD COLUMN     "whatsappPhone" TEXT;

-- CreateTable
CREATE TABLE "deliverable" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workPackageId" TEXT,
    "title" TEXT NOT NULL,
    "format" "DeliverableFormat" NOT NULL DEFAULT 'AUTRE',
    "channel" TEXT,
    "stage" "DeliverableStage" NOT NULL DEFAULT 'PREPARATION',
    "ownerId" TEXT,
    "dueDate" DATE,
    "publishDate" DATE,
    "link" TEXT,
    "notes" TEXT,
    "blockedReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable_check_item" (
    "id" TEXT NOT NULL,
    "deliverableId" TEXT NOT NULL,
    "stage" "DeliverableStage" NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "dueDate" DATE,
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliverable_check_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_delivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoff" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "opportunityId" TEXT,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "note" TEXT,
    "status" "HandoffStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standup_entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "today" TEXT,
    "blocked" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "standup_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_badge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topic" TEXT,
    "kind" "ChannelKind" NOT NULL DEFAULT 'PUBLIC',
    "projectId" TEXT,
    "meetUrl" TEXT,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_member" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "mentionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alsoInChannel" BOOLEAN NOT NULL DEFAULT false,
    "taskId" TEXT,
    "meta" JSONB,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "pinnedAt" TIMESTAMP(3),
    "pinnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_message" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT,
    "text" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_message" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliverable_projectId_archivedAt_idx" ON "deliverable"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "deliverable_stage_dueDate_idx" ON "deliverable"("stage", "dueDate");

-- CreateIndex
CREATE INDEX "deliverable_ownerId_idx" ON "deliverable"("ownerId");

-- CreateIndex
CREATE INDEX "deliverable_check_item_deliverableId_stage_position_idx" ON "deliverable_check_item"("deliverableId", "stage", "position");

-- CreateIndex
CREATE INDEX "deliverable_check_item_assigneeId_doneAt_idx" ON "deliverable_check_item"("assigneeId", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscription_userId_idx" ON "push_subscription"("userId");

-- CreateIndex
CREATE INDEX "external_delivery_userId_createdAt_idx" ON "external_delivery"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "external_delivery_channel_createdAt_idx" ON "external_delivery"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "handoff_toId_status_idx" ON "handoff"("toId", "status");

-- CreateIndex
CREATE INDEX "handoff_fromId_status_idx" ON "handoff"("fromId", "status");

-- CreateIndex
CREATE INDEX "handoff_taskId_idx" ON "handoff"("taskId");

-- CreateIndex
CREATE INDEX "handoff_opportunityId_idx" ON "handoff"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "standup_entry_userId_date_key" ON "standup_entry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "team_badge_key_period_key" ON "team_badge"("key", "period");

-- CreateIndex
CREATE UNIQUE INDEX "channel_slug_key" ON "channel"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "channel_projectId_key" ON "channel"("projectId");

-- CreateIndex
CREATE INDEX "channel_kind_archivedAt_idx" ON "channel"("kind", "archivedAt");

-- CreateIndex
CREATE INDEX "channel_member_userId_idx" ON "channel_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_member_channelId_userId_key" ON "channel_member"("channelId", "userId");

-- CreateIndex
CREATE INDEX "message_channelId_createdAt_idx" ON "message"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "message_parentId_createdAt_idx" ON "message"("parentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "message_reaction_messageId_userId_emoji_key" ON "message_reaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "saved_message_userId_messageId_key" ON "saved_message"("userId", "messageId");

-- CreateIndex
CREATE INDEX "reminder_sentAt_remindAt_idx" ON "reminder"("sentAt", "remindAt");

-- CreateIndex
CREATE INDEX "scheduled_message_sentAt_sendAt_idx" ON "scheduled_message"("sentAt", "sendAt");

-- AddForeignKey
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable" ADD CONSTRAINT "deliverable_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_check_item" ADD CONSTRAINT "deliverable_check_item_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "deliverable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_check_item" ADD CONSTRAINT "deliverable_check_item_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_check_item" ADD CONSTRAINT "deliverable_check_item_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_delivery" ADD CONSTRAINT "external_delivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_toId_fkey" FOREIGN KEY ("toId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standup_entry" ADD CONSTRAINT "standup_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel" ADD CONSTRAINT "channel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel" ADD CONSTRAINT "channel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member" ADD CONSTRAINT "channel_member_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_member" ADD CONSTRAINT "channel_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reaction" ADD CONSTRAINT "message_reaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reaction" ADD CONSTRAINT "message_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_message" ADD CONSTRAINT "saved_message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_message" ADD CONSTRAINT "saved_message_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder" ADD CONSTRAINT "reminder_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_message" ADD CONSTRAINT "scheduled_message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_message" ADD CONSTRAINT "scheduled_message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Contraintes métier (V1.2)
ALTER TABLE "agency_setting" ADD CONSTRAINT "agency_setting_wip_limit_range" CHECK ("wipLimit" BETWEEN 1 AND 10);
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_target_one" CHECK (("taskId" IS NOT NULL)::int + ("opportunityId" IS NOT NULL)::int = 1);
ALTER TABLE "handoff" ADD CONSTRAINT "handoff_not_self" CHECK ("fromId" <> "toId");
-- Une seule passation en attente par tâche ou opportunité.
CREATE UNIQUE INDEX "handoff_one_pending_task" ON "handoff" ("taskId") WHERE "status" = 'EN_ATTENTE' AND "taskId" IS NOT NULL;
CREATE UNIQUE INDEX "handoff_one_pending_opportunity" ON "handoff" ("opportunityId") WHERE "status" = 'EN_ATTENTE' AND "opportunityId" IS NOT NULL;
