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

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_name_key" ON "NotificationTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AIApiConfig_name_key" ON "AIApiConfig"("name");
