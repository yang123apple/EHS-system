# 备份与恢复脚本使用指南

## 📋 概述

本系统提供了两套功能对等的跨平台备份与恢复脚本：

- **`ops.sh`** - 适用于 Linux/macOS (Bash)
- **`ops.ps1`** - 适用于 Windows (PowerShell)

这两个脚本提供完整的数据库和 MinIO 文件备份与恢复功能。

## 🚀 快速开始

### Linux/macOS

```bash
# 执行备份
./ops.sh backup

# 交互式恢复
./ops.sh restore

# 列出所有备份
./ops.sh list
```

### Windows

```powershell
# 执行备份
.\ops.ps1 backup

# 交互式恢复
.\ops.ps1 restore

# 列出所有备份
.\ops.ps1 list
```

## 📦 功能特性

### 备份功能

1. **数据库备份**
   - ✅ 执行数据库完整性检查（`PRAGMA integrity_check`）
   - ✅ 使用 SQLite 热备份（`.backup` 命令，不停止服务）
   - ✅ 自动备份 WAL 和 SHM 文件
   - ✅ 自动压缩备份文件（节省空间）

2. **MinIO 文件备份**
   - ✅ 自动配置 MinIO Client alias
   - ✅ 使用 `mc mirror` 进行增量同步
   - ✅ 支持多个 Bucket（`ehs-private`, `ehs-public`）

3. **自动清理**
   - ✅ 自动删除超过保留期的旧备份（默认 30 天）

### 恢复功能

1. **交互式恢复流程**
   - ✅ 列出所有可用备份时间点
   - ✅ 用户选择要恢复的时间点
   - ✅ 二次确认机制（防止误操作）
   - ✅ 自动备份当前数据（恢复前）

2. **数据库恢复**
   - ✅ 支持压缩和未压缩的备份文件
   - ✅ 自动清理旧的 WAL/SHM 文件
   - ✅ 恢复失败时自动回滚

3. **MinIO 恢复**
   - ✅ 使用 `mc mirror --overwrite` 反向同步
   - ✅ 支持多个 Bucket 恢复

## ⚙️ 配置

### 环境变量

脚本会自动读取 `.env` 文件（如果存在），也可以通过环境变量配置：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DB_PATH` | SQLite 数据库路径 | `prisma/dev.db` |
| `MINIO_ENDPOINT` | MinIO 服务端点 | `localhost` |
| `MINIO_PORT` | MinIO 服务端口 | `9000` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | `admin` |
| `MINIO_SECRET_KEY` | MinIO 秘密密钥 | `change-me-now` |
| `BACKUP_ROOT` | 备份根目录 | `data/backups` |
| `RETENTION_DAYS` | 备份保留天数 | `30` |
| `LOG_FILE` | 日志文件路径 | `ops.log` |

### 示例 .env 配置

```env
# 数据库配置
DB_PATH=prisma/dev.db

# MinIO 配置
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=change-me-now

# 备份配置
BACKUP_ROOT=data/backups
RETENTION_DAYS=30
```

## 📁 备份目录结构

```
data/backups/
├── database/              # 数据库备份
│   ├── dev.db.backup_20240101_020000.gz
│   ├── dev.db.backup_20240102_020000.gz
│   └── ...
└── minio/                 # MinIO 文件备份
    ├── 20240101_020000/
    │   ├── ehs-private/
    │   └── ehs-public/
    └── 20240102_020000/
        ├── ehs-private/
        └── ehs-public/
```

## 🔧 依赖要求

### 必需工具

1. **sqlite3** - SQLite 命令行工具
   - Linux: `sudo apt-get install sqlite3`
   - macOS: `brew install sqlite3`
   - Windows: `choco install sqlite` 或从 [官网下载](https://www.sqlite.org/download.html)

2. **mc** - MinIO Client
   - Linux: 
     ```bash
     wget https://dl.min.io/client/mc/release/linux-amd64/mc
     chmod +x mc && sudo mv mc /usr/local/bin/
     ```
   - macOS: `brew install minio/stable/mc`
   - Windows: `choco install minio-client` 或从 [官网下载](https://min.io/download#/windows)

### 验证安装

```bash
# Linux/macOS
sqlite3 --version
mc --version

# Windows
sqlite3 --version
mc --version
```

## 📅 定时任务设置

### Linux/macOS (Crontab)

编辑 crontab：

```bash
crontab -e
```

添加以下行（每天凌晨 2:00 执行备份）：

```cron
0 2 * * * cd /path/to/ehs-system1.0 && ./ops.sh backup >> ops.log 2>&1
```

或者使用更详细的配置：

```cron
# 每天凌晨 2:00 执行备份
0 2 * * * cd /path/to/ehs-system1.0 && /bin/bash ./ops.sh backup >> ops.log 2>&1

# 每周日凌晨 3:00 执行备份并发送邮件通知
0 3 * * 0 cd /path/to/ehs-system1.0 && ./ops.sh backup && mail -s "EHS Backup Completed" admin@example.com < ops.log
```

### Windows (任务计划程序)

1. 打开"任务计划程序"（Task Scheduler）

2. 创建基本任务：
   - 名称：`EHS System Backup`
   - 触发器：每天，时间：02:00
   - 操作：启动程序
     - 程序：`powershell.exe`
     - 参数：`-ExecutionPolicy Bypass -File "C:\path\to\ehs-system1.0\ops.ps1" backup`
     - 起始于：`C:\path\to\ehs-system1.0`

3. 高级设置：
   - ✅ 以最高权限运行
   - ✅ 不管用户是否登录都要运行
   - ✅ 配置：Windows 10/11

### Windows (PowerShell 脚本方式)

创建 `schedule-backup.ps1`：

```powershell
# 创建定时任务（每天凌晨 2:00）
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -File `"$PSScriptRoot\ops.ps1`" backup"

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType S4U -RunLevel Highest

Register-ScheduledTask -TaskName "EHS System Backup" `
    -Action $action -Trigger $trigger -Principal $principal `
    -Description "EHS 系统自动备份任务"
```

运行脚本：

```powershell
.\schedule-backup.ps1
```

## 🔍 日志记录

所有操作都会记录到 `ops.log` 文件中，包含：

- 时间戳
- 操作级别（INFO/SUCCESS/WARNING/ERROR）
- 详细消息

查看日志：

```bash
# Linux/macOS
tail -f ops.log

# Windows
Get-Content ops.log -Wait -Tail 50
```

## ⚠️ 注意事项

### 备份时

1. **数据库完整性**：脚本会在备份前执行完整性检查，确保数据库未损坏
2. **热备份**：使用 SQLite 的 `.backup` 命令，无需停止服务
3. **增量同步**：MinIO 使用 `mc mirror`，只同步变化的文件

### 恢复时

1. **停止服务**：恢复前**必须**停止 Next.js 应用，否则可能导致数据损坏
2. **二次确认**：恢复操作需要输入 `YES` 确认，防止误操作
3. **自动备份**：恢复前会自动备份当前数据到 `.before_restore_*` 文件
4. **清理 WAL/SHM**：恢复后会自动清理旧的 WAL 和 SHM 文件

### 最佳实践

1. **定期测试恢复**：定期测试恢复流程，确保备份可用
2. **监控备份**：设置监控，确保定时任务正常运行
3. **异地备份**：考虑将备份同步到远程存储（如 S3、云盘等）
4. **版本控制**：重要恢复前，建议先创建 Git 提交点

## 🐛 故障排查

### MinIO 连接失败

```bash
# 检查 MinIO 服务状态
docker ps | grep minio

# 启动 MinIO 服务
docker-compose -f docker-compose.minio.yml up -d

# 测试连接
mc admin info ehs-minio
```

### 数据库备份失败

```bash
# 检查数据库文件是否存在
ls -lh prisma/dev.db

# 手动执行完整性检查
sqlite3 prisma/dev.db "PRAGMA integrity_check;"

# 检查磁盘空间
df -h
```

### 权限问题

```bash
# Linux/macOS: 确保脚本有执行权限
chmod +x ops.sh

# 确保备份目录可写
chmod -R 755 data/backups
```

## 📞 支持

如遇问题，请检查：

1. `ops.log` 日志文件
2. 依赖工具是否正确安装
3. 环境变量配置是否正确
4. MinIO 服务是否正常运行

---

**版本**: 1.0.0  
**最后更新**: 2024-01-01

