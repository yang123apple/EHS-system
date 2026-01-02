# 备份恢复批处理脚本使用指南

## 📋 脚本概述

提供两个批处理脚本用于快速恢复系统数据：

### 1. `restore-backup.bat` - 完整恢复脚本 ⭐推荐

**功能特点：**
- ✅ 交互式界面，显示所有可用备份
- ✅ 恢复前自动备份当前数据（安全措施）
- ✅ 详细的进度显示和错误处理
- ✅ 数据库完整性验证
- ✅ 支持中文路径和大文件

**适用场景：**
- 首次使用恢复功能
- 需要从多个备份中选择
- 需要详细的操作日志

### 2. `restore-backup-quick.bat` - 快速恢复脚本

**功能特点：**
- ✅ 命令行参数支持
- ✅ 简化流程，快速执行
- ✅ 自动使用最新备份（无参数时）
- ✅ 适合自动化脚本调用

**适用场景：**
- 熟悉恢复流程的用户
- 需要快速恢复最新备份
- 脚本自动化调用

---

## 🚀 使用方法

### 方式一：完整恢复（推荐）

1. **以管理员身份运行**
   ```
   右键点击 restore-backup.bat → 以管理员身份运行
   ```

2. **选择备份文件**
   - 脚本会列出所有可用的备份文件
   - 输入编号选择要恢复的备份
   - 或输入完整文件路径

3. **确认恢复**
   ```
   警告：此操作将覆盖当前系统数据，是否继续？(yes/no): yes
   ```

4. **等待完成**
   - 自动执行所有恢复步骤
   - 显示详细进度信息
   - 完成后提示是否启动服务

### 方式二：快速恢复

**使用最新备份：**
```batch
restore-backup-quick.bat
```

**指定备份文件：**
```batch
restore-backup-quick.bat backups\full_backup_2026-01-02_08-30-00.zip
```

---

## 📝 恢复流程详解

### 完整恢复脚本 (`restore-backup.bat`)

```
步骤 0: 准备恢复环境
├── 检查管理员权限
├── 检查 Node.js 安装
├── 检查 unzipper 模块
├── 列出可用备份文件
└── 用户选择和确认

步骤 1: 停止 Node.js 服务
├── 查找运行中的 node.exe 进程
├── 强制终止所有 Node.js 进程
└── 等待文件句柄释放

步骤 2: 备份当前数据（安全措施）
├── 创建当前数据快照
├── 压缩 dev.db 和 uploads
└── 保存到 backups\current_backup_before_restore_*.zip

步骤 3: 解压备份文件
├── 创建临时解压目录
├── 使用 unzipper 解压 ZIP 文件
├── 验证解压内容完整性
└── 检查 database.db 是否存在

步骤 4: 恢复数据库文件
├── 删除旧的 WAL 和 SHM 文件
├── 覆盖 prisma\dev.db
├── 恢复 WAL 文件（如果存在）
└── 恢复 SHM 文件（如果存在）

步骤 5: 恢复上传文件
├── 删除现有 public\uploads 目录
├── 复制备份的 uploads 目录
├── 统计恢复的文件数量
└── 创建空目录（如果备份中无 uploads）

步骤 6: 恢复其他数据文件
├── 恢复 data 目录下的 JSON 文件
├── 恢复 Prisma schema（可选）
└── 清理临时文件

步骤 7: 验证和重启
├── 验证数据库完整性
├── 显示恢复摘要
├── 询问是否启动服务
└── 启动开发服务器（可选）
```

---

## ⚙️ 技术实现细节

### 1. 停止服务

```batch
REM 查找并终止所有 Node.js 进程
tasklist /FI "IMAGENAME eq node.exe" | find /I "node.exe"
taskkill /F /IM node.exe /T
timeout /t 2 /nobreak
```

**说明：**
- `/F` - 强制终止
- `/IM` - 按映像名称（进程名）
- `/T` - 终止子进程

### 2. 解压 ZIP 文件

```batch
REM 使用 Node.js unzipper 模块（支持中文和大文件）
node -e "
  const unzipper = require('unzipper');
  const fs = require('fs');
  fs.createReadStream('backup.zip')
    .pipe(unzipper.Extract({path: 'temp_restore'}))
    .on('close', () => process.exit(0));
"
```

**优点：**
- ✅ 支持中文路径
- ✅ 支持大文件（>4GB）
- ✅ 跨平台兼容
- ✅ 不依赖外部工具

### 3. 覆盖数据库

```batch
REM 删除 WAL 和 SHM 文件（避免数据不一致）
del /f /q prisma\dev.db-wal
del /f /q prisma\dev.db-shm

REM 覆盖主数据库文件
copy /y temp_restore\database.db prisma\dev.db
```

**为什么要删除 WAL/SHM：**
- WAL 文件包含未合并的写操作
- 恢复旧数据库时，旧的 WAL 会导致数据不一致
- 必须删除后再覆盖主数据库

### 4. 覆盖上传文件

```batch
REM 删除现有目录
rmdir /s /q public\uploads

REM 复制备份的文件
xcopy /e /i /y /q temp_restore\uploads public\uploads
```

**参数说明：**
- `/e` - 复制所有子目录（包括空目录）
- `/i` - 目标是目录
- `/y` - 不提示确认覆盖
- `/q` - 安静模式（不显示文件名）

### 5. 重启服务

```batch
REM 在新窗口启动开发服务器
start "EHS System" cmd /k "npm run dev"
```

**说明：**
- `start` - 启动新进程
- `"EHS System"` - 窗口标题
- `/k` - 执行命令后保持窗口开启

---

## 🔍 错误处理

### 常见错误及解决方案

#### 1. "请以管理员身份运行此脚本"

**原因：** 脚本需要管理员权限来终止进程和修改文件

**解决：** 右键点击脚本 → 以管理员身份运行

#### 2. "未检测到 Node.js"

**原因：** 系统未安装 Node.js 或不在 PATH 中

**解决：**
```batch
REM 检查 Node.js 安装
where node

REM 如果未安装，从官网下载安装
REM https://nodejs.org/
```

#### 3. "unzipper 模块未安装"

**原因：** 缺少解压依赖

**解决：** 脚本会自动尝试安装，或手动执行：
```batch
npm install unzipper --save-dev
```

#### 4. "解压失败"

**可能原因：**
- 备份文件损坏
- 磁盘空间不足
- 文件权限问题

**解决：**
```batch
REM 检查磁盘空间
dir

REM 验证备份文件
node -e "const fs=require('fs');console.log(fs.statSync('backup.zip'));"

REM 尝试手动解压测试
node scripts/restore-backup.js [备份文件]
```

#### 5. "数据库文件覆盖失败"

**原因：** 数据库文件被锁定（服务未完全停止）

**解决：**
```batch
REM 再次确认没有 Node.js 进程
tasklist | find "node.exe"

REM 强制终止
taskkill /F /IM node.exe /T

REM 等待 5 秒后重试
timeout /t 5
```

#### 6. "uploads 目录删除失败"

**原因：** 文件被占用（可能是杀毒软件或文件管理器）

**解决：**
```batch
REM 关闭可能占用文件的程序
REM - 文件管理器
REM - 图片查看器
REM - 杀毒软件

REM 等待后重试
timeout /t 5
rmdir /s /q public\uploads
```

---

## 🛡️ 安全措施

### 1. 恢复前自动备份

```batch
REM 完整恢复脚本会自动创建当前数据快照
backups\current_backup_before_restore_2026-01-02_12-30-45.zip
```

**内容：**
- 当前的 `dev.db` 数据库
- 当前的 `public/uploads` 文件
- 时间戳文件名（防止覆盖）

**用途：**
- 恢复失败时可以回滚
- 对比恢复前后数据
- 作为额外的安全备份

### 2. 数据完整性验证

```batch
REM 恢复完成后验证数据库
node -e "
  const {PrismaClient} = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.$queryRaw\`SELECT COUNT(*) FROM User\`
    .then(result => {
      console.log('✓ 数据库验证通过');
      prisma.$disconnect();
    });
"
```

### 3. 用户确认机制

```batch
REM 需要明确输入 "yes" 才能继续
set /p confirm="警告：此操作将覆盖当前系统数据，是否继续？(yes/no): "
if /i not "%confirm%"=="yes" exit /b 0
```

---

## 📊 性能和限制

### 性能指标

| 操作 | 小备份 (<100MB) | 中备份 (100-500MB) | 大备份 (>500MB) |
|------|----------------|-------------------|----------------|
| 解压时间 | ~2 秒 | ~10 秒 | ~30 秒 |
| 数据库覆盖 | <1 秒 | <1 秒 | ~2 秒 |
| 文件复制 | ~3 秒 | ~15 秒 | ~60 秒 |
| **总耗时** | **~6 秒** | **~26 秒** | **~92 秒** |

### 系统要求

- ✅ Windows 7 及以上
- ✅ Node.js 14.x 及以上
- ✅ 管理员权限
- ✅ 磁盘空间 ≥ 备份文件大小 × 2（用于解压）

### 限制

- ❌ 不支持网络驱动器备份文件
- ❌ 不支持同时运行多个恢复脚本
- ❌ 文件路径长度不能超过 260 字符（Windows 限制）

---

## 🎯 最佳实践

### 1. 定期测试恢复流程

```batch
REM 每月测试一次恢复流程
REM 1. 使用测试环境
REM 2. 选择最近的备份
REM 3. 验证数据完整性
REM 4. 记录恢复时间
```

### 2. 保留多个备份版本

```
backups/
├── full_backup_2026-01-02_08-00-00.zip  (最新)
├── full_backup_2026-01-01_08-00-00.zip  (昨天)
├── full_backup_2025-12-31_08-00-00.zip  (前天)
└── ...
```

### 3. 异地备份

```batch
REM 定期复制备份到其他位置
xcopy /y backups\*.zip D:\EHS-Backups\
robocopy backups\ \\NAS\EHS-Backups\ *.zip /MIR
```

### 4. 验证恢复后的系统

**数据验证清单：**
- [ ] 用户能正常登录
- [ ] 部门结构显示正确
- [ ] 隐患记录完整
- [ ] 上传文件可访问
- [ ] 培训记录存在
- [ ] 工作票据显示正常

---

## 📞 故障排查检查清单

遇到问题时，按顺序检查：

```
□ 1. 是否以管理员身份运行？
□ 2. Node.js 是否正确安装？
□ 3. 备份文件是否存在且完整？
□ 4. 磁盘空间是否充足（至少 2GB 可用）？
□ 5. 所有 Node.js 进程是否已停止？
□ 6. 是否有杀毒软件阻止文件操作？
□ 7. 文件路径是否包含特殊字符？
□ 8. unzipper 模块是否已安装？
□ 9. 数据库文件是否被其他程序占用？
□ 10. 是否有足够的文件系统权限？
```

---

## 🔗 相关资源

- **备份创建**: `npm run backup` 或 `node scripts/auto-backup.js`
- **JavaScript 恢复脚本**: `node scripts/restore-backup.js`
- **WAL 模式文档**: `WAL_MODE_GUIDE.md`
- **备份快速参考**: `BACKUP_QUICK_REF.md`
- **数据保护服务文档**: `DATA_PROTECTION_SERVICE_V2.md`

---

## 📄 附录：脚本源码说明

### 关键变量

```batch
BACKUP_FILE     - 要恢复的备份文件路径
TEMP_DIR        - 临时解压目录
CURRENT_BACKUP  - 当前数据的安全备份文件名
```

### 关键函数

| 操作 | 实现方式 |
|------|----------|
| 停止服务 | `taskkill /F /IM node.exe` |
| 解压备份 | `node -e unzipper.Extract()` |
| 复制文件 | `copy /y source dest` |
| 复制目录 | `xcopy /e /i /y /q source dest` |
| 删除目录 | `rmdir /s /q directory` |
| 启动服务 | `start cmd /k npm run dev` |

---

## ✅ 总结

两个批处理脚本提供了灵活的恢复方案：

- **完整版** (`restore-backup.bat`)
  - 适合日常使用
  - 交互式界面
  - 完善的错误处理
  - 自动安全备份

- **快速版** (`restore-backup-quick.bat`)
  - 适合快速恢复
  - 支持命令行参数
  - 简化流程
  - 适合自动化

**推荐使用完整版进行恢复操作**，除非您熟悉恢复流程且需要快速执行。
