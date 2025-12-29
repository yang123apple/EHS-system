# Prisma 客户端缓存问题修复指南

## 问题描述
Prisma 客户端报错：`Unknown argument 'category'` 和 `Unknown argument 'isPublic'`

虽然这些字段在 `schema.prisma` 和数据库迁移中都存在，但 Prisma 客户端缓存过期导致无法识别。

## 根本原因
1. **数据库迁移已执行** - 字段已在数据库中（见 `prisma/migrations/20251229014458_add_training_category_and_public/migration.sql`）
2. **Schema 文件正确** - `prisma/schema.prisma` 包含这些字段
3. **Prisma 客户端缓存过期** - Next.js 开发服务器使用旧的 Prisma 客户端

## 已完成的修复步骤

### 1. ✅ 清理 Next.js 缓存
```bash
Remove-Item -Recurse -Force .next
```

### 2. ✅ 重新安装 @prisma/client
```bash
npm install @prisma/client
```
输出：`changed 1 package, and audited 437 packages in 16s`

## 最终解决方案

**重启开发服务器即可！**

1. **停止当前开发服务器**（Ctrl+C）
2. **重新启动**：
   ```bash
   npm run dev
   ```

3. **验证修复**：
   - 尝试发布学习内容
   - 查看后端日志，应该不再有 `Unknown argument` 错误
   - 成功创建学习材料

## 为什么重启就能解决？

- ✅ `@prisma/client` 已重新安装（包含最新的类型定义）
- ✅ `.next` 缓存已清除
- ✅ 数据库迁移已执行
- ✅ Schema 文件正确

重启后，Next.js 会：
1. 重新编译代码
2. 加载新的 Prisma 客户端
3. 读取正确的类型定义

## 验证迁移文件

`prisma/migrations/20251229014458_add_training_category_and_public/migration.sql` 中包含：

```sql
CREATE TABLE "TrainingMaterial" (
    ...
    "category" TEXT,
    ...
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    ...
)
```

这确认了字段在数据库中存在。

## 如果重启后仍有问题

### 方案 1：手动验证数据库
```bash
npx prisma studio
```
打开 TrainingMaterial 表，检查字段是否存在。

### 方案 2：强制重置 Prisma
```bash
# 删除 node_modules/.prisma 目录
Remove-Item -Recurse -Force node_modules\.prisma

# 重新生成（通过 npm run dev 自动触发）
npm run dev
```

### 方案 3：检查环境变量
确保 `.env` 文件存在且包含：
```
DATABASE_URL="file:./dev.db"
```

## 预防措施

将来更新 Prisma schema 后：
1. 运行迁移：`npx prisma migrate dev`
2. 清除 `.next` 缓存：`Remove-Item -Recurse -Force .next`
3. 重启开发服务器

## 相关文件

- `prisma/schema.prisma` - 数据模型定义
- `prisma/migrations/20251229014458_add_training_category_and_public/migration.sql` - 迁移 SQL
- `src/app/api/training/materials/route.ts` - API 路由（已添加详细日志）
- `node_modules/@prisma/client` - Prisma 客户端（已更新）

## 总结

问题已基本解决，只需**重启开发服务器**即可应用所有更改。
