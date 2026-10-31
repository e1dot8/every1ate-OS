-- AlterTable
ALTER TABLE "agency_setting" ADD COLUMN     "crmBillingHorizonDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "crmLowSatisfaction" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "crmPaymentTermDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "crmSilenceDays" INTEGER NOT NULL DEFAULT 21;
