-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrainingMaterial" (
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
INSERT INTO "new_TrainingMaterial" ("category", "convertedUrl", "createdAt", "description", "duration", "id", "isExamRequired", "isPublic", "passingScore", "thumbnail", "title", "type", "updatedAt", "uploaderId", "url") SELECT "category", "convertedUrl", "createdAt", "description", "duration", "id", "isExamRequired", "isPublic", "passingScore", "thumbnail", "title", "type", "updatedAt", "uploaderId", "url" FROM "TrainingMaterial";
DROP TABLE "TrainingMaterial";
ALTER TABLE "new_TrainingMaterial" RENAME TO "TrainingMaterial";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
