-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reporterName" TEXT NOT NULL,
    "reporterDept" TEXT,
    "reportTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departmentId" TEXT,
    "departmentName" TEXT,
    "directCause" TEXT,
    "indirectCause" TEXT,
    "managementCause" TEXT,
    "rootCause" TEXT,
    "correctiveActions" TEXT,
    "preventiveActions" TEXT,
    "actionDeadline" DATETIME,
    "actionResponsibleId" TEXT,
    "actionResponsibleName" TEXT,
    "photos" TEXT,
    "attachments" TEXT,
    "investigationReport" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "currentStepIndex" INTEGER DEFAULT 0,
    "currentStepId" TEXT,
    "flowId" TEXT,
    "workflowLogs" TEXT,
    "currentHandlerId" TEXT,
    "currentHandlerName" TEXT,
    "candidateHandlers" TEXT,
    "approvalMode" TEXT,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "reviewTime" DATETIME,
    "reviewComment" TEXT,
    "closerId" TEXT,
    "closerName" TEXT,
    "closeTime" DATETIME,
    "closeReason" TEXT,
    "ccDepts" TEXT,
    "ccUsers" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incident_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Incident_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "expectedEndDate" DATETIME,
    "isSpecialEquip" BOOLEAN NOT NULL DEFAULT false,
    "inspectionCycle" INTEGER,
    "lastInspection" DATETIME,
    "nextInspection" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArchiveFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "isDynamic" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "equipmentId" TEXT,
    "userId" TEXT,
    "uploaderId" TEXT,
    "uploaderName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArchiveFile_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArchiveConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
INSERT INTO "new_SignatureRecord" ("action", "clientInfo", "comment", "dataSnapshot", "dataSnapshotHash", "hazardId", "id", "incidentId", "permitId", "signedAt", "signerId", "signerName", "stepIndex", "stepName") SELECT "action", "clientInfo", "comment", "dataSnapshot", "dataSnapshotHash", "hazardId", "id", "incidentId", "permitId", "signedAt", "signerId", "signerName", "stepIndex", "stepName" FROM "SignatureRecord";
DROP TABLE "SignatureRecord";
ALTER TABLE "new_SignatureRecord" RENAME TO "SignatureRecord";
CREATE INDEX "SignatureRecord_permitId_idx" ON "SignatureRecord"("permitId");
CREATE INDEX "SignatureRecord_incidentId_idx" ON "SignatureRecord"("incidentId");
CREATE INDEX "SignatureRecord_hazardId_idx" ON "SignatureRecord"("hazardId");
CREATE INDEX "SignatureRecord_signerId_idx" ON "SignatureRecord"("signerId");
CREATE INDEX "SignatureRecord_signedAt_idx" ON "SignatureRecord"("signedAt");
CREATE INDEX "SignatureRecord_action_idx" ON "SignatureRecord"("action");
CREATE INDEX "SignatureRecord_permitId_stepIndex_idx" ON "SignatureRecord"("permitId", "stepIndex");
CREATE INDEX "SignatureRecord_incidentId_stepIndex_idx" ON "SignatureRecord"("incidentId", "stepIndex");
CREATE INDEX "SignatureRecord_hazardId_stepIndex_idx" ON "SignatureRecord"("hazardId", "stepIndex");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Incident_code_key" ON "Incident"("code");

-- CreateIndex
CREATE INDEX "Incident_type_idx" ON "Incident"("type");

-- CreateIndex
CREATE INDEX "Incident_severity_idx" ON "Incident"("severity");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "Incident_reporterId_idx" ON "Incident"("reporterId");

-- CreateIndex
CREATE INDEX "Incident_departmentId_idx" ON "Incident"("departmentId");

-- CreateIndex
CREATE INDEX "Incident_occurredAt_idx" ON "Incident"("occurredAt");

-- CreateIndex
CREATE INDEX "Incident_createdAt_idx" ON "Incident"("createdAt");

-- CreateIndex
CREATE INDEX "Incident_status_occurredAt_idx" ON "Incident"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "Incident_departmentId_occurredAt_idx" ON "Incident"("departmentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE INDEX "Equipment_isSpecialEquip_idx" ON "Equipment"("isSpecialEquip");

-- CreateIndex
CREATE INDEX "Equipment_nextInspection_idx" ON "Equipment"("nextInspection");

-- CreateIndex
CREATE INDEX "ArchiveFile_category_idx" ON "ArchiveFile"("category");

-- CreateIndex
CREATE INDEX "ArchiveFile_equipmentId_idx" ON "ArchiveFile"("equipmentId");

-- CreateIndex
CREATE INDEX "ArchiveFile_userId_idx" ON "ArchiveFile"("userId");

-- CreateIndex
CREATE INDEX "ArchiveFile_fileType_idx" ON "ArchiveFile"("fileType");

-- CreateIndex
CREATE INDEX "ArchiveFile_createdAt_idx" ON "ArchiveFile"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArchiveConfig_key_key" ON "ArchiveConfig"("key");
