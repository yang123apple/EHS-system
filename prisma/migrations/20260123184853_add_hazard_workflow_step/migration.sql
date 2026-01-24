-- CreateTable
CREATE TABLE "HazardWorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hazardId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "stepId" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "handlerUserIds" TEXT NOT NULL,
    "handlerUserNames" TEXT NOT NULL,
    "matchedBy" TEXT,
    "ccUserIds" TEXT,
    "ccUserNames" TEXT,
    "approvalMode" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HazardWorkflowStep_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HazardRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "HazardWorkflowStep_hazardId_idx" ON "HazardWorkflowStep"("hazardId");

-- CreateIndex
CREATE INDEX "HazardWorkflowStep_stepIndex_idx" ON "HazardWorkflowStep"("stepIndex");

-- CreateIndex
CREATE INDEX "HazardWorkflowStep_hazardId_stepIndex_idx" ON "HazardWorkflowStep"("hazardId", "stepIndex");

-- CreateIndex
CREATE UNIQUE INDEX "HazardWorkflowStep_hazardId_stepIndex_key" ON "HazardWorkflowStep"("hazardId", "stepIndex");
