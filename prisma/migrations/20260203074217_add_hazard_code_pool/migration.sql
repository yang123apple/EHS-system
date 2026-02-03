-- CreateTable
CREATE TABLE "HazardCodePool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "datePrefix" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "releasedBy" TEXT,
    "releasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" DATETIME,
    "usedBy" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "HazardCodePool_code_key" ON "HazardCodePool"("code");

-- CreateIndex
CREATE INDEX "HazardCodePool_status_idx" ON "HazardCodePool"("status");

-- CreateIndex
CREATE INDEX "HazardCodePool_datePrefix_status_idx" ON "HazardCodePool"("datePrefix", "status");

-- CreateIndex
CREATE INDEX "HazardCodePool_datePrefix_sequence_idx" ON "HazardCodePool"("datePrefix", "sequence");

-- CreateIndex
CREATE INDEX "HazardCodePool_expiresAt_idx" ON "HazardCodePool"("expiresAt");
