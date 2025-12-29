# PDF学习系统 - 仅PDF模式实现

## 概述
本文档记录了PDF学习系统的完整实现，该系统支持用户直接学习PDF材料并参加考试。系统支持两种模式：
1. **任务模式**：通过学习任务访问，会记录学习进度和考试成绩
2. **自由学习模式**：直接从知识库访问，不记录进度，纯粹用于学习和练习

## 系统架构

### 路由结构
```
/training/
  ├── knowledge-base/          # 知识库列表页
  ├── learn/
  │   ├── [taskId]/           # 任务模式学习（通过学习任务）
  │   └── material/
  │       └── [id]/           # 自由学习模式（直接访问材料）
  └── exam/
      ├── [taskId]/           # 任务模式考试
      └── material/
          └── [id]/           # 练习模式考试（不记录成绩）
```

### API路由
```
/api/training/materials/
  ├── route.ts                # GET: 获取材料列表
  └── [id]/
      └── route.ts           # GET: 获取单个材料详情
```

## 关键实现

### 1. 知识库页面 (src/app/training/knowledge-base/page.tsx)

**功能**：
- 显示所有PDF学习材料
- 点击"开始学习"进入自由学习模式
- 使用 `router.push(\`/training/learn/material/${material.id}\`)`

**关键代码**：
```typescript
// 开始学习 - 进入自由学习模式
const handleStartLearning = (material: TrainingMaterial) => {
  router.push(`/training/learn/material/${material.id}`);
};
```

### 2. 材料学习页面 (src/app/training/learn/material/[id]/page.tsx)

**功能**：
- 显示PDF文件内容
- 支持自由学习和任务模式
- 根据是否有任务决定是否记录学习进度
- 提供"开始考试"按钮

**关键特性**：
```typescript
// 根据URL参数判断模式
const params = await Promise.resolve(props.params);
const searchParams = await Promise.resolve(props.searchParams);
const materialId = params.id;
const taskId = searchParams?.taskId;

// 获取材料信息
const material = await prisma.trainingMaterial.findUnique({
  where: { id: materialId },
  include: { uploader: true }
});

// 如果有taskId，验证任务并记录进度
if (taskId) {
  const task = await prisma.trainingTask.findUnique({
    where: { id: taskId }
  });
  
  // 更新学习进度
  await prisma.trainingProgress.upsert({
    where: { taskId_userId: { taskId, userId: session.user.id } },
    update: { hasStudied: true, updatedAt: new Date() },
    create: { /* ... */ }
  });
}
```

**PDF显示**：
```typescript
<FileViewer url={material.url} type="pdf" />
```

**考试按钮**：
```typescript
<Link
  href={taskId 
    ? `/training/exam/${taskId}` 
    : `/training/exam/material/${materialId}`
  }
  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
>
  开始考试
</Link>
```

### 3. 材料考试页面 (src/app/training/exam/material/[id]/page.tsx)

**功能**：
- 加载材料的考试题目
- 支持练习模式（自由学习）和正式模式（任务）
- 练习模式不记录成绩，仅显示答案解析

**关键特性**：
```typescript
// 判断是否为练习模式
const isPracticeMode = !taskId;

// 练习模式提示
{isPracticeMode && (
  <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
    <p className="text-sm text-yellow-700">
      <strong>练习模式</strong>：此次考试不会记录成绩，仅用于学习练习
    </p>
  </div>
)}

// 考试完成后
if (!isPracticeMode && score >= passingScore) {
  // 更新学习进度为已完成
  await prisma.trainingProgress.update({
    where: { taskId_userId: { taskId, userId: session.user.id } },
    data: { status: 'COMPLETED', score, completedAt: new Date() }
  });
}
```

## 双模式流程

### 模式1：任务模式（有学习任务）
```
学习任务列表 (/training/tasks)
  ↓ 点击"开始学习"
学习页面 (/training/learn/[taskId])
  ↓ 查看PDF并点击"开始考试"
考试页面 (/training/exam/[taskId])
  ↓ 完成考试
记录成绩 → 更新进度为COMPLETED
```

**特点**：
- 记录学习时间
- 记录考试成绩
- 影响统计数据
- 及格后标记为完成

### 模式2：自由学习模式（无学习任务）
```
知识库列表 (/training/knowledge-base)
  ↓ 点击"开始学习"
学习页面 (/training/learn/material/[id])
  ↓ 查看PDF并点击"开始考试"
练习考试 (/training/exam/material/[id])
  ↓ 完成考试
仅显示答案解析，不记录成绩
```

**特点**：
- 不记录学习进度
- 不记录考试成绩
- 不影响统计数据
- 纯粹用于学习和练习

## 路由参数规范

### 重要：统一使用 `[id]` 作为动态路由参数

Next.js 15+ 规定：在同一父路径下，所有动态路由段必须使用相同的参数名。

**正确**：
```
/training/learn/material/[id]/
/training/exam/material/[id]/
/api/training/materials/[id]/
```

**错误**（会导致路由冲突）：
```
/training/learn/material/[materialId]/  ❌
/training/exam/material/[materialId]/   ❌
```

### 路由冲突解决历史

**问题**：
```
Error: You cannot use different slug names for the same dynamic path 
('id' !== 'materialId').
```

**原因**：
同时存在 `[id]` 和 `[materialId]` 两种不同的动态路由参数名

**解决方案**：
1. 删除所有 `[materialId]` 目录
2. 统一使用 `[id]` 参数名
3. 清理 Next.js 缓存 (`.next` 目录)
4. 重启开发服务器

**执行的命令**：
```bash
# 删除旧的目录
cmd /c "rd /s /q src\app\training\learn\material\[materialId]"
cmd /c "rd /s /q src\app\training\exam\material\[materialId]"
cmd /c "rd /s /q src\app\api\training\materials\[materialId]"

# 清理缓存
cmd /c "rd /s /q .next"

# 重启服务器
npm run dev
```

## 数据库模型

### TrainingMaterial
```prisma
model TrainingMaterial {
  id          String   @id @default(cuid())
  title       String
  url         String   // PDF文件URL
  examData    Json?    // 考试题目数据
  category    String?  // 分类
  isPublic    Boolean  @default(false)
  uploaderId  String
  uploader    User     @relation(...)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### TrainingProgress
```prisma
model TrainingProgress {
  id          String   @id @default(cuid())
  taskId      String
  userId      String
  status      String   // PENDING, IN_PROGRESS, COMPLETED
  hasStudied  Boolean  @default(false)
  score       Int?
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([taskId, userId])
}
```

## 测试要点

### 1. 自由学习模式测试
- [ ] 访问知识库页面
- [ ] 点击材料的"开始学习"按钮
- [ ] 验证PDF正确显示
- [ ] 点击"开始考试"进入练习模式
- [ ] 验证显示"练习模式"提示
- [ ] 完成考试，验证不记录成绩
- [ ] 验证可以查看答案解析

### 2. 任务模式测试
- [ ] 访问学习任务列表
- [ ] 点击任务的"开始学习"
- [ ] 验证PDF正确显示
- [ ] 完成学习后点击"开始考试"
- [ ] 验证进入正式考试模式
- [ ] 完成考试并达到及格分
- [ ] 验证任务状态更新为"已完成"
- [ ] 验证成绩被正确记录

### 3. 路由测试
- [ ] 验证所有路由正常工作
- [ ] 验证没有路由冲突错误
- [ ] 验证开发服务器正常启动

## 实现状态

✅ **已完成**：
1. 创建材料学习页面 (`/training/learn/material/[id]`)
2. 创建材料考试页面 (`/training/exam/material/[id]`)
3. 更新知识库页面跳转逻辑
4. 实现双模式支持（任务/自由学习）
5. 解决路由冲突问题
6. 统一使用 `[id]` 参数名
7. 清理所有 `[materialId]` 残留
8. 验证服务器正常启动

## 技术要点

### 1. Next.js 15+ 动态路由规则
- 同一父路径下的动态段必须使用相同的参数名
- 使用 `Promise.resolve(props.params)` 获取参数
- 使用 `Promise.resolve(props.searchParams)` 获取查询参数

### 2. React Server Components
- 学习和考试页面都是Server Components
- 直接在服务器端查询数据库
- 使用 `getServerSession` 获取用户信息

### 3. 文件查看
- 使用 `FileViewer` 组件显示PDF
- 直接传入 `url` 和 `type="pdf"`
- 组件内部处理PDF渲染

### 4. 进度记录
- 使用 `upsert` 操作确保记录唯一性
- 根据 `taskId` 存在与否决定是否记录
- 及格后自动更新状态为 `COMPLETED`

## 未来改进方向

1. **学习时长统计**：记录用户在PDF页面停留的时间
2. **学习进度可视化**：显示已学习材料的百分比
3. **书签功能**：允许用户标记学习位置
4. **笔记功能**：允许用户在学习时做笔记
5. **材料推荐**：基于学习历史推荐相关材料
6. **离线缓存**：支持离线查看已学习的材料

## 总结

PDF学习系统现已完全实现双模式支持：
- **任务模式**：完整的学习追踪和考核流程
- **自由学习模式**：灵活的自主学习和练习环境

系统无论是否有学习任务都能正常加载和使用，学习任务仅影响是否记录统计数据，完全满足用户需求。

---
最后更新：2025/12/29
状态：✅ 已完成并验证
