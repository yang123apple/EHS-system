# 批处理脚本使用说明

## 📦 可用的批处理脚本

### 1️⃣ 恢复脚本

#### `restore-backup.bat` - 完整恢复工具 ⭐推荐

**功能：** 交互式数据恢复，包含完整的安全措施和错误处理

**使用方法：**
```batch
右键点击 → 以管理员身份运行
```

**特性：**
- ✅ 显示所有可用备份，支持选择
- ✅ 恢复前自动备份当前数据
- ✅ 详细的进度显示
- ✅ 数据库完整性验证
- ✅ 支持一键重启服务

**执行流程：**
```
1. 停止 Node.js 服务
2. 备份当前数据（安全措施）
3. 解压 ZIP 备份文件
4. 恢复数据库文件 (prisma/dev.db)
5. 恢复上传文件 (public/uploads)
6. 恢复其他数据文件
7. 验证数据库完整性
8. 重启服务（可选）
```

---

#### `restore-backup-quick.bat` - 快速恢复工具

**功能：** 简化的快速恢复，适合命令行使用

**使用方法：**

**方式一：使用最新备份**
```batch
restore-backup-quick.bat
```

**方式二：指定备份文件**
```batch
restore-backup-quick.bat backups\full_backup_2026-01-02.zip
```

**特性：**
- ✅ 快速执行，最少交互
- ✅ 自动选择最新备份
- ✅ 支持命令行参数
- ✅ 适合脚本自动化

**执行流程：**
```
1. 停止服务
2. 解压备份
3. 恢复数据库
4. 恢复上传文件
5. 清理临时文件
```

---

## 🚀 快速开始

### 场景 1：首次恢复

1. **以管理员身份运行完整恢复脚本**
   ```batch
   右键 restore-backup.bat → 以管理员身份运行
   ```

2. **选择要恢复的备份**
   ```
   可用的备份文件：
   --------------------------------
   [1] backups\full_backup_2026-01-02_08-30-00.zip
   [2] backups\full_backup_2026-01-01_08-30-00.zip
   [3] backups\full_backup_2025-12-31_08-30-00.zip
   --------------------------------
   
   请输入要恢复的备份编号 (1-3): 1
   ```

3. **确认恢复**
   ```
   警告：此操作将覆盖当前系统数据，是否继续？(yes/no): yes
   ```

4. **等待完成**
   - 自动执行所有步骤
   - 显示详细进度
   - 验证数据完整性

5. **启动服务**
   ```
   是否立即启动开发服务器？(yes/no): yes
   ```

---

### 场景 2：快速恢复最新备份

```batch
REM 直接运行快速恢复脚本
restore-backup-quick.bat

REM 确认使用最新备份
使用此备份？(Y/N): Y

REM 确认恢复
确认恢复？(yes): yes

REM 等待完成
[1/5] 停止服务...
[2/5] 解压备份...
[3/5] 恢复数据库...
[4/5] 恢复上传文件...
[5/5] 清理...
✓ 恢复完成！

REM 启动服务
启动服务？(Y/N): Y
```

---

### 场景 3：恢复特定备份

```batch
REM 指定要恢复的备份文件
restore-backup-quick.bat backups\full_backup_2025-12-31_08-30-00.zip

REM 按提示确认和操作
```

---

## ⚠️ 重要提示

### 必须条件

1. **管理员权限**
   - 必须以管理员身份运行
   - 用于停止进程和修改系统文件

2. **Node.js 环境**
   - 已安装 Node.js (14.x+)
   - 已安装项目依赖 (`npm install`)

3. **磁盘空间**
   - 至少备份文件大小的 2 倍可用空间
   - 用于解压和临时文件

### 安全建议

✅ **恢复前自动备份**
- 完整恢复脚本会自动备份当前数据
- 保存到 `backups\current_backup_before_restore_*.zip`
- 恢复失败时可以回滚

✅ **验证备份文件**
- 确认备份文件存在且完整
- 检查文件大小是否正常
- 建议使用最近的备份

✅ **停止所有服务**
- 脚本会自动停止 Node.js 进程
- 确保没有程序占用数据库文件
- 关闭所有打开的文件管理器

---

## 🔍 故障排查

### 错误 1：权限不足

**症状：** "请以管理员身份运行此脚本"

**解决：**
```batch
右键点击脚本 → 以管理员身份运行
```

---

### 错误 2：Node.js 未找到

**症状：** "未检测到 Node.js"

**解决：**
```batch
REM 检查安装
where node

REM 如果未安装，下载安装
https://nodejs.org/
```

---

### 错误 3：解压失败

**症状：** "解压失败"

**可能原因：**
- 备份文件损坏
- 磁盘空间不足
- unzipper 模块未安装

**解决：**
```batch
REM 检查备份文件
dir backups\*.zip

REM 安装 unzipper
npm install unzipper --save-dev

REM 检查磁盘空间
dir
```

---

### 错误 4：数据库文件被锁定

**症状：** "数据库文件覆盖失败"

**解决：**
```batch
REM 确认停止所有 Node.js 进程
tasklist | find "node.exe"

REM 强制终止
taskkill /F /IM node.exe /T

REM 等待后重试
timeout /t 5
```

---

### 错误 5：文件占用

**症状：** "uploads 目录删除失败"

**解决：**
- 关闭文件管理器
- 关闭图片查看器
- 暂时禁用杀毒软件
- 等待 5 秒后重试

---

## 📊 性能参考

### 恢复时间估算

| 备份大小 | 解压 | 数据库 | 文件复制 | 总计 |
|---------|------|--------|---------|------|
| < 100MB | 2秒 | 1秒 | 3秒 | ~6秒 |
| 100-500MB | 10秒 | 1秒 | 15秒 | ~26秒 |
| > 500MB | 30秒 | 2秒 | 60秒 | ~92秒 |

### 磁盘空间需求

```
所需空间 = 备份文件大小 × 2

示例：
备份文件: 200 MB
所需空间: 400 MB (200MB 备份 + 200MB 解压)
```

---

## 🎯 最佳实践

### 1. 定期测试恢复

```batch
REM 建议每月测试一次
REM 1. 选择测试环境
REM 2. 使用最近的备份
REM 3. 验证数据完整性
REM 4. 记录恢复时间
```

### 2. 保留多个版本

```
backups/
├── full_backup_2026-01-02.zip  (今天)
├── full_backup_2026-01-01.zip  (昨天)
├── full_backup_2025-12-31.zip  (前天)
└── ...保留最近 30 天
```

### 3. 异地备份

```batch
REM 定期复制到其他位置
xcopy /y backups\*.zip D:\Backup\

REM 或使用 robocopy
robocopy backups\ D:\Backup\ *.zip /MIR
```

### 4. 恢复后验证

**验证清单：**
- [ ] 用户登录正常
- [ ] 部门结构正确
- [ ] 隐患记录完整
- [ ] 上传文件可访问
- [ ] 数据库查询正常
- [ ] 系统功能正常

---

## 📁 文件结构

```
EHS-system/
├── restore-backup.bat          # 完整恢复脚本 ⭐
├── restore-backup-quick.bat    # 快速恢复脚本
├── RESTORE_BAT_GUIDE.md        # 详细使用指南
├── BATCH_SCRIPTS_README.md     # 本文件
├── backups/                    # 备份存储目录
│   ├── full_backup_2026-01-02_08-30-00.zip
│   ├── full_backup_2026-01-01_08-30-00.zip
│   └── current_backup_before_restore_*.zip
└── scripts/
    └── restore-backup.js       # Node.js 恢复脚本
```

---

## 🔗 相关文档

- **恢复详细指南**: `RESTORE_BAT_GUIDE.md`
- **备份快速参考**: `BACKUP_QUICK_REF.md`
- **备份完整指南**: `BACKUP_GUIDE.md`
- **WAL 模式说明**: `WAL_MODE_GUIDE.md`
- **数据保护服务**: `DATA_PROTECTION_SERVICE_V2.md`

---

## 📞 技术支持

### 日志位置

```
控制台输出 - 实时显示进度和错误
备份目录 - 查看历史备份文件
```

### 常用检查命令

```batch
REM 检查 Node.js
node --version

REM 检查 npm 包
npm list unzipper

REM 检查进程
tasklist | find "node.exe"

REM 检查备份
dir backups\*.zip

REM 检查数据库
node -e "console.log(require('fs').statSync('prisma/dev.db'))"
```

---

## ✅ 总结

| 脚本 | 适用场景 | 优势 | 使用建议 |
|------|---------|------|---------|
| **restore-backup.bat** | 日常恢复 | 完整功能、安全保障 | ⭐首选 |
| **restore-backup-quick.bat** | 快速恢复 | 简单快捷、自动化 | 熟悉后使用 |

**推荐工作流：**
1. 首次使用 → `restore-backup.bat`（完整版）
2. 熟悉流程后 → `restore-backup-quick.bat`（快速版）
3. 自动化脚本 → `node scripts/restore-backup.js`（Node.js 版）

**安全提醒：**
- ✅ 始终以管理员身份运行
- ✅ 恢复前自动备份当前数据
- ✅ 验证备份文件完整性
- ✅ 恢复后验证系统功能

---

🎉 现在您可以快速、安全地恢复 EHS 系统数据了！
