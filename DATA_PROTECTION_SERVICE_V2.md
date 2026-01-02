# DataProtectionService v2.0 更新说明

## 📋 更新概述

已成功将 `src/services/dataProtection.service.ts` 升级为 v2.0，适配新的 ZIP 全量备份策略。

---

## 🔄 主要变更

### 1. 废弃的功能
以下基于 JSON 的部分备份/恢复逻辑已被移除：

- ❌ `checkAndRestore()` - 启动时检查数据完整性
- ❌ `autoRestore()` - 从 JSON 自动恢复
- ❌ `hasValidJsonFiles()` - 检查 JSON 文件有效性
- ❌ `getLatestBackup()` - 获取最新 JSON 备份
- ❌ `restoreFromJson()` - 从 JSON 恢复到数据库

**原因**：新策略采用整库还原（完整的 SQLite 数据库文件恢复），不再使用部分数据恢复。

---

### 2. 新增的功能

#### ✅ `getBackupsList(): Promise<BackupInfo[]>`
**功能**：扫描 `data/backups/` 目录，返回所有 ZIP 备份文件的列表

**返回数据**：
```typescript
interface BackupInfo {
  filename: string;        // 文件名
  filepath: string;        // 完整路径
  sizeBytes: number;       // 字节大小
  sizeMB: number;          // MB 大小
  createdAt: Date;         // 创建时间
  age: string;             // 年龄描述（如 "2 小时前"）
}
```

**示例**：
```typescript
const service = DataProtectionService.getInstance();
const backups = await service.getBackupsList();

// 输出：
// [
//   {
//     filename: "full_backup_2026-01-02_12-21-42.zip",
//     filepath: "/path/to/data/backups/full_backup_2026-01-02_12-21-42.zip",
//     sizeBytes: 18123456,
//     sizeMB: 17.29,
//     createdAt: Date(...),
//     age: "2 小时前"
//   },
//   ...
// ]
```

---

#### ✅ `verifyBackup(filename: string): Promise<VerificationResult>`
**功能**：验证指定 ZIP 备份文件的有效性

**检查项**：
- 文件是否存在
- 文件大小是否为 0
- 是否是 .zip 文件

**返回数据**：
```typescript
interface VerificationResult {
  valid: boolean;          // 是否有效
  message: string;         // 验证消息
  details?: {
    exists: boolean;       // 文件是否存在
    sizeBytes: number;     // 文件大小（字节）
    sizeMB: number;        // 文件大小（MB）
    createdAt?: Date;      // 创建时间
  };
}
```

**示例**：
```typescript
const verification = await service.verifyBackup('full_backup_2026-01-02_12-21-42.zip');

// 有效文件输出：
// {
//   valid: true,
//   message: "备份文件有效",
//   details: {
//     exists: true,
//     sizeBytes: 18123456,
//     sizeMB: 17.29,
//     createdAt: Date(...)
//   }
// }

// 无效文件输出：
// {
//   valid: false,
//   message: "备份文件不存在",
//   details: { exists: false, sizeBytes: 0, sizeMB: 0 }
// }
```

---

### 3. 修改的功能

#### 🔄 `performDailyBackup(): Promise<void>`
**变更**：调用 `scripts/auto-backup.js` 中的全量备份功能

**之前**：导出 JSON 文件
```javascript
// 旧逻辑
await exportToJson('org.json');
await exportToJson('users.json');
```

**现在**：调用全量备份脚本
```javascript
// 新逻辑
const { autoBackup } = require('scripts/auto-backup.js');
await autoBackup();
```

**输出**：
- SQLite 数据库文件
- 用户上传文件
- 配置文件（脱敏）
- 所有打包为一个 ZIP 文件

---

#### 🔄 `manualBackup(): Promise<Result>`
**变更**：返回更详细的备份信息

**之前**：
```typescript
{ success: boolean; message: string }
```

**现在**：
```typescript
{ 
  success: boolean; 
  message: string;
  backupFile?: string;  // 新增：备份文件名
}
```

---

#### 🔄 `getBackupStatus(): Promise<Status>`
**变更**：返回更全面的状态信息

**之前**：
```typescript
{
  hasMainFiles: boolean;
  latestBackup: string | null;
  backupCount: number;
  databaseStatus: { departments: number; users: number };
}
```

**现在**：
```typescript
{
  backupCount: number;
  latestBackup: BackupInfo | null;     // 详细的备份信息对象
  oldestBackup: BackupInfo | null;     // 新增：最旧备份
  totalSizeMB: number;                  // 新增：总大小
  databaseStatus: { 
    departments: number; 
    users: number;
    hazards?: number;                   // 新增：隐患数
    trainings?: number;                 // 新增：培训数
  };
}
```

---

## 🆕 新增 API 端点

### 1. `GET /api/backup`
获取备份列表或状态

**查询参数**：
- `action=status` - 获取备份状态

**示例**：
```bash
# 获取备份列表
curl http://localhost:3000/api/backup

# 获取备份状态
curl http://localhost:3000/api/backup?action=status
```

**响应**：
```json
{
  "success": true,
  "data": [
    {
      "filename": "full_backup_2026-01-02_12-21-42.zip",
      "sizeBytes": 18123456,
      "sizeMB": 17.29,
      "createdAt": "2026-01-02T12:21:42.000Z",
      "age": "2 小时前"
    }
  ]
}
```

---

### 2. `POST /api/backup`
执行手动备份

**示例**：
```bash
curl -X POST http://localhost:3000/api/backup
```

**响应**：
```json
{
  "success": true,
  "message": "全量备份成功",
  "backupFile": "full_backup_2026-01-02_14-30-00.zip"
}
```

---

### 3. `POST /api/backup/verify`
验证备份文件

**请求体**：
```json
{
  "filename": "full_backup_2026-01-02_12-21-42.zip"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "备份文件有效",
    "details": {
      "exists": true,
      "sizeBytes": 18123456,
      "sizeMB": 17.29,
      "createdAt": "2026-01-02T12:21:42.000Z"
    }
  }
}
```

---

## 🧪 测试

### 运行测试脚本
```bash
npm run backup:test
```

**测试内容**：
1. ✅ 获取备份列表
2. ✅ 验证最新备份
3. ✅ 获取系统状态
4. ✅ 验证不存在的文件

**示例输出**：
```
========================================
🧪 测试数据保护服务
========================================

📋 测试 1: 获取备份列表
----------------------------------------
找到 1 个备份文件:

  1. full_backup_2026-01-02_12-21-42.zip
     大小: 17.29 MB
     时间: 2026/1/2 20:21:43
     年龄: 2 小时前

🔍 测试 2: 验证最新备份
----------------------------------------
文件: full_backup_2026-01-02_12-21-42.zip
验证结果: ✅ 有效
消息: 备份文件有效
详情:
  - 存在: 是
  - 大小: 17.29 MB
  - 创建: 2026/1/2 20:21:43

📊 测试 3: 获取系统状态
----------------------------------------
备份统计:
  - 备份数量: 1
  - 总大小: 17.29 MB
  - 最新备份: full_backup_2026-01-02_12-21-42.zip
  - 备份时间: 2026/1/2 20:21:43

数据库统计:
  - 部门: 15
  - 用户: 42
  - 隐患: 123
  - 培训: 8

✅ 所有测试完成！
```

---

## 📚 使用示例

### 在代码中使用服务

```typescript
import { DataProtectionService } from '@/services/dataProtection.service';

// 获取服务实例
const service = DataProtectionService.getInstance();

// 1. 获取备份列表
const backups = await service.getBackupsList();
console.log(`共有 ${backups.length} 个备份`);

// 2. 验证备份
const verification = await service.verifyBackup('full_backup_2026-01-02_12-21-42.zip');
if (verification.valid) {
  console.log('✅ 备份有效');
} else {
  console.log('❌ 备份无效:', verification.message);
}

// 3. 手动备份
const result = await service.manualBackup();
if (result.success) {
  console.log('✅ 备份成功:', result.backupFile);
}

// 4. 获取状态
const status = await service.getBackupStatus();
console.log('备份数量:', status.backupCount);
console.log('数据库记录:', status.databaseStatus);
```

---

## 🔐 兼容性说明

### 旧 JSON 备份文件
- **位置**：`data/backups/org_*.json` 和 `users_*.json`
- **状态**：不再使用，但保留在磁盘上
- **建议**：可以手动删除，或保留作为历史记录

### 数据恢复
- **新方式**：使用 `npm run restore:full <备份文件>`
- **说明**：恢复整个数据库文件，而不是部分数据

---

## 📝 迁移检查清单

- [x] 更新 `dataProtection.service.ts`
- [x] 移除旧的 JSON 恢复逻辑
- [x] 添加 ZIP 备份管理功能
- [x] 创建新的 API 端点
- [x] 更新 `performDailyBackup()` 调用全量备份
- [x] 添加测试脚本
- [x] 更新文档

---

## 🎯 后续建议

1. **清理旧备份**：删除 `data/backups/` 中的 `*.json` 文件
2. **测试恢复**：在测试环境验证完整的备份恢复流程
3. **监控备份**：设置监控确保每日备份正常执行
4. **异地存储**：定期将备份文件复制到外部存储

---

**更新日期**：2026-01-02  
**版本**：v2.0  
**状态**：✅ 已完成并测试
