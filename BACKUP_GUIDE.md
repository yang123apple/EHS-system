# EHS 系统备份与恢复指南

## 概述

EHS 系统提供完整的全量备份和恢复功能，包括：
- ✅ SQLite 数据库文件
- ✅ 用户上传文件（avatars、docs 等）
- ✅ 配置文件（.env 脱敏备份）

## 备份功能

### 手动执行全量备份

```bash
npm run backup:full
```

或直接运行脚本：

```bash
node scripts/auto-backup.js
```

### 备份流程

1. **数据库预处理**：执行 `PRAGMA wal_checkpoint(FULL)` 确保数据完全落盘
2. **创建 ZIP 压缩包**：
   - 数据库文件：`prisma/dev.db`
   - 上传文件：`public/uploads/*`
   - 配置文件：`.env` (敏感信息已脱敏)
3. **自动清理**：删除 30 天前的旧备份文件

### 备份文件位置

```
data/backups/full_backup_YYYY-MM-DD_HH-mm-ss.zip
```

例如：`full_backup_2025-01-02_14-30-00.zip`

### 备份输出信息

```
🚀 EHS 系统全量备份任务
============================================================
⏰ 开始时间: 2025/1/2 14:30:00

📋 步骤 1/3: 数据库预处理
✓ 数据库 WAL checkpoint 完成

📋 步骤 2/3: 创建全量备份
📦 创建备份 ZIP: full_backup_2025-01-02_14-30-00.zip
  + 添加数据库: dev.db (2.5 MB)
  + 添加上传文件: 45 个文件 (15.8 MB)
  + 添加配置文件: .env.backup (脱敏)
✓ 备份完成
  文件: data/backups/full_backup_2025-01-02_14-30-00.zip
  大小: 18.3 MB (压缩后)
  耗时: 3.2 秒
  包含: 47 个文件

📋 步骤 3/3: 清理旧备份
✓ 没有需要清理的旧备份

🎉 全量备份任务完成！
```

## 恢复功能

### 查看可用的备份文件

```bash
npm run restore:full
```

或：

```bash
node scripts/restore-backup.js
```

输出示例：

```
📋 可用的备份文件:

  1. full_backup_2025-01-02_14-30-00.zip
     大小: 18.3 MB
     时间: 2025/1/2 14:30:00

  2. full_backup_2025-01-01_10-00-00.zip
     大小: 17.8 MB
     时间: 2025/1/1 10:00:00
```

### 恢复指定备份

```bash
npm run restore:full full_backup_2025-01-02_14-30-00.zip
```

或：

```bash
node scripts/restore-backup.js full_backup_2025-01-02_14-30-00.zip
```

### 恢复流程

1. **确认操作**：需要输入 `yes` 确认（会覆盖当前数据）
2. **解压备份文件**：提取所有文件到临时目录
3. **恢复数据库**：
   - 备份当前数据库到 `prisma/dev.db.before_restore_<timestamp>`
   - 覆盖为备份的数据库文件
4. **恢复上传文件**：
   - 备份当前上传目录到 `public/uploads.before_restore_<timestamp>`
   - 覆盖为备份的上传文件
5. **清理临时文件**

### 恢复后的重要步骤

⚠️ **必须重启应用程序**以使用恢复的数据！

```bash
# 停止当前服务
Ctrl + C

# 重启开发服务器
npm run dev
```

## 自动化备份

### 设置定时任务（Windows）

使用 Windows 任务计划程序：

1. 打开"任务计划程序"
2. 创建基本任务
3. 触发器：每天凌晨 2:00
4. 操作：启动程序
   - 程序：`node`
   - 参数：`C:\path\to\EHS-system\scripts\auto-backup.js`
   - 起始于：`C:\path\to\EHS-system`

### 设置定时任务（Linux/Mac）

使用 cron：

```bash
# 编辑 crontab
crontab -e

# 添加定时任务（每天凌晨 2:00 执行）
0 2 * * * cd /path/to/EHS-system && /usr/bin/node scripts/auto-backup.js >> logs/backup.log 2>&1
```

## 备份策略建议

### 1. 定期备份
- **每日备份**：每天凌晨自动执行
- **手动备份**：重大操作前（如系统升级、批量导入等）

### 2. 异地备份
- 定期将 `data/backups/` 目录复制到其他存储位置
- 建议使用云存储或外部硬盘

### 3. 备份验证
- 定期测试恢复流程，确保备份文件可用
- 检查备份文件大小是否异常

### 4. 保留策略
- 系统自动保留最近 30 天的备份
- 重要的备份可手动复制到其他位置永久保存

## 故障排查

### 备份失败

**问题**：数据库 WAL checkpoint 失败
```
⚠ WAL checkpoint 失败 (可能不是 WAL 模式)
```
**解决**：这是警告而非错误，不影响备份。SQLite 可能未启用 WAL 模式。

**问题**：磁盘空间不足
```
❌ 备份任务失败: ENOSPC: no space left on device
```
**解决**：清理磁盘空间或删除旧备份文件。

### 恢复失败

**问题**：备份文件损坏
```
❌ 解压失败: invalid zip file
```
**解决**：尝试使用其他备份文件。

**问题**：权限不足
```
❌ 恢复失败: EACCES: permission denied
```
**解决**：确保有足够的文件系统权限。

## 技术细节

### 备份文件结构

```
full_backup_YYYY-MM-DD_HH-mm-ss.zip
├── dev.db                    # SQLite 数据库
├── uploads/                  # 上传文件目录
│   ├── avatars/             # 用户头像
│   ├── docs/                # 文档文件
│   └── ...
└── .env.backup              # 配置文件（脱敏）
```

### 使用的依赖

- **archiver** (`^7.0.1`)：创建 ZIP 压缩包
- **unzipper** (`^0.12.3`)：解压 ZIP 文件
- **@prisma/client**：数据库 checkpoint 操作

### 性能指标

典型系统的备份性能：
- 数据库大小：~3 MB
- 上传文件：~50 个文件，~20 MB
- 压缩后大小：~15 MB
- 备份耗时：~3-5 秒
- 恢复耗时：~2-3 秒

## 安全建议

1. **备份文件安全**：
   - 备份文件包含敏感数据，应妥善保管
   - 不要将备份文件提交到版本控制系统
   - `.env.backup` 已脱敏敏感信息，但仍需谨慎处理

2. **访问控制**：
   - 限制 `data/backups/` 目录的访问权限
   - 定期审计备份文件的访问记录

3. **加密建议**：
   - 对于特别敏感的环境，考虑对备份文件进行加密
   - 可使用 7zip 或 GPG 等工具二次加密

## 相关命令

```bash
# 创建全量备份
npm run backup:full

# 查看可用备份
npm run restore:full

# 恢复指定备份
npm run restore:full <备份文件名>

# 旧的 JSON 导出（已废弃，建议使用全量备份）
npm run db:export
npm run db:import
```

## 更新日志

### v2.0 - 2025-01-02
- ✅ 实现全量备份功能（数据库 + 文件）
- ✅ 实现恢复功能
- ✅ 自动清理 30 天前的旧备份
- ✅ 数据库 WAL checkpoint
- ✅ 配置文件脱敏备份
- ✅ 详细的日志输出和进度提示

---

如有问题或建议，请联系系统管理员。
