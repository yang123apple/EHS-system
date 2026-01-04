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

-- CreateIndex
CREATE INDEX "AIApiRateLimit_userId_idx" ON "AIApiRateLimit"("userId");

-- CreateIndex
CREATE INDEX "AIApiRateLimit_departmentId_idx" ON "AIApiRateLimit"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AIApiRateLimit_userId_departmentId_key" ON "AIApiRateLimit"("userId", "departmentId");
