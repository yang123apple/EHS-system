-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractNo" TEXT,
    "location" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "requestDept" TEXT NOT NULL,
    "requestHead" TEXT NOT NULL,
    "requestContact" TEXT NOT NULL,
    "mgmtDept" TEXT,
    "mgmtHead" TEXT,
    "mgmtContact" TEXT,
    "supplierName" TEXT NOT NULL,
    "supplierHead" TEXT NOT NULL,
    "supplierContact" TEXT NOT NULL,
    "attachments" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkPermitTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "structureJson" TEXT NOT NULL,
    "workflowConfig" TEXT,
    "parsedFields" TEXT,
    "level" TEXT NOT NULL DEFAULT 'primary',
    "sectionBindings" TEXT,
    "orientation" TEXT NOT NULL DEFAULT 'portrait',
    "mobileFormConfig" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "isDynamicLog" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkPermitRecord" (
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
    "candidateHandlers" TEXT,
    "approvalMode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskLevel" TEXT,
    "workType" TEXT,
    "location" TEXT,
    "applicantId" TEXT,
    "applicantName" TEXT,
    "applicantDept" TEXT,
    "workDate" DATETIME,
    "workStartTime" DATETIME,
    "workEndTime" DATETIME,
    "supervisorId" TEXT,
    "supervisorName" TEXT,
    CONSTRAINT "WorkPermitRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkPermitRecord_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkPermitTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '/image/default_avatar.jpg',
    "role" TEXT NOT NULL DEFAULT 'user',
    "departmentId" TEXT,
    "jobTitle" TEXT,
    "directManagerId" TEXT,
    "permissions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HazardRecord" (
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
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "voidedAt" DATETIME,
    "voidedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HazardRecord_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HazardRecord_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "HazardCandidateHandler" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hazardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepId" TEXT,
    "hasOperated" BOOLEAN NOT NULL DEFAULT false,
    "operatedAt" DATETIME,
    "opinion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HazardCandidateHandler_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HazardRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HazardCC" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hazardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HazardCC_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HazardRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HazardVisibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hazardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HazardVisibility_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HazardRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HazardConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "docxPath" TEXT,
    "pdfPath" TEXT,
    "prefix" TEXT,
    "suffix" INTEGER,
    "fullNum" TEXT,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "dept" TEXT,
    "uploader" TEXT,
    "uploadTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchText" TEXT,
    "archiveCategory" TEXT,
    "expiryDate" DATETIME,
    "warningDays" INTEGER NOT NULL DEFAULT 30,
    "entityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#blue',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DocumentHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "uploader" TEXT,
    "uploadTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemLog" (
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

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrainingMaterial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "url" TEXT NOT NULL,
    "convertedUrl" TEXT,
    "thumbnail" TEXT,
    "duration" INTEGER,
    "isExamRequired" BOOLEAN NOT NULL DEFAULT false,
    "passingScore" INTEGER,
    "examMode" TEXT NOT NULL DEFAULT 'standard',
    "randomQuestionCount" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "uploaderId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingMaterial_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamQuestion_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "TrainingMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "materialId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetConfig" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingTask_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "TrainingMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrainingTask_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutoAssignRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "eventType" TEXT,
    "condition" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutoAssignRule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TrainingTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "examScore" INTEGER,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TrainingTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialLearnedRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "learnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialLearnedRecord_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "TrainingMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialLearnedRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "triggerCondition" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "variables" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIApiConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "model" TEXT,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 1000,
    "rateLimitPerDay" INTEGER NOT NULL DEFAULT 50000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AIApiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "requestBy" TEXT,
    "requestSource" TEXT,
    "requestPayload" TEXT,
    "responsePayload" TEXT,
    "tokens" INTEGER,
    "duration" INTEGER,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIApiLog_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AIApiConfig" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIApiRateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "departmentId" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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

-- CreateTable
CREATE TABLE "CheckType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_DocumentTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DocumentTags_A_fkey" FOREIGN KEY ("A") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DocumentTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPermitRecord_code_key" ON "WorkPermitRecord"("code");

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

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "HazardRecord_code_key" ON "HazardRecord"("code");

-- CreateIndex
CREATE INDEX "HazardRecord_isVoided_idx" ON "HazardRecord"("isVoided");

-- CreateIndex
CREATE INDEX "HazardRecord_voidedAt_idx" ON "HazardRecord"("voidedAt");

-- CreateIndex
CREATE INDEX "HazardExtension_hazardId_idx" ON "HazardExtension"("hazardId");

-- CreateIndex
CREATE INDEX "HazardExtension_applicantId_idx" ON "HazardExtension"("applicantId");

-- CreateIndex
CREATE INDEX "HazardExtension_approverId_idx" ON "HazardExtension"("approverId");

-- CreateIndex
CREATE INDEX "HazardExtension_status_idx" ON "HazardExtension"("status");

-- CreateIndex
CREATE INDEX "HazardExtension_createdAt_idx" ON "HazardExtension"("createdAt");

-- CreateIndex
CREATE INDEX "HazardCandidateHandler_hazardId_idx" ON "HazardCandidateHandler"("hazardId");

-- CreateIndex
CREATE INDEX "HazardCandidateHandler_userId_idx" ON "HazardCandidateHandler"("userId");

-- CreateIndex
CREATE INDEX "HazardCandidateHandler_stepIndex_idx" ON "HazardCandidateHandler"("stepIndex");

-- CreateIndex
CREATE INDEX "HazardCandidateHandler_hasOperated_idx" ON "HazardCandidateHandler"("hasOperated");

-- CreateIndex
CREATE INDEX "HazardCandidateHandler_hazardId_stepIndex_idx" ON "HazardCandidateHandler"("hazardId", "stepIndex");

-- CreateIndex
CREATE INDEX "HazardCandidateHandler_userId_hasOperated_idx" ON "HazardCandidateHandler"("userId", "hasOperated");

-- CreateIndex
CREATE UNIQUE INDEX "HazardCandidateHandler_hazardId_userId_stepIndex_key" ON "HazardCandidateHandler"("hazardId", "userId", "stepIndex");

-- CreateIndex
CREATE INDEX "HazardCC_hazardId_idx" ON "HazardCC"("hazardId");

-- CreateIndex
CREATE INDEX "HazardCC_userId_idx" ON "HazardCC"("userId");

-- CreateIndex
CREATE INDEX "HazardCC_hazardId_userId_idx" ON "HazardCC"("hazardId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HazardCC_hazardId_userId_key" ON "HazardCC"("hazardId", "userId");

-- CreateIndex
CREATE INDEX "HazardVisibility_userId_hazardId_idx" ON "HazardVisibility"("userId", "hazardId");

-- CreateIndex
CREATE INDEX "HazardVisibility_hazardId_idx" ON "HazardVisibility"("hazardId");

-- CreateIndex
CREATE INDEX "HazardVisibility_role_idx" ON "HazardVisibility"("role");

-- CreateIndex
CREATE INDEX "HazardVisibility_userId_role_idx" ON "HazardVisibility"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "HazardVisibility_userId_hazardId_role_key" ON "HazardVisibility"("userId", "hazardId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "HazardConfig_key_key" ON "HazardConfig"("key");

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
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "SystemLog_userId_idx" ON "SystemLog"("userId");

-- CreateIndex
CREATE INDEX "SystemLog_module_idx" ON "SystemLog"("module");

-- CreateIndex
CREATE INDEX "SystemLog_action_idx" ON "SystemLog"("action");

-- CreateIndex
CREATE INDEX "SystemLog_targetType_idx" ON "SystemLog"("targetType");

-- CreateIndex
CREATE INDEX "SystemLog_targetId_idx" ON "SystemLog"("targetId");

-- CreateIndex
CREATE INDEX "SystemLog_businessCode_idx" ON "SystemLog"("businessCode");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_module_targetId_idx" ON "SystemLog"("module", "targetId");

-- CreateIndex
CREATE INDEX "SystemLog_userId_createdAt_idx" ON "SystemLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssignment_taskId_userId_key" ON "TrainingAssignment"("taskId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLearnedRecord_materialId_userId_key" ON "MaterialLearnedRecord"("materialId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_name_key" ON "NotificationTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AIApiConfig_name_key" ON "AIApiConfig"("name");

-- CreateIndex
CREATE INDEX "AIApiRateLimit_userId_idx" ON "AIApiRateLimit"("userId");

-- CreateIndex
CREATE INDEX "AIApiRateLimit_departmentId_idx" ON "AIApiRateLimit"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AIApiRateLimit_userId_departmentId_key" ON "AIApiRateLimit"("userId", "departmentId");

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
CREATE INDEX "SignatureRecord_incidentId_idx" ON "SignatureRecord"("incidentId");

-- CreateIndex
CREATE INDEX "SignatureRecord_hazardId_idx" ON "SignatureRecord"("hazardId");

-- CreateIndex
CREATE INDEX "SignatureRecord_signerId_idx" ON "SignatureRecord"("signerId");

-- CreateIndex
CREATE INDEX "SignatureRecord_signedAt_idx" ON "SignatureRecord"("signedAt");

-- CreateIndex
CREATE INDEX "SignatureRecord_action_idx" ON "SignatureRecord"("action");

-- CreateIndex
CREATE INDEX "SignatureRecord_permitId_stepIndex_idx" ON "SignatureRecord"("permitId", "stepIndex");

-- CreateIndex
CREATE INDEX "SignatureRecord_incidentId_stepIndex_idx" ON "SignatureRecord"("incidentId", "stepIndex");

-- CreateIndex
CREATE INDEX "SignatureRecord_hazardId_stepIndex_idx" ON "SignatureRecord"("hazardId", "stepIndex");

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

-- CreateIndex
CREATE UNIQUE INDEX "CheckType_value_key" ON "CheckType"("value");

-- CreateIndex
CREATE INDEX "CheckType_isActive_idx" ON "CheckType"("isActive");

-- CreateIndex
CREATE INDEX "CheckType_sortOrder_idx" ON "CheckType"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "_DocumentTags_AB_unique" ON "_DocumentTags"("A", "B");

-- CreateIndex
CREATE INDEX "_DocumentTags_B_index" ON "_DocumentTags"("B");
