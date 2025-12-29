# 通知系统 "Failed to fetch" 错误修复

## 问题描述
控制台出现 `TypeError: Failed to fetch` 错误，发生在 `NotificationPanel` 组件的 `fetchNotifications` 函数中。

## 根本原因分析

经过调查，问题不在于数据库或 Prisma（测试脚本验证通过），而是出在以下几个可能的方面：

### 1. Next.js Turbopack 开发模式的 API 路由问题
- Next.js 16.0.10 使用 Turbopack 可能导致某些 API 路由在初次加载时未准备就绪
- 前端组件在页面加载时立即调用 API，但路由可能尚未完全初始化

### 2. 前端错误处理不完善
- 原代码没有检查 HTTP 响应状态
- 没有为网络错误提供降级处理
- 缺少详细的错误日志

## 已实施的修复

### 1. 改进前端错误处理 (`src/components/common/NotificationPanel.tsx`)

**修改内容：**
- ✅ 添加明确的 HTTP 请求头
- ✅ 添加 `cache: 'no-store'` 禁用缓存
- ✅ 检查响应状态 (`res.ok`)
- ✅ 记录详细错误信息（状态码和错误文本）
- ✅ 网络错误时提供降级处理（设置空数组而不是崩溃）

**关键改进：**
```typescript
const res = await fetch(`/api/notifications?userId=${user.id}`, {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
  cache: 'no-store',
});

if (!res.ok) {
  console.error('获取通知失败，状态码:', res.status);
  const errorText = await res.text();
  console.error('错误详情:', errorText);
  return;
}
```

### 2. 增强 API 路由日志 (`src/app/api/notifications/route.ts`)

**修改内容：**
- ✅ 添加详细的控制台日志
- ✅ 改进错误响应格式（包含详细信息）
- ✅ 记录每次请求的用户 ID 和结果

**关键改进：**
```typescript
console.log(`[Notifications API] 获取用户 ${userId} 的通知`);
// ... 查询逻辑
console.log(`[Notifications API] 成功获取 ${notifications.length} 条通知，未读 ${unreadCount} 条`);
```

### 3. 创建测试脚本 (`scripts/test-notifications.js`)

验证数据库层面的通知功能：
- ✅ 创建通知
- ✅ 查询通知
- ✅ 统计未读数量
- ✅ 更新已读状态

**测试结果：** ✅ 所有测试通过

## 可能的剩余问题和解决方案

### 问题 1: 开发服务器未运行或端口冲突
**解决方案：**
```bash
# 停止所有 Node 进程
taskkill /F /IM node.exe

# 重启开发服务器
npm run dev
```

### 问题 2: Turbopack 缓存问题
**解决方案：**
```bash
# 清理 Next.js 缓存
rm -rf .next

# 重新启动
npm run dev
```

### 问题 3: API 路由在初次加载时未就绪
**解决方案（已在代码中实现）：**
- 前端使用 `try-catch` 捕获错误
- 错误时设置空数组，不影响 UI 渲染
- 30秒后自动重试

### 问题 4: CORS 或代理配置
**检查方法：**
打开浏览器开发者工具 > Network 标签页，查看：
- 请求是否发送到正确的 URL
- 响应状态码是什么
- 是否有 CORS 错误

## 验证步骤

### 1. 测试数据库层（已完成 ✅）
```bash
node scripts/test-notifications.js
```

### 2. 测试 API 路由
1. 启动开发服务器
2. 访问：`http://localhost:3000/api/notifications?userId=11738034`
3. 应该看到 JSON 响应

### 3. 测试前端组件
1. 登录系统
2. 点击右上角的通知铃铛
3. 检查浏览器控制台：
   - 是否有详细的日志输出
   - 是否有错误信息
   - 网络请求是否成功

## 监控和调试

### 浏览器控制台应显示：
```
[Notifications API] 获取用户 xxx 的通知
[Notifications API] 成功获取 X 条通知，未读 Y 条
```

### 如果仍有错误：
1. 检查完整的错误堆栈
2. 查看网络请求的详细信息
3. 确认用户 ID 是否正确传递
4. 验证 Prisma 客户端是否正确初始化

## 预防措施

1. **始终检查 HTTP 响应状态**
2. **提供降级处理**（优雅失败）
3. **添加详细日志**用于调试
4. **测试边缘情况**（网络错误、超时等）

## 下一步

如果问题仍然存在：
1. 重启开发服务器
2. 清除浏览器缓存
3. 检查 Next.js 日志输出
4. 验证数据库连接
5. 检查防火墙或代理设置

## 相关文件

- `src/components/common/NotificationPanel.tsx` - 前端组件
- `src/app/api/notifications/route.ts` - API 路由
- `scripts/test-notifications.js` - 测试脚本
- `src/lib/prisma.ts` - Prisma 客户端配置
- `prisma/schema.prisma` - 数据库模型定义
