-- CreateTable
CREATE TABLE "CheckType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckType_value_key" ON "CheckType"("value");

-- CreateIndex
CREATE INDEX "CheckType_isActive_idx" ON "CheckType"("isActive");

-- CreateIndex
CREATE INDEX "CheckType_sortOrder_idx" ON "CheckType"("sortOrder");

-- Insert default check types
INSERT INTO "CheckType" ("id", "name", "value", "description", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
('ckt_daily', '日常检查', 'daily', '日常安全检查', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ckt_special', '专项检查', 'special', '针对特定风险的专项检查', 2, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ckt_monthly', '月度检查', 'monthly', '每月定期安全检查', 3, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ckt_preholiday', '节前检查', 'pre-holiday', '节假日前的安全检查', 4, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ckt_self', '员工自查', 'self', '员工自主安全检查', 5, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('ckt_other', '其他检查', 'other', '其他类型的安全检查', 6, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
