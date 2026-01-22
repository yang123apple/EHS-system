-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HazardRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "checkType" TEXT NOT NULL DEFAULT 'daily',
    "rectificationType" TEXT NOT NULL DEFAULT 'scheduled',
    "type" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "photos" TEXT,
    "reporterId" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "reportTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsibleId" TEXT,
    "responsibleName" TEXT,
    "responsibleDept" TEXT,
    "deadline" DATETIME,
    "rectifyDesc" TEXT,
    "rectifyPhotos" TEXT,
    "rectifyTime" DATETIME,
    "verifierId" TEXT,
    "verifierName" TEXT,
    "verifyTime" DATETIME,
    "verifyPhotos" TEXT,
    "verifyDesc" TEXT,
    "rectifyRequirement" TEXT,
    "requireEmergencyPlan" BOOLEAN NOT NULL DEFAULT false,
    "emergencyPlanDeadline" DATETIME,
    "emergencyPlanContent" TEXT,
    "emergencyPlanSubmitTime" DATETIME,
    "rootCause" TEXT,
    "ccDepts" TEXT,
    "ccUsers" TEXT,
    "logs" TEXT,
    "old_personal_ID" TEXT,
    "dopersonal_ID" TEXT,
    "dopersonal_Name" TEXT,
    "candidateHandlers" TEXT,
    "approvalMode" TEXT,
    "currentStepIndex" INTEGER DEFAULT 0,
    "currentStepId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HazardRecord_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HazardRecord_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HazardRecord" ("approvalMode", "candidateHandlers", "ccDepts", "ccUsers", "checkType", "code", "createdAt", "currentStepId", "currentStepIndex", "deadline", "desc", "dopersonal_ID", "dopersonal_Name", "emergencyPlanContent", "emergencyPlanDeadline", "emergencyPlanSubmitTime", "id", "location", "logs", "old_personal_ID", "photos", "rectificationType", "rectifyDesc", "rectifyPhotos", "rectifyRequirement", "rectifyTime", "reportTime", "reporterId", "reporterName", "requireEmergencyPlan", "responsibleDept", "responsibleId", "responsibleName", "riskLevel", "rootCause", "status", "type", "updatedAt", "verifierId", "verifierName", "verifyDesc", "verifyPhotos", "verifyTime") SELECT "approvalMode", "candidateHandlers", "ccDepts", "ccUsers", coalesce("checkType", 'daily') AS "checkType", "code", "createdAt", "currentStepId", "currentStepIndex", "deadline", "desc", "dopersonal_ID", "dopersonal_Name", "emergencyPlanContent", "emergencyPlanDeadline", "emergencyPlanSubmitTime", "id", "location", "logs", "old_personal_ID", "photos", coalesce("rectificationType", 'scheduled') AS "rectificationType", "rectifyDesc", "rectifyPhotos", "rectifyRequirement", "rectifyTime", "reportTime", "reporterId", "reporterName", "requireEmergencyPlan", "responsibleDept", "responsibleId", "responsibleName", "riskLevel", "rootCause", "status", "type", "updatedAt", "verifierId", "verifierName", "verifyDesc", "verifyPhotos", "verifyTime" FROM "HazardRecord";
DROP TABLE "HazardRecord";
ALTER TABLE "new_HazardRecord" RENAME TO "HazardRecord";
CREATE UNIQUE INDEX "HazardRecord_code_key" ON "HazardRecord"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
