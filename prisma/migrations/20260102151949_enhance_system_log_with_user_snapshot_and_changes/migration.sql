-- AlterTable
ALTER TABLE "SystemLog" ADD COLUMN "actionLabel" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "afterData" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "beforeData" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "changes" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "module" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "targetLabel" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "userDepartment" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "userDepartmentId" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "userJobTitle" TEXT;
ALTER TABLE "SystemLog" ADD COLUMN "userRole" TEXT;

-- CreateIndex
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");

-- CreateIndex
CREATE INDEX "SystemLog_action_idx" ON "SystemLog"("action");

-- CreateIndex
CREATE INDEX "SystemLog_targetType_idx" ON "SystemLog"("targetType");

-- CreateIndex
CREATE INDEX "SystemLog_module_idx" ON "SystemLog"("module");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");
