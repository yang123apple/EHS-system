-- AlterTable
ALTER TABLE "HazardRecord" ADD COLUMN "rootCause" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "verifyDesc" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "verifyPhotos" TEXT;

-- CreateTable
CREATE TABLE "HazardExtension" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hazardId" TEXT NOT NULL,
    "oldDeadline" DATETIME NOT NULL,
    "newDeadline" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HazardExtension_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HazardRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SignatureRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "permitId" TEXT,
    "incidentId" TEXT,
    "hazardId" TEXT,
    "signerId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "stepIndex" INTEGER NOT NULL,
    "stepName" TEXT,
    "dataSnapshotHash" TEXT NOT NULL,
    "dataSnapshot" TEXT,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientInfo" TEXT,
    CONSTRAINT "SignatureRecord_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "WorkPermitRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SignatureRecord_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SignatureRecord_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HazardRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SignatureRecord" ("action", "clientInfo", "comment", "dataSnapshot", "dataSnapshotHash", "id", "permitId", "incidentId", "signedAt", "signerId", "signerName", "stepIndex", "stepName") SELECT "action", "clientInfo", "comment", "dataSnapshot", "dataSnapshotHash", "id", "permitId", "incidentId", "signedAt", "signerId", "signerName", "stepIndex", "stepName" FROM "SignatureRecord";
DROP TABLE "SignatureRecord";
ALTER TABLE "new_SignatureRecord" RENAME TO "SignatureRecord";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "HazardExtension_hazardId_idx" ON "HazardExtension"("hazardId");
CREATE INDEX "HazardExtension_applicantId_idx" ON "HazardExtension"("applicantId");
CREATE INDEX "HazardExtension_approverId_idx" ON "HazardExtension"("approverId");
CREATE INDEX "HazardExtension_status_idx" ON "HazardExtension"("status");
CREATE INDEX "HazardExtension_createdAt_idx" ON "HazardExtension"("createdAt");
CREATE INDEX "SignatureRecord_hazardId_idx" ON "SignatureRecord"("hazardId");
CREATE INDEX "SignatureRecord_hazardId_stepIndex_idx" ON "SignatureRecord"("hazardId", "stepIndex");
