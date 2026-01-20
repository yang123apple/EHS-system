#!/bin/bash

# 修复剩余文件中的旧日志服务引用

echo "修复 hazardExtension.service.ts..."
sed -i '' 's/import { SystemLogService } from.*systemLog.service.*/import AuditService from '"'"'@\/services\/audit.service'"'"';\nimport { LogModule } from '"'"'@\/types\/audit'"'"';/' src/services/hazardExtension.service.ts

echo "修复 incident.service.ts..."
sed -i '' 's/import { SystemLogService } from.*systemLog.service.*/import AuditService from '"'"'@\/services\/audit.service'"'"';\nimport { LogModule } from '"'"'@\/types\/audit'"'"';/' src/services/incident.service.ts

echo "修复 utils/activityLogger.ts..."
sed -i '' 's/import { SystemLogService, SystemLogData, FieldChange } from.*systemLog.service.*/import AuditService from '"'"'@\/services\/audit.service'"'"';\nimport { LogModule, LogAction } from '"'"'@\/types\/audit'"'"';/' src/utils/activityLogger.ts

echo "✅ 所有文件已修复"
