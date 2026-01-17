# EHS 管理系统测试文档

本文档描述了 EHS 管理系统的自动化测试框架和使用方法。

## 测试框架

项目使用 **Jest** 作为测试框架，配合 **Supertest** 进行 API 集成测试。

### 技术栈

- **Jest**: 单元测试和集成测试框架
- **ts-jest**: TypeScript 支持
- **jest-environment-jsdom**: 浏览器环境模拟
- **Supertest**: HTTP 断言库（用于 API 测试）

## 项目结构

```
src/
├── __tests__/               # 测试文件目录
│   ├── __mocks__/          # Mock 数据和工具函数
│   │   └── test-helpers.ts # 测试辅助工具
│   ├── unit/               # 单元测试
│   │   ├── lib/
│   │   │   └── permissions.test.ts
│   │   └── services/
│   │       ├── hazardDispatchEngine.test.ts
│   │       └── hazardCodeGeneration.test.ts
│   └── integration/        # 集成测试
│       └── api/
│           └── hazards-api.test.ts
```

## 运行测试

### 安装依赖

```bash
npm install
```

### 运行所有测试

```bash
npm test
```

### 运行特定测试文件

```bash
npm test hazardDispatchEngine.test.ts
```

### 监视模式（开发时使用）

```bash
npm run test:watch
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

### 运行单元测试

```bash
npm run test:unit
```

### 运行集成测试

```bash
npm run test:integration
```

## 测试覆盖范围

根据代码审查报告第14项的建议，当前测试覆盖以下关键模块：

### 1. 派发引擎测试 (`hazardDispatchEngine.test.ts`)

- ✅ 状态流转逻辑（上报 → 指派 → 整改 → 验收）
- ✅ 处理人匹配
- ✅ 操作日志生成
- ✅ 候选处理人列表生成（或签/会签模式）
- ✅ 错误处理和边界条件

### 2. 编号生成测试 (`hazardCodeGeneration.test.ts`)

- ✅ 编号格式正确性（Hazard + YYYYMMDD + 序号）
- ✅ 编号唯一性保证
- ✅ 并发安全性（冲突处理）
- ✅ 日期和序号边界条件

### 3. 权限校验测试 (`permissions.test.ts`)

- ✅ 管理员权限检查
- ✅ 普通用户权限检查
- ✅ 资源权限（self/all）
- ✅ 模块访问权限
- ✅ 权限验证和错误处理

### 4. API 集成测试 (`hazards-api.test.ts`)

- ✅ 隐患列表查询（分页、筛选）
- ✅ 统计查询（风险等级、重复隐患）
- ✅ 隐患创建和编号生成
- ✅ 权限控制（IDOR 防护）
- ✅ JSON 解析健壮性

## 测试最佳实践

### 1. 单元测试原则

- 每个测试用例应该只测试一个功能点
- 使用描述性的测试名称（中文描述）
- 遵循 AAA 模式：Arrange（准备）、Act（执行）、Assert（断言）
- 每个测试应该独立，不依赖其他测试的状态

### 2. Mock 使用

```typescript
// Mock 外部依赖
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock 返回值
mockPrisma.hazardRecord.findMany.mockResolvedValue([]);
```

### 3. 测试数据

使用 `test-helpers.ts` 中的辅助函数创建测试数据：

```typescript
import { createMockHazard, createMockUser } from '../../__mocks__/test-helpers';

const mockHazard = createMockHazard({
  status: 'reported',
  currentStepIndex: 0,
});
```

### 4. 异步测试

```typescript
it('应该处理异步操作', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

## 持续集成

建议在 CI/CD 流程中添加测试步骤：

```yaml
# .github/workflows/test.yml 示例
- name: Run tests
  run: npm test

- name: Generate coverage
  run: npm run test:coverage
```

## 测试覆盖率目标

根据代码审查报告，建议的最低覆盖率：

- 关键业务逻辑（派发引擎、编号生成）：**80%+**
- 权限和安全模块：**90%+**
- API 路由：**70%+**

## 待扩展的测试

根据实际需要，可以继续添加以下测试：

1. **工作流配置测试**：测试工作流步骤配置的正确性
2. **通知服务测试**：测试通知生成和发送逻辑
3. **数据迁移测试**：测试数据库迁移脚本
4. **文件上传测试**：测试文件存储和检索
5. **性能测试**：测试并发场景下的性能

## 常见问题

### Q: 测试失败，提示找不到模块？

A: 确保 `jest.config.js` 中的 `moduleNameMapper` 配置正确，路径别名应该与 `tsconfig.json` 一致。

### Q: Mock 不生效？

A: 检查 mock 是否在 `beforeEach` 中正确重置，使用 `jest.clearAllMocks()`。

### Q: 测试超时？

A: 增加测试超时时间：`jest.setTimeout(10000)`，或检查是否有未完成的异步操作。

## 贡献指南

添加新测试时，请遵循以下规范：

1. 测试文件命名：`*.test.ts` 或 `*.spec.ts`
2. 测试描述使用中文，清晰描述测试场景
3. 每个测试文件应该有一个 `describe` 块和多个 `it` 块
4. 使用 `beforeEach` 和 `afterEach` 进行测试前后的清理

## 参考资源

- [Jest 官方文档](https://jestjs.io/)
- [Testing Library 文档](https://testing-library.com/)
- [Next.js 测试文档](https://nextjs.org/docs/testing)
