// Jest 集成测试环境配置
// 专用于需要 Prisma 和数据库访问的集成测试

// 设置测试环境变量
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db'

// 延长集成测试的超时时间（因为涉及数据库操作）
jest.setTimeout(30000)

// Mock Next.js 服务端模块（集成测试中可能需要）
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
  headers: () => ({
    get: jest.fn(),
  }),
}))

// 全局 beforeAll：可选的数据库初始化
// beforeAll(async () => {
//   // 如需要，可在这里初始化测试数据库
// })

// 全局 afterAll：清理测试数据
// afterAll(async () => {
//   // 如需要，可在这里清理测试数据库
// })
