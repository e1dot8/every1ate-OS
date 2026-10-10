-- CreateTable
CREATE TABLE "system_info" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_info_pkey" PRIMARY KEY ("key")
);
