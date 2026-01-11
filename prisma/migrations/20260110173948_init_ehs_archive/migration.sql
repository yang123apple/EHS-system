-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#blue',
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Document" (
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
INSERT INTO "new_Document" ("createdAt", "dept", "docxPath", "fullNum", "id", "level", "name", "parentId", "pdfPath", "prefix", "searchText", "suffix", "type", "updatedAt", "uploadTime", "uploader") SELECT "createdAt", "dept", "docxPath", "fullNum", "id", "level", "name", "parentId", "pdfPath", "prefix", "searchText", "suffix", "type", "updatedAt", "uploadTime", "uploader" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_DocumentTags_AB_unique" ON "_DocumentTags"("A", "B");

-- CreateIndex
CREATE INDEX "_DocumentTags_B_index" ON "_DocumentTags"("B");
