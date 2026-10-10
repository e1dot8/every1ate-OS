-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('OCCUPE', 'PARTAGE');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('DOCUMENT', 'DOSSIER', 'MEDIA', 'AUTRE');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('NON_VERIFIE', 'OK', 'INTROUVABLE', 'ERREUR');

-- CreateTable
CREATE TABLE "calendar_event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'OCCUPE',
    "ownerId" TEXT NOT NULL,
    "projectId" TEXT,
    "clientId" TEXT,
    "opportunityId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_attendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "event_attendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_feed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "includeTasks" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calendar_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_reference" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "FileKind" NOT NULL DEFAULT 'DOCUMENT',
    "provider" TEXT NOT NULL DEFAULT 'google_drive',
    "externalId" TEXT,
    "ownerLabel" TEXT,
    "documentDate" DATE,
    "projectId" TEXT,
    "workPackageId" TEXT,
    "taskId" TEXT,
    "clientId" TEXT,
    "status" "FileStatus" NOT NULL DEFAULT 'NON_VERIFIE',
    "statusDetail" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "addedById" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_event_startsAt_endsAt_idx" ON "calendar_event"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "calendar_event_ownerId_idx" ON "calendar_event"("ownerId");

-- CreateIndex
CREATE INDEX "calendar_event_projectId_idx" ON "calendar_event"("projectId");

-- CreateIndex
CREATE INDEX "event_attendee_userId_idx" ON "event_attendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "event_attendee_eventId_userId_key" ON "event_attendee"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_userId_key" ON "calendar_feed"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_tokenHash_key" ON "calendar_feed"("tokenHash");

-- CreateIndex
CREATE INDEX "file_reference_projectId_idx" ON "file_reference"("projectId");

-- CreateIndex
CREATE INDEX "file_reference_taskId_idx" ON "file_reference"("taskId");

-- CreateIndex
CREATE INDEX "file_reference_clientId_idx" ON "file_reference"("clientId");

-- CreateIndex
CREATE INDEX "file_reference_externalId_idx" ON "file_reference"("externalId");

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendee" ADD CONSTRAINT "event_attendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attendee" ADD CONSTRAINT "event_attendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_feed" ADD CONSTRAINT "calendar_feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "work_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_reference" ADD CONSTRAINT "file_reference_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un événement se termine après son début.
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_range" CHECK ("endsAt" > "startsAt");
