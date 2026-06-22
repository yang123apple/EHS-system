-- AlterTable: 为 Document 表增加 toc 字段，存储目录结构 JSON
ALTER TABLE "Document" ADD COLUMN "toc" TEXT;
