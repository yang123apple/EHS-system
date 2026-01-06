-- AlterTable
ALTER TABLE "HazardRecord" ADD COLUMN "currentStepId" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "currentStepIndex" INTEGER DEFAULT 0;
