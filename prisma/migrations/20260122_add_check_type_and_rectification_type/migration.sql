-- AlterTable
ALTER TABLE "HazardRecord" ADD COLUMN "checkType" TEXT DEFAULT 'daily';
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationType" TEXT DEFAULT 'scheduled';
