/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `WorkPermitRecord` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "WorkPermitRecord" ADD COLUMN "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "WorkPermitRecord_code_key" ON "WorkPermitRecord"("code");
