-- AlterTable
ALTER TABLE "Project" ADD COLUMN "attachments" TEXT;
ALTER TABLE "Project" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "WorkPermitRecord" ADD COLUMN "parsedFieldValues" TEXT;

-- AlterTable
ALTER TABLE "WorkPermitTemplate" ADD COLUMN "parsedFields" TEXT;
