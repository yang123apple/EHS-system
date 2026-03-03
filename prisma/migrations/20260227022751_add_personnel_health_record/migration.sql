-- CreateTable
CREATE TABLE "PersonnelHealthRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "hazardFactors" TEXT,
    "requirePeriodicExam" BOOLEAN NOT NULL DEFAULT false,
    "lastExamDate" DATETIME,
    "examCycle" INTEGER,
    "nextExamDate" DATETIME,
    "lastExamReminderAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelHealthRecord_userId_key" ON "PersonnelHealthRecord"("userId");

-- CreateIndex
CREATE INDEX "PersonnelHealthRecord_userId_idx" ON "PersonnelHealthRecord"("userId");

-- CreateIndex
CREATE INDEX "PersonnelHealthRecord_requirePeriodicExam_nextExamDate_idx" ON "PersonnelHealthRecord"("requirePeriodicExam", "nextExamDate");
