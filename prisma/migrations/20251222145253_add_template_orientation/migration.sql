-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkPermitTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "structureJson" TEXT NOT NULL,
    "workflowConfig" TEXT,
    "parsedFields" TEXT,
    "level" TEXT NOT NULL DEFAULT 'primary',
    "sectionBindings" TEXT,
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_WorkPermitTemplate" ("createdAt", "id", "isLocked", "level", "name", "parsedFields", "sectionBindings", "structureJson", "type", "workflowConfig") SELECT "createdAt", "id", "isLocked", "level", "name", "parsedFields", "sectionBindings", "structureJson", "type", "workflowConfig" FROM "WorkPermitTemplate";
DROP TABLE "WorkPermitTemplate";
ALTER TABLE "new_WorkPermitTemplate" RENAME TO "WorkPermitTemplate";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
