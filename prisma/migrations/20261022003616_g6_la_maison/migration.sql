-- CreateTable
CREATE TABLE "user_avatar" (
    "userId" TEXT NOT NULL,
    "skin" TEXT NOT NULL DEFAULT 's3',
    "hat" TEXT NOT NULL DEFAULT 'toque',
    "apron" TEXT NOT NULL DEFAULT 'noir',
    "accessory" TEXT NOT NULL DEFAULT 'aucun',
    "backdrop" TEXT NOT NULL DEFAULT 'creme',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatar_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "apartment_item" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,

    CONSTRAINT "apartment_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "authorId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_use" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_use_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_request" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "skillKey" TEXT,
    "message" TEXT NOT NULL,
    "takenById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brigade_reaction" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "brigade_reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "apartment_item_userId_slot_key" ON "apartment_item"("userId", "slot");

-- CreateIndex
CREATE INDEX "recipe_category_archivedAt_idx" ON "recipe"("category", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_use_recipeId_userId_key" ON "recipe_use"("recipeId", "userId");

-- CreateIndex
CREATE INDEX "help_request_resolvedAt_createdAt_idx" ON "help_request"("resolvedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "brigade_reaction_eventId_userId_emoji_key" ON "brigade_reaction"("eventId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apartment_item" ADD CONSTRAINT "apartment_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_use" ADD CONSTRAINT "recipe_use_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_use" ADD CONSTRAINT "recipe_use_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_request" ADD CONSTRAINT "help_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_request" ADD CONSTRAINT "help_request_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_reaction" ADD CONSTRAINT "brigade_reaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "brigade_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_reaction" ADD CONSTRAINT "brigade_reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
