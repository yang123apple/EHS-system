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

-- CreateIndex
CREATE UNIQUE INDEX "HazardCandidateHandler_hazardId_userId_stepIndex_key" ON "HazardCandidateHandler"("hazardId", "userId", "stepIndex");

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
CREATE UNIQUE INDEX "HazardCC_hazardId_userId_key" ON "HazardCC"("hazardId", "userId");

-- CreateIndex
CREATE INDEX "HazardCC_hazardId_idx" ON "HazardCC"("hazardId");

-- CreateIndex
CREATE INDEX "HazardCC_userId_idx" ON "HazardCC"("userId");

-- CreateIndex
CREATE INDEX "HazardCC_hazardId_userId_idx" ON "HazardCC"("hazardId", "userId");
