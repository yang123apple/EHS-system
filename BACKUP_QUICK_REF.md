# 🚀 EHS 系统备份恢复 - 快速参考

## 📦 备份命令

```bash
# 执行全量备份（推荐）
npm run backup:full

# 输出：data/backups/full_backup_YYYY-MM-DD_HH-mm-ss.zip
```

**备份内容：**
- ✅ SQLite 数据库 (`prisma/dev.db`)
- ✅ 用户上传文件 (`public/uploads/*`)
- ✅ 配置文件 (`.env` 脱敏版)
- ✅ 数据文件 (`data/*.json`)
- ✅ Prisma schema

**自动清理：** 30 天前的备份会自动删除

---

## 🔄 恢复命令

```bash
# 1. 查看可用备份
npm run restore:full

# 2. 恢复指定备份
npm run restore:full full_backup_2026-01-02_12-21-42.zip
```

**恢复流程：**
1. 确认操作（输入 `yes`）
2. 自动备份当前数据（防止误操作）
3. 解压并覆盖文件
4. ⚠️ **必须重启应用**

---

## ⚡ 使用场景

| 场景 | 操作 |
|------|------|
| 🔧 重大升级前 | `npm run backup:full` |
| 📥 批量导入前 | `npm run backup:full` |
| 🔄 每日定时 | 设置 Windows 任务计划 / Cron |
| 🆘 数据损坏恢复 | `npm run restore:full <文件名>` |
| 📋 迁移系统 | 复制 ZIP 到新服务器后恢复 |

---

## 📂 文件位置

```
EHS-system/
├── data/backups/                 # 备份存储目录
│   └── full_backup_*.zip        # 备份文件
├── prisma/
│   ├── dev.db                    # 当前数据库
│   └── dev.db.before_restore_*  # 恢复前的数据库备份
└── public/
    ├── uploads/                  # 当前上传文件
    └── uploads.before_restore_* # 恢复前的上传文件备份
```

---

## 🔐 安全提示

- ⚠️ 备份文件包含敏感数据，妥善保管
- 📤 定期将 `data/backups/` 复制到异地存储
- 🔒 不要将备份文件提交到 Git
- ✅ 定期测试恢复流程

---

## 📞 故障排查

**备份失败？**
- 检查磁盘空间
- 确认文件权限

**恢复失败？**
- 确认备份文件未损坏
- 检查目标目录权限
- 尝试其他备份文件

---

**详细文档：** 参见 `BACKUP_GUIDE.md`
