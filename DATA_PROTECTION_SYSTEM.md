# 核心数据保护系统

## 概述

为保护核心数据（组织架构和用户账号），系统实现了完整的自动备份和恢复机制。

## 核心功能

### 1. 启动时数据完整性检查
- ✅ 服务器启动时自动检查核心数据
- ✅ 检测部门和用户数据是否存在
- ✅ 数据缺失时自动恢复

### 2. 自动恢复机制
优先级顺序：
1. 从主JSON文件恢复（data/org.json 和 data/users.json）
2. 从最新备份恢复（data/backups/）
3. 无可用数据时报错提示

### 3. 每日自动备份
- ⏰ 每天凌晨2点自动执行备份
- 📦 导出数据库到JSON文件
- 💾 更新主JSON文件
- 📅 创建带时间戳的备份副本

### 4. 自动清理旧备份
- 🗑️ 自动删除30天前的备份
- 💾 保留足够的历史数据用于恢复
- 🔄 备份时自动执行清理

## 文件结构

```
data/
├── org.json                    # 组织架构主文件
├── users.json                  # 用户账号主文件
└── backups/                    # 备份目录
    ├── org_2024-12-29T02:00:00.000Z.json
    ├── users_2024-12-29T02:00:00.000Z.json
    ├── org_2024-12-28T02:00:00.000Z.json
    └── users_2024-12-28T02:00:00.000Z.json
```

## 技术实现

### 核心服务类
**DataProtectionService** (`src/services/dataProtection.service.ts`)
- 单例模式，确保全局唯一实例
- 管理数据检查、恢复和备份
- 处理定时任务调度

主要方法：
```typescript
// 检查并恢复数据
async checkAndRestore(): Promise<void>

// 启动每日备份任务
async startDailyBackupSchedule(): Promise<void>

// 手动触发备份
async manualBackup(): Promise<{ success: boolean; message: string }>

// 获取备份状态
async getBackupStatus(): Promise<BackupStatus>
```

### 启动初始化
**启动脚本** (`src/lib/startup.ts`)
```typescript
export async function initializeApp() {
  // 1. 检查核心数据完整性
  await dataProtection.checkAndRestore();
  
  // 2. 启动每日备份任务
  await dataProtection.startDailyBackupSchedule();
}
```

**Instrumentation Hook** (`src/instrumentation.ts`)
- Next.js在服务器启动时自动调用
- 仅在Node.js运行时执行
- 初始化失败不会中断服务器启动

### API接口

#### 1. 初始化API
```
GET /api/init
```
返回：
```json
{
  "success": true,
  "message": "应用初始化完成"
}
```

#### 2. 数据保护状态API
```
GET /api/data-protection
```
返回：
```json
{
  "success": true,
  "data": {
    "hasMainFiles": true,
    "latestBackup": "2024-12-29T02:00:00.000Z",
    "backupCount": 15,
    "databaseStatus": {
      "departments": 18,
      "users": 68
    }
  }
}
```

#### 3. 手动备份API
```
POST /api/data-protection
Content-Type: application/json

{
  "action": "backup"
}
```
返回：
```json
{
  "success": true,
  "message": "手动备份成功"
}
```

### 备份脚本
**auto-backup.js** (`scripts/auto-backup.js`)
- 导出部门和用户数据
- 更新主JSON文件（带UTF-8 BOM）
- 创建带时间戳的备份
- 清理30天前的旧备份

## 运行流程

### 服务器启动流程
```
1. Next.js 启动
   ↓
2. 调用 instrumentation.ts
   ↓
3. 执行 initializeApp()
   ↓
4. DataProtectionService.checkAndRestore()
   ├─→ 检查数据库：部门 & 用户数量
   ├─→ 如果为空：自动恢复
   │   ├─→ 优先从 data/org.json 和 data/users.json
   │   └─→ 其次从最新备份恢复
   └─→ 数据完整：继续
   ↓
5. DataProtectionService.startDailyBackupSchedule()
   ├─→ 计算到凌晨2点的时间
   ├─→ 设置首次备份定时器
   └─→ 启动每日循环任务
   ↓
6. 应用就绪 ✅
```

### 每日备份流程
```
每天凌晨 02:00
   ↓
1. 执行 performDailyBackup()
   ↓
2. 调用 scripts/auto-backup.js
   ↓
3. 从数据库导出数据
   ├─→ SELECT * FROM departments
   └─→ SELECT * FROM users
   ↓
4. 更新主JSON文件
   ├─→ data/org.json (带UTF-8 BOM)
   └─→ data/users.json (带UTF-8 BOM)
   ↓
5. 创建备份副本
   ├─→ data/backups/org_[timestamp].json
   └─→ data/backups/users_[timestamp].json
   ↓
6. 清理旧备份
   └─→ 删除30天前的备份文件
   ↓
7. 完成 ✅
```

## 控制台输出示例

### 启动时输出
```
========================================
🚀 正在初始化应用程序...
========================================
📊 检查核心数据完整性...
   - 部门数量: 18
   - 用户数量: 68
✅ 核心数据完整
⏰ 启动每日自动备份任务...
   - 首次备份时间: 2024/12/30 凌晨02:00:00
   - 距离首次备份: 865 分钟
✅ 每日备份任务已启动
========================================
✅ 应用初始化完成
========================================
```

### 数据恢复时输出
```
========================================
🚀 正在初始化应用程序...
========================================
📊 检查核心数据完整性...
   - 部门数量: 0
   - 用户数量: 0
⚠️  检测到核心数据缺失！
🔄 开始自动恢复...
📂 从主JSON文件恢复...
   - 准备恢复 18 个部门
   - 准备恢复 68 个用户
✅ 数据恢复完成
✅ 从主JSON文件恢复成功
⏰ 启动每日自动备份任务...
   - 首次备份时间: 2024/12/30 凌晨02:00:00
   - 距离首次备份: 865 分钟
✅ 每日备份任务已启动
========================================
✅ 应用初始化完成
========================================
```

### 每日备份输出
```
========================================
🔄 开始执行每日备份 [2024/12/29 凌晨02:00:00]
========================================
导出组织架构数据...
导出 18 个部门
保存到: c:\Users\...\data\org.json
创建备份: data/backups/org_2024-12-29T02:00:00.000Z.json

导出用户数据...
导出 68 个用户
保存到: c:\Users\...\data\users.json
创建备份: data/backups/users_2024-12-29T02:00:00.000Z.json

清理旧备份...
删除旧备份: data/backups/org_2024-11-29T02:00:00.000Z.json
删除旧备份: data/backups/users_2024-11-29T02:00:00.000Z.json
清理完成

✅ 备份成功完成
✅ 每日备份完成
========================================
```

## 手动操作

### 使用npm命令

```bash
# 导出数据库到JSON（同时创建备份）
npm run db:export

# 从JSON导入到数据库
npm run db:import

# 创建备份（同db:export）
npm run db:backup

# 从Git历史恢复数据
npm run db:restore
```

### 手动触发备份（通过API）

```bash
# 使用curl
curl -X POST http://localhost:3000/api/data-protection \
  -H "Content-Type: application/json" \
  -d '{"action":"backup"}'

# 或在浏览器开发者工具中
fetch('/api/data-protection', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'backup' })
}).then(r => r.json()).then(console.log)
```

### 查看备份状态

```bash
# 使用curl
curl http://localhost:3000/api/data-protection

# 或在浏览器中访问
http://localhost:3000/api/data-protection
```

## 数据安全保证

1. **多层备份**：主文件 + 每日备份 + Git版本控制
2. **自动恢复**：启动时检查，发现缺失立即恢复
3. **UTF-8 BOM编码**：确保中文数据正确显示
4. **事务保护**：使用Prisma事务确保数据一致性
5. **定时清理**：避免备份文件无限增长

## 故障处理

### 场景1：数据库完全清空
**自动处理**：
- 启动时检测到数据为空
- 自动从 data/org.json 和 data/users.json 恢复
- 如果主文件损坏，从最新备份恢复

### 场景2：主JSON文件损坏
**自动处理**：
- 检测到主文件无效
- 自动从最新备份恢复
- 恢复后更新主文件

### 场景3：所有备份丢失
**手动处理**：
```bash
# 使用Git历史恢复
npm run db:restore
```

### 场景4：备份任务失败
**系统行为**：
- 错误记录到控制台
- 不影响服务器运行
- 下次定时任务继续尝试

## 维护建议

1. **定期检查备份**：确保备份目录有足够磁盘空间
2. **监控日志**：关注每日备份的控制台输出
3. **定期测试恢复**：验证备份数据可用性
4. **Git提交**：定期提交data/目录到Git
5. **外部备份**：考虑将data/目录备份到云存储

## 相关文档

- [DATA_BACKUP_GUIDE.md](./DATA_BACKUP_GUIDE.md) - 详细的备份恢复指南
- [scripts/auto-backup.js](./scripts/auto-backup.js) - 自动备份脚本
- [src/services/dataProtection.service.ts](./src/services/dataProtection.service.ts) - 数据保护服务
