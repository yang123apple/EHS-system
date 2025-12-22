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
    "subCode" TEXT,
    "parentRecordId" TEXT,
    "urlCellLinks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkPermitRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPermitRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkPermitTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkPermitRecord_parentRecordId_fkey" FOREIGN KEY ("parentRecordId") REFERENCES "WorkPermitRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WorkPermitRecord" ("approvalLogs", "attachments", "code", "createdAt", "currentStep", "dataJson", "id", "parsedFieldValues", "projectId", "status", "templateId") SELECT "approvalLogs", "attachments", "code", "createdAt", "currentStep", "dataJson", "id", "parsedFieldValues", "projectId", "status", "templateId" FROM "WorkPermitRecord";
DROP TABLE "WorkPermitRecord";
ALTER TABLE "new_WorkPermitRecord" RENAME TO "WorkPermitRecord";
CREATE UNIQUE INDEX "WorkPermitRecord_code_key" ON "WorkPermitRecord"("code");
CREATE UNIQUE INDEX "WorkPermitRecord_subCode_key" ON "WorkPermitRecord"("subCode");
CREATE INDEX "WorkPermitRecord_parentRecordId_idx" ON "WorkPermitRecord"("parentRecordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
