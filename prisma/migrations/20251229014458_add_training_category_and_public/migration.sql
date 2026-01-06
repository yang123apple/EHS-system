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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "rectifyRequirement" TEXT,
    "requireEmergencyPlan" BOOLEAN NOT NULL DEFAULT false,
    "emergencyPlanDeadline" DATETIME,
    "emergencyPlanContent" TEXT,
    "emergencyPlanSubmitTime" DATETIME,
    "ccDepts" TEXT,
    "ccUsers" TEXT,
    "logs" TEXT,
    "old_personal_ID" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HazardRecord_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HazardRecord_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "details" TEXT,
    "ip" TEXT,
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
    "duration" INTEGER,
    "isExamRequired" BOOLEAN NOT NULL DEFAULT false,
    "passingScore" INTEGER,
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

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPermitRecord_code_key" ON "WorkPermitRecord"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "HazardRecord_code_key" ON "HazardRecord"("code");

-- CreateIndex
CREATE UNIQUE INDEX "HazardConfig_key_key" ON "HazardConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingAssignment_taskId_userId_key" ON "TrainingAssignment"("taskId", "userId");
