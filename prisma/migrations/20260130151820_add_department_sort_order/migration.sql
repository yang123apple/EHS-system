-- AlterTable
ALTER TABLE "Document" ADD COLUMN "uploadedAt" DATETIME;
ALTER TABLE "Document" ADD COLUMN "uploaderId" TEXT;
ALTER TABLE "Document" ADD COLUMN "uploaderName" TEXT;

-- AlterTable
ALTER TABLE "HazardRecord" ADD COLUMN "ccDeptIds" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "ccUserIds" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "currentExecutorId" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "currentExecutorName" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "historicalHandlerIds" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationDeptId" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationDeptName" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationLeaderId" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationLeaderName" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationNotes" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationPhotos" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationRequirements" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "rectificationTime" DATETIME;
ALTER TABLE "HazardRecord" ADD COLUMN "reporterDeptName" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "verificationNotes" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "verificationPhotos" TEXT;
ALTER TABLE "HazardRecord" ADD COLUMN "verificationTime" DATETIME;

-- AlterTable
ALTER TABLE "Incident" ADD COLUMN "ccDeptIds" TEXT;
ALTER TABLE "Incident" ADD COLUMN "ccUserIds" TEXT;
ALTER TABLE "Incident" ADD COLUMN "rectificationLeaderId" TEXT;
ALTER TABLE "Incident" ADD COLUMN "rectificationLeaderName" TEXT;
ALTER TABLE "Incident" ADD COLUMN "reporterDeptName" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "contractorContact" TEXT;
ALTER TABLE "Project" ADD COLUMN "contractorHead" TEXT;
ALTER TABLE "Project" ADD COLUMN "contractorName" TEXT;
ALTER TABLE "Project" ADD COLUMN "requestorContact" TEXT;
ALTER TABLE "Project" ADD COLUMN "requestorDept" TEXT;
ALTER TABLE "Project" ADD COLUMN "requestorHead" TEXT;
ALTER TABLE "Project" ADD COLUMN "supervisorContact" TEXT;
ALTER TABLE "Project" ADD COLUMN "supervisorDept" TEXT;
ALTER TABLE "Project" ADD COLUMN "supervisorHead" TEXT;

-- AlterTable
ALTER TABLE "TrainingMaterial" ADD COLUMN "thumbnailPendingSince" DATETIME;

-- AlterTable
ALTER TABLE "WorkPermitRecord" ADD COLUMN "applicantDeptName" TEXT;

-- CreateTable
CREATE TABLE "FileDeletionQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriedAt" DATETIME,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Department" ("createdAt", "id", "level", "managerId", "name", "parentId", "updatedAt") SELECT "createdAt", "id", "level", "managerId", "name", "parentId", "updatedAt" FROM "Department";
DROP TABLE "Department";
ALTER TABLE "new_Department" RENAME TO "Department";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FileDeletionQueue_status_idx" ON "FileDeletionQueue"("status");

-- CreateIndex
CREATE INDEX "FileDeletionQueue_lastTriedAt_idx" ON "FileDeletionQueue"("lastTriedAt");
