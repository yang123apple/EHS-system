# 隐患编号回收系统 - 快速测试指南

## ✅ 已完成的部署

1. ✅ 数据库迁移完成（添加 `HazardCodePool` 表）
2. ✅ 编号池初始化完成（当前无已作废隐患）
3. ✅ 所有脚本测试通过

## 🧪 手动测试流程

### 测试 1: 验证编号回收流程

#### 步骤 1: 启动开发服务器
```bash
npm run dev
```

#### 步骤 2: 创建第一个隐患
```bash
curl -X POST http://localhost:3000/api/hazards \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "type": "测试隐患",
    "location": "测试区域",
    "desc": "测试编号回收功能",
    "riskLevel": "low",
    "reporterId": "your-user-id",
    "reporterName": "测试用户"
  }'
```

**预期结果：**
- 返回编号如：`Hazard20260203001`
- 日志显示：`✅ [编号生成] 新编号: Hazard20260203001`

#### 步骤 3: 软删除这个隐患
```bash
curl -X POST http://localhost:3000/api/hazards/void \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "hazardId": "刚才创建的隐患ID",
    "reason": "测试编号回收"
  }'
```

**预期结果：**
- 日志显示：
  ```
  ♻️ [编号回收] 编号 Hazard20260203001 已释放到编号池
  ✅ [隐患作废] 隐患 Hazard20260203001 已作废
  ```

#### 步骤 4: 查看编号池
```bash
# 在 Prisma Studio 中查看
npx prisma studio

# 或使用 SQLite 命令
sqlite3 prisma/dev.db "SELECT * FROM HazardCodePool;"
```

**预期结果：**
```
id | code              | datePrefix | sequence | status    | ...
---|-------------------|------------|----------|-----------|----
1  | Hazard20260203001 | 20260203   | 1        | available | ...
```

#### 步骤 5: 再次创建隐患
```bash
curl -X POST http://localhost:3000/api/hazards \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "type": "测试隐患2",
    "location": "测试区域",
    "desc": "验证编号重用",
    "riskLevel": "low",
    "reporterId": "your-user-id",
    "reporterName": "测试用户"
  }'
```

**预期结果：**
- 返回相同编号：`Hazard20260203001` ✅ **编号被重用！**
- 日志显示：
  ```
  ♻️ [编号回收] 重用编号: Hazard20260203001 (序号: 1)
  ```

#### 步骤 6: 验证编号池状态
```bash
sqlite3 prisma/dev.db "SELECT code, status, usedBy FROM HazardCodePool WHERE code='Hazard20260203001';"
```

**预期结果：**
```
Hazard20260203001 | used | your-user-id
```

### 测试 2: 验证编号连续性（优先使用小序号）

#### 步骤 1: 创建多个隐患
```bash
# 创建 3 个隐患，得到编号 001, 002, 003
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/hazards \
    -H "Content-Type: application/json" \
    -d '{"type":"测试","location":"区域","desc":"测试'$i'","riskLevel":"low","reporterId":"user-id","reporterName":"张三"}'
  sleep 1
done
```

#### 步骤 2: 作废 002 和 003（保留 001）
```bash
# 作废 002
curl -X POST http://localhost:3000/api/hazards/void \
  -d '{"hazardId":"hazard-002-id","reason":"测试"}'

# 作废 003
curl -X POST http://localhost:3000/api/hazards/void \
  -d '{"hazardId":"hazard-003-id","reason":"测试"}'
```

#### 步骤 3: 创建新隐患
```bash
curl -X POST http://localhost:3000/api/hazards \
  -d '{"type":"测试4","location":"区域","desc":"测试连续性","riskLevel":"low","reporterId":"user-id","reporterName":"张三"}'
```

**预期结果：**
- 应该重用 `Hazard20260203002`（最小的可用序号）
- 而不是 `003`

### 测试 3: 验证硬删除

#### 步骤 1: 硬删除隐患
```bash
curl -X DELETE 'http://localhost:3000/api/hazards/destroy?id=hazard-id' \
  -H "Cookie: your-admin-cookie"
```

**预期结果：**
- 日志显示：
  ```
  🗑️ [编号回收] 编号 Hazard20260203001 已从编号池永久移除
  ✅ [硬删除] 隐患 Hazard20260203001 已物理删除
     - 编号池记录：1 条
  ```
- 编号池中该编号被删除

### 测试 4: 验证过期清理

#### 步骤 1: 修改数据库，设置过期时间
```bash
sqlite3 prisma/dev.db "UPDATE HazardCodePool SET expiresAt = datetime('now', '-1 day') WHERE status='available';"
```

#### 步骤 2: 运行清理脚本
```bash
npx ts-node scripts/clean-expired-hazard-codes.ts
```

**预期结果：**
```
🧹 [2026-02-03T...] 开始清理过期编号...
✅ [2026-02-03T...] 清理完成，删除 X 条过期记录
📊 编号池统计: 总计 Y 条，可用 Z 条，已使用 W 条
```

## 📊 监控查询

### 查看编号池状态
```sql
-- 所有可用编号
SELECT code, datePrefix, sequence, releasedAt, expiresAt
FROM HazardCodePool
WHERE status = 'available'
ORDER BY datePrefix DESC, sequence ASC;

-- 统计
SELECT
  status,
  COUNT(*) as count
FROM HazardCodePool
GROUP BY status;

-- 按日期统计
SELECT
  datePrefix,
  COUNT(*) as count
FROM HazardCodePool
WHERE status = 'available'
GROUP BY datePrefix
ORDER BY datePrefix DESC;
```

### 查看编号使用历史
```sql
SELECT
  code,
  status,
  releasedBy,
  releasedAt,
  usedBy,
  usedAt
FROM HazardCodePool
ORDER BY releasedAt DESC
LIMIT 10;
```

## 🐛 常见问题排查

### 问题：编号没有被重用

**检查步骤：**
1. 查看编号池是否有可用编号
   ```bash
   sqlite3 prisma/dev.db "SELECT COUNT(*) FROM HazardCodePool WHERE status='available' AND datePrefix='20260203';"
   ```

2. 查看日志是否有错误
   ```bash
   # 检查服务器日志
   ```

3. 验证编号池服务是否正常
   ```bash
   # 查看 src/services/hazardCodePool.service.ts 是否有语法错误
   ```

### 问题：编号冲突

**检查步骤：**
1. 验证唯一性约束
   ```bash
   sqlite3 prisma/dev.db ".schema HazardRecord" | grep code
   ```

2. 检查是否有重复编号
   ```bash
   sqlite3 prisma/dev.db "SELECT code, COUNT(*) FROM HazardRecord GROUP BY code HAVING COUNT(*) > 1;"
   ```

## 📝 日志关键字

在服务器日志中搜索以下关键字来监控编号回收：

- `♻️ [编号回收]` - 编号回收相关操作
- `✅ [编号生成]` - 新编号生成
- `🗑️ [编号回收]` - 编号永久移除
- `🧹 [编号回收]` - 过期编号清理

## 🎯 成功标准

系统正常工作的标志：

1. ✅ 软删除后日志显示"编号已释放到编号池"
2. ✅ 创建新隐患时优先使用池中的编号
3. ✅ 编号按序号从小到大重用（保持连续性）
4. ✅ 硬删除后编号从池中移除
5. ✅ 清理脚本能成功删除过期编号

## 🚀 下一步

测试通过后，可以：

1. 配置定时任务（每天清理过期编号）
2. 设置监控告警（编号池异常增长）
3. 优化过期时间（根据实际情况调整）

---

**祝测试顺利！** 🎉
