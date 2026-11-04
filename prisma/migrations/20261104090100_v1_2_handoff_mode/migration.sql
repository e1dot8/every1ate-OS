-- CreateEnum
CREATE TYPE "HandoffMode" AS ENUM ('DONNER', 'REPRENDRE');

-- AlterTable
ALTER TABLE "handoff" ADD COLUMN     "mode" "HandoffMode" NOT NULL DEFAULT 'DONNER';

