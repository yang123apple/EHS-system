/*
  Warnings:

  - You are about to drop the column `parentRecordId` on the `WorkPermitRecord` table. All the data in the column will be lost.
  - You are about to drop the column `subCode` on the `WorkPermitRecord` table. All the data in the column will be lost.
  - You are about to drop the column `urlCellLinks` on the `WorkPermitRecord` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkPermitRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "projectId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "approvalLogs" TEXT,
    "attachments" TEXT,
    "parsedFieldValues" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPermitRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPermitRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkPermitTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_WorkPermitRecord" ("approvalLogs", "attachments", "code", "createdAt", "currentStep", "dataJson", "id", "parsedFieldValues", "projectId", "status", "templateId") SELECT "approvalLogs", "attachments", "code", "createdAt", "currentStep", "dataJson", "id", "parsedFieldValues", "projectId", "status", "templateId" FROM "WorkPermitRecord";
DROP TABLE "WorkPermitRecord";
ALTER TABLE "new_WorkPermitRecord" RENAME TO "WorkPermitRecord";
CREATE UNIQUE INDEX "WorkPermitRecord_code_key" ON "WorkPermitRecord"("code");
CREATE TABLE "new_WorkPermitTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "structureJson" TEXT NOT NULL,
    "workflowConfig" TEXT,
    "parsedFields" TEXT,
    "level" TEXT NOT NULL DEFAULT 'primary',
    "sectionBindings" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WorkPermitTemplate" ("createdAt", "id", "isLocked", "name", "parsedFields", "structureJson", "type", "workflowConfig") SELECT "createdAt", "id", "isLocked", "name", "parsedFields", "structureJson", "type", "workflowConfig" FROM "WorkPermitTemplate";
DROP TABLE "WorkPermitTemplate";
ALTER TABLE "new_WorkPermitTemplate" RENAME TO "WorkPermitTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
