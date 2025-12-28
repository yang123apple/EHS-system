# 主管查找逻辑与配置持久化修复总结

## 修复日期
2025年12月26日

## 问题描述

### 问题1：隐患分类配置丢失
- **现象**：隐患分类配置在服务器重启后会恢复为默认值（火灾、爆炸等）
- **原因**：配置未持久化到数据库，仅存储在内存中

### 问题2：主管查找逻辑缺陷
- **现象**：当上报人或责任人本身就是部门主管时，系统仍然查找当前部门的主管（即其本人）
- **需求**：当人员ID等于部门的managerId时，应该查找上级部门（通过parentId）的主管

## 解决方案

### 1. 配置持久化（问题1）

#### 数据库迁移
文件：`prisma/migrations/20251225153114_add_hazard_config_table/migration.sql`

创建了 `HazardConfig` 表用于存储隐患系统配置：
```sql
CREATE TABLE "HazardConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HazardConfig_key_key" ON "HazardConfig"("key");
```

#### Schema更新
文件：`prisma/schema.prisma`

```prisma
model HazardConfig {
  id          String   @id @default(cuid())
  key         String   @unique
  value       String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### API实现
文件：`src/app/api/hazards/config/route.ts`

实现了配置的读取和保存：
- **GET**：从数据库读取配置，如果不存在则返回默认值
- **POST**：使用 `upsert` 操作持久化配置到数据库

```typescript
// 保存配置
await prisma.hazardConfig.upsert({
  where: { key: 'hazard_types' },
  update: { value: JSON.stringify(body.types) },
  create: {
    key: 'hazard_types',
    value: JSON.stringify(body.types),
    description: '隐患分类配置'
  }
});
```

### 2. 主管查找逻辑修复（问题2）

#### 核心工具函数
文件：`src/utils/departmentUtils.ts`

新增 `getUserSupervisor` 函数，实现用户要求的精确逻辑：

```typescript
export function getUserSupervisor(
  userId: string,
  departments: Department[],
  allUsers: SimpleUser[]
): SimpleUser | null {
  // 1. 找到用户所在部门
  const userDept = departments.find(d => 
    allUsers.find(u => u.id === userId && (u.departmentId === d.id || u.department === d.name))
  );
  
  if (!userDept) {
    return null;
  }

  // 2. 检查用户是否是部门主管
  const isManager = userDept.managerId === userId;

  if (isManager) {
    // 3a. 如果用户是主管，查找上级部门的主管
    if (userDept.parentId) {
      const parentDept = departments.find(d => d.id === userDept.parentId);
      if (parentDept?.managerId) {
        const parentManager = allUsers.find(u => u.id === parentDept.managerId);
        if (parentManager) {
          return parentManager;
        }
      }
    }
    return null; // 如果是顶级主管，返回null
  } else {
    // 3b. 如果用户不是主管，返回当前部门主管
    if (userDept.managerId) {
      const manager = allUsers.find(u => u.id === userDept.managerId);
      return manager || null;
    }
    return null;
  }
}
```

**逻辑流程**：
1. 根据人员ID在org.json里找到部门ID
2. 在部门找到managerId和parentId
3. 核对人员ID是否等于managerId
   - 如果**否**：输出managerId（当前部门主管）
   - 如果**是**：查找parentId对应的部门，输出该部门的managerId（上级部门主管）

#### 处理人匹配引擎更新
文件：`src/app/hidden-danger/_utils/handler-matcher.ts`

更新了两个关键函数使用 `getUserSupervisor`：

**1. matchReporterManager** - 上报人主管匹配
```typescript
function matchReporterManager(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[]
): SimpleUser[] {
  if (!hazard.reporterId) {
    return [];
  }

  // 使用 getUserSupervisor 自动处理上报人本身是主管的情况
  const supervisor = getUserSupervisor(
    hazard.reporterId,
    departments,
    allUsers
  );

  if (!supervisor) {
    return [];
  }

  return [supervisor];
}
```

**2. matchResponsibleManager** - 责任人主管匹配
```typescript
function matchResponsibleManager(
  hazard: any,
  allUsers: SimpleUser[],
  departments: Department[]
): SimpleUser[] {
  if (!hazard.responsibleId) {
    return [];
  }

  // 使用 getUserSupervisor 自动处理责任人本身是主管的情况
  const supervisor = getUserSupervisor(
    hazard.responsibleId,
    departments,
    allUsers
  );

  if (!supervisor) {
    return [];
  }

  return [supervisor];
}
```

#### 抄送人匹配引擎更新
文件：`src/app/hidden-danger/_utils/cc-matcher.ts`

更新了三个主管查找函数使用 `getUserSupervisor`：

**1. matchReporterManager** - 上报人主管抄送
```typescript
function matchReporterManager(context: CCMatchContext): CCMatchResult {
  const { hazard, allUsers, departments } = context;
  
  if (!hazard.reporterId) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '无法获取上报人信息',
    };
  }

  const supervisor = getUserSupervisor(
    hazard.reporterId,
    departments as Department[],
    allUsers
  );

  if (!supervisor) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未找到上报人主管',
    };
  }

  return {
    success: true,
    userIds: [supervisor.id],
    userNames: [supervisor.name],
    matchedBy: `上报人主管`,
  };
}
```

**2. matchResponsibleManager** - 责任人主管抄送
```typescript
function matchResponsibleManager(context: CCMatchContext): CCMatchResult {
  const { hazard, allUsers, departments } = context;
  
  if (!hazard.responsibleId || !hazard.responsibleName) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '隐患未指定责任人',
    };
  }

  const supervisor = getUserSupervisor(
    hazard.responsibleId,
    departments as Department[],
    allUsers
  );

  if (!supervisor) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未找到责任人主管',
    };
  }

  return {
    success: true,
    userIds: [supervisor.id],
    userNames: [supervisor.name],
    matchedBy: `责任人主管`,
  };
}
```

**3. matchHandlerManager** - 处理人主管抄送
```typescript
function matchHandlerManager(context: CCMatchContext): CCMatchResult {
  const { handler, allUsers, departments } = context;
  
  if (!handler) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '无法获取处理人信息',
    };
  }

  const supervisor = getUserSupervisor(
    handler.id,
    departments as Department[],
    allUsers
  );

  if (!supervisor) {
    return {
      success: false,
      userIds: [],
      userNames: [],
      error: '未找到处理人主管',
    };
  }

  return {
    success: true,
    userIds: [supervisor.id],
    userNames: [supervisor.name],
    matchedBy: `处理人主管`,
  };
}
```

## 修改文件清单

### 1. 数据库相关
- ✅ `prisma/schema.prisma` - 添加HazardConfig模型
- ✅ `prisma/migrations/20251225153114_add_hazard_config_table/migration.sql` - 创建配置表

### 2. API接口
- ✅ `src/app/api/hazards/config/route.ts` - 实现配置读写持久化

### 3. 工具函数
- ✅ `src/utils/departmentUtils.ts` - 新增getUserSupervisor函数

### 4. 匹配引擎
- ✅ `src/app/hidden-danger/_utils/handler-matcher.ts` - 更新主管匹配逻辑
- ✅ `src/app/hidden-danger/_utils/cc-matcher.ts` - 更新抄送人主管匹配逻辑

## 影响范围

### 工作流预览
- 上报隐患时的流程预览功能会正确显示主管信息
- 使用 `matchHandler` 函数进行预览，该函数调用了更新后的 handler-matcher.ts

### 实际派发
- 工作流执行时的处理人分配会使用正确的主管查找逻辑
- 抄送人分配会使用正确的主管查找逻辑

### 配置管理
- 隐患分类配置会持久化保存到数据库
- 服务器重启后配置不会丢失

## 测试建议

### 1. 配置持久化测试
1. 修改隐患分类配置
2. 重启服务器
3. 验证配置是否保持

### 2. 主管查找逻辑测试
需要测试以下场景：

#### 场景A：普通员工上报隐患
- 上报人：普通员工（非部门主管）
- 预期：上报人主管 = 当前部门的managerId

#### 场景B：部门主管上报隐患
- 上报人：部门主管（ID = 部门managerId）
- 预期：上报人主管 = 上级部门的managerId

#### 场景C：顶级主管上报隐患
- 上报人：顶级主管（部门无parentId）
- 预期：上报人主管 = null（无上级）

#### 场景D：责任人是主管
- 责任人：部门主管
- 预期：责任人主管 = 上级部门的managerId

### 3. 流程预览测试
1. 在上报隐患弹窗中查看流程预览
2. 验证主管信息是否正确显示
3. 特别关注主管本人上报时的预览

### 4. 抄送功能测试
1. 配置"上报人主管"抄送规则
2. 配置"责任人主管"抄送规则
3. 配置"处理人主管"抄送规则
4. 验证各种场景下的抄送人是否正确

## 注意事项

1. **数据库迁移**：需要运行 `npx prisma migrate dev` 应用数据库变更
2. **org.json结构要求**：确保组织架构数据包含正确的 managerId 和 parentId 字段
3. **向后兼容**：旧的 `getDepartmentManager` 函数仍然保留，用于不需要递归查找的场景
4. **性能考虑**：`getUserSupervisor` 函数进行了两次部门查找，但由于数据量小，性能影响可忽略

## 总结

本次修复解决了两个关键问题：
1. ✅ 隐患分类配置现在会持久化到数据库，服务器重启后不会丢失
2. ✅ 主管查找逻辑现在正确处理了"人员本身是主管"的情况，会向上查找上级部门主管

所有相关的匹配引擎（处理人匹配、抄送人匹配）都已更新，确保整个系统使用统一的主管查找逻辑。
