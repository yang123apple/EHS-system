/*
  Warnings:

  - Made the column `module` on table `SystemLog` required. This step will fail if there are existing NULL values in that column.

*/

-- 步骤1：填充现有记录的 module 字段（将 NULL 设置为默认值 'SYSTEM'）
UPDATE "SystemLog" SET "module" = 'SYSTEM' WHERE "module" IS NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "userDepartment" TEXT,
    "userDepartmentId" TEXT,
    "userJobTitle" TEXT,
    "userRoleInAction" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionLabel" TEXT,
    "businessCode" TEXT,
    "targetId" TEXT,
    "targetType" TEXT,
    "targetLabel" TEXT,
    "targetLink" TEXT,
    "snapshot" TEXT,
    "diff" TEXT,
    "changes" TEXT,
    "beforeData" TEXT,
    "afterData" TEXT,
    "clientInfo" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_SystemLog" ("action", "actionLabel", "afterData", "beforeData", "changes", "createdAt", "details", "id", "ip", "module", "snapshot", "targetId", "targetLabel", "targetType", "userAgent", "userDepartment", "userDepartmentId", "userId", "userJobTitle", "userName", "userRole", "userRoleInAction") SELECT "action", "actionLabel", "afterData", "beforeData", "changes", "createdAt", "details", "id", "ip", "module", "snapshot", "targetId", "targetLabel", "targetType", "userAgent", "userDepartment", "userDepartmentId", "userId", "userJobTitle", "userName", "userRole", "userRoleInAction" FROM "SystemLog";
DROP TABLE "SystemLog";
ALTER TABLE "new_SystemLog" RENAME TO "SystemLog";
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");
CREATE INDEX "SystemLog_module_idx" ON "SystemLog"("module");
CREATE INDEX "SystemLog_action_idx" ON "SystemLog"("action");
CREATE INDEX "SystemLog_targetType_idx" ON "SystemLog"("targetType");
CREATE INDEX "SystemLog_targetId_idx" ON "SystemLog"("targetId");
CREATE INDEX "SystemLog_businessCode_idx" ON "SystemLog"("businessCode");
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");
CREATE INDEX "SystemLog_module_targetId_idx" ON "SystemLog"("module", "targetId");
CREATE INDEX "SystemLog_userId_createdAt_idx" ON "SystemLog"("userId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
