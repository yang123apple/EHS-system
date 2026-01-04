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
