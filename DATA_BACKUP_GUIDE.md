# 核心数据备份与恢复指南

## 概述

本系统已从JSON文件存储迁移到Prisma数据库。为了保护核心数据（组织架构和用户数据）不受损坏，我们提供了**双向同步机制**：

- **数据库 → JSON文件**：导出备份
- **JSON文件 → 数据库**：导入恢复

## 核心数据文件

### 1. `data/org.json` - 组织架构数据
包含所有部门信息，包括：
- 部门ID、名称
- 层级关系（parentId, level）
- 部门负责人（managerId）

### 2. `data/users.json` - 用户账号数据
包含所有用户信息，包括：
- 用户ID、用户名、密码
- 姓名、头像
- 角色、职位
- 所属部门、直属上级
- 权限配置

### 3. `data/backups/` - 自动备份目录
每次执行导出时自动创建带时间戳的备份文件。

## 数据备份（导出）

### 方式一：使用npm脚本（推荐）

```bash
npm run db:export
# 或
npm run db:backup
```

### 方式二：直接运行脚本

```bash
node scripts/export-to-json.js
```

### 导出结果

- 更新 `data/org.json` 和 `data/users.json`
- 在 `data/backups/` 创建时间戳备份文件
  - `org-YYYY-MM-DDTHH-mm-ss.json`
  - `users-YYYY-MM-DDTHH-mm-ss.json`

## 数据恢复（导入）

### 方式一：使用npm脚本（推荐）

```bash
npm run db:import
```

### 方式二：直接运行脚本

```bash
node scripts/import-from-json.js
```

### 导入模式

脚本会询问您选择导入模式：

1. **清空后导入** (y/yes)
   - 删除数据库中所有现有的部门和用户数据
   - 完全按照JSON文件重建数据
   - **谨慎使用！**

2. **合并导入** (N/默认)
   - 保留数据库现有数据
   - 根据ID匹配，存在则更新，不存在则创建
   - **推荐使用**

## 数据安全最佳实践

### 1. 定期备份

建议在以下情况下执行备份：

- ✅ 修改组织架构前
- ✅ 批量导入用户前
- ✅ 系统升级前
- ✅ 每周定期备份
- ✅ 重要变更后

### 2. 备份频率建议

```bash
# 每周自动备份（可添加到cron或任务计划）
npm run db:backup
```

### 3. 验证数据完整性

导出后检查：
```bash
# 查看部门数量
grep -c "\"id\"" data/org.json

# 查看用户数量  
grep -c "\"username\"" data/users.json
```

### 4. 保护备份文件

- 将 `data/` 目录添加到版本控制（已在.gitignore中配置）
- 定期将备份文件复制到安全位置
- 敏感环境建议加密备份文件

## 故障恢复流程

### 场景1：数据库数据丢失

```bash
# 1. 确认JSON文件存在且完整
ls -lh data/org.json data/users.json

# 2. 从JSON恢复到数据库
npm run db:import
# 选择 'y' 清空后导入，或 'N' 合并导入

# 3. 验证恢复结果
node scripts/check-users.js
```

### 场景2：误操作需要回滚

```bash
# 1. 找到最近的备份文件
ls -lt data/backups/

# 2. 恢复备份文件到主文件
cp data/backups/org-YYYY-MM-DDTHH-mm-ss.json data/org.json
cp data/backups/users-YYYY-MM-DDTHH-mm-ss.json data/users.json

# 3. 导入到数据库
npm run db:import
```

### 场景3：JSON文件损坏

```bash
# 1. 从数据库重新导出
npm run db:export

# 2. 检查导出文件
cat data/org.json | json_pp
cat data/users.json | json_pp
```

## 数据迁移流程

### 从旧系统迁移

1. **准备JSON文件**
   - 确保 `data/org.json` 和 `data/users.json` 格式正确
   - 验证部门ID和用户departmentId的对应关系

2. **执行导入**
   ```bash
   npm run db:import
   ```

3. **验证数据**
   ```bash
   node scripts/check-users.js
   ```

## 数据文件格式

### org.json 格式示例

```json
[
  {
    "id": "dept001",
    "name": "公司",
    "parentId": null,
    "level": 0,
    "managerId": "user001"
  },
  {
    "id": "dept002",
    "name": "技术部",
    "parentId": "dept001",
    "level": 1,
    "managerId": "user002"
  }
]
```

### users.json 格式示例

```json
[
  {
    "id": "user001",
    "username": "admin",
    "name": "系统管理员",
    "password": "admin123",
    "avatar": "/image/default_avatar.jpg",
    "role": "admin",
    "departmentId": "dept001",
    "department": "公司",
    "jobTitle": "总经理",
    "directManagerId": null,
    "permissions": {
      "work_permit": {...},
      "hidden_danger": {...}
    }
  }
]
```

## 注意事项

### ⚠️ 重要警告

1. **备份前操作**
   - 所有重要操作前先执行 `npm run db:backup`
   - 确认备份成功后再进行操作

2. **导入模式选择**
   - 首次导入或完全重置：选择 'y'（清空后导入）
   - 日常恢复或合并数据：选择 'N'（合并导入）

3. **权限问题**
   - 确保scripts目录下的文件有执行权限
   - Windows系统直接使用 `node scripts/xxx.js`

4. **数据一致性**
   - 导入前确保部门ID在org.json中存在
   - 用户的departmentId必须对应有效的部门

5. **密码安全**
   - users.json包含明文密码，注意文件权限
   - 生产环境建议加密存储

## 定期维护

### 每周任务
```bash
# 1. 导出备份
npm run db:backup

# 2. 清理旧备份（保留最近30天）
find data/backups/ -name "*.json" -mtime +30 -delete
```

### 每月任务
```bash
# 1. 验证数据完整性
npm run db:export
node scripts/check-users.js

# 2. 归档重要备份到安全位置
# 将data/backups/复制到云存储或外部硬盘
```

## 故障排查

### 问题1：导入失败 - 部门ID不存在

**症状**：用户导入时提示部门ID不存在

**解决**：
```bash
# 检查org.json中是否有该部门
grep "dept_id" data/org.json
```

### 问题2：导出后文件为空

**症状**：导出的JSON文件内容为空数组

**原因**：数据库中没有数据

**解决**：
```bash
# 检查数据库连接
npx prisma studio

# 检查数据
node scripts/check-users.js
```

### 问题3：权限错误

**症状**：无法读取或写入文件

**解决**：
```bash
# Linux/Mac
chmod +x scripts/*.js
chmod 644 data/*.json

# Windows - 以管理员身份运行命令行
```

## 技术支持

如遇到问题，请检查：
1. 数据库连接配置（.env文件）
2. Prisma客户端版本
3. Node.js版本（建议v18+）
4. 文件权限设置

---

**最后更新**: 2025-12-29  
**维护者**: EHS系统开发团队
