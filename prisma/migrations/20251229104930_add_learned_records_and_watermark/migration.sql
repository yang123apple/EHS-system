-- CreateTable
CREATE TABLE "MaterialLearnedRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "materialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "learnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialLearnedRecord_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "TrainingMaterial" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MaterialLearnedRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLearnedRecord_materialId_userId_key" ON "MaterialLearnedRecord"("materialId", "userId");
