-- CreateIndex
CREATE INDEX "HazardRecord_isVoided_idx" ON "HazardRecord"("isVoided");

-- CreateIndex  
CREATE INDEX "HazardRecord_voidedAt_idx" ON "HazardRecord"("voidedAt");

-- AlterTable
ALTER TABLE "HazardRecord" ADD COLUMN "isVoided" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HazardRecord" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "HazardRecord" ADD COLUMN "voidedBy" TEXT;
