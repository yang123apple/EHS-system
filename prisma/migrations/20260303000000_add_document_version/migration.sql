-- AlterTable: 为 Document 表增加 version 字段，默认值为 '1.0'
ALTER TABLE "Document" ADD COLUMN "version" TEXT DEFAULT '1.0';

-- 将现有文档全部设为 1.0 版本
UPDATE "Document" SET "version" = '1.0' WHERE "version" IS NULL;

-- AlterTable: 为 DocumentHistory 表增加 revisionDate 和 version 字段
ALTER TABLE "DocumentHistory" ADD COLUMN "revisionDate" TEXT;
ALTER TABLE "DocumentHistory" ADD COLUMN "version" TEXT;

-- 将现有 DocumentHistory 记录的 revisionDate 设为 createdAt 的日期部分
UPDATE "DocumentHistory" SET "revisionDate" = strftime('%Y-%m-%d', "createdAt") WHERE "revisionDate" IS NULL;
