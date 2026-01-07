-- AlterTable
ALTER TABLE "WorkPermitRecord" ADD COLUMN "applicantDept" TEXT;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "applicantId" TEXT;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "applicantName" TEXT;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "location" TEXT;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "riskLevel" TEXT;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "supervisorId" TEXT;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "supervisorName" TEXT;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "workDate" DATETIME;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "workEndTime" DATETIME;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "workStartTime" DATETIME;
ALTER TABLE "WorkPermitRecord" ADD COLUMN "workType" TEXT;

-- CreateTable
CREATE TABLE "FileMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "md5Hash" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "uploaderId" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" DATETIME,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FileMetadata_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SignatureRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "permitId" TEXT NOT NULL,
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
    CONSTRAINT "SignatureRecord_permitId_fkey" FOREIGN KEY ("permitId") REFERENCES "WorkPermitRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubPermit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentPermitId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT,
    "cellKey" TEXT NOT NULL,
    "fieldName" TEXT,
    "dataJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "approvalLogs" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubPermit_parentPermitId_fkey" FOREIGN KEY ("parentPermitId") REFERENCES "WorkPermitRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FileMetadata_filePath_key" ON "FileMetadata"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "FileMetadata_md5Hash_key" ON "FileMetadata"("md5Hash");

-- CreateIndex
CREATE INDEX "FileMetadata_md5Hash_idx" ON "FileMetadata"("md5Hash");

-- CreateIndex
CREATE INDEX "FileMetadata_category_idx" ON "FileMetadata"("category");

-- CreateIndex
CREATE INDEX "FileMetadata_uploadedAt_idx" ON "FileMetadata"("uploadedAt");

-- CreateIndex
CREATE INDEX "FileMetadata_lastAccessedAt_idx" ON "FileMetadata"("lastAccessedAt");

-- CreateIndex
CREATE INDEX "FileMetadata_isArchived_idx" ON "FileMetadata"("isArchived");

-- CreateIndex
CREATE INDEX "SignatureRecord_permitId_idx" ON "SignatureRecord"("permitId");

-- CreateIndex
CREATE INDEX "SignatureRecord_signerId_idx" ON "SignatureRecord"("signerId");

-- CreateIndex
CREATE INDEX "SignatureRecord_signedAt_idx" ON "SignatureRecord"("signedAt");

-- CreateIndex
CREATE INDEX "SignatureRecord_action_idx" ON "SignatureRecord"("action");

-- CreateIndex
CREATE INDEX "SignatureRecord_permitId_stepIndex_idx" ON "SignatureRecord"("permitId", "stepIndex");

-- CreateIndex
CREATE INDEX "SubPermit_parentPermitId_idx" ON "SubPermit"("parentPermitId");

-- CreateIndex
CREATE INDEX "SubPermit_templateId_idx" ON "SubPermit"("templateId");

-- CreateIndex
CREATE INDEX "SubPermit_code_idx" ON "SubPermit"("code");

-- CreateIndex
CREATE INDEX "SubPermit_cellKey_idx" ON "SubPermit"("cellKey");

-- CreateIndex
CREATE INDEX "SubPermit_status_idx" ON "SubPermit"("status");

-- CreateIndex
CREATE INDEX "SubPermit_createdAt_idx" ON "SubPermit"("createdAt");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_riskLevel_idx" ON "WorkPermitRecord"("riskLevel");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_workType_idx" ON "WorkPermitRecord"("workType");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_location_idx" ON "WorkPermitRecord"("location");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_applicantId_idx" ON "WorkPermitRecord"("applicantId");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_applicantDept_idx" ON "WorkPermitRecord"("applicantDept");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_workDate_idx" ON "WorkPermitRecord"("workDate");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_status_idx" ON "WorkPermitRecord"("status");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_createdAt_idx" ON "WorkPermitRecord"("createdAt");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_workType_workDate_idx" ON "WorkPermitRecord"("workType", "workDate");

-- CreateIndex
CREATE INDEX "WorkPermitRecord_applicantDept_workDate_idx" ON "WorkPermitRecord"("applicantDept", "workDate");
