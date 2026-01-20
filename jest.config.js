const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // 提供 Next.js 应用的路径以加载 next.config.js 和 .env 文件
  dir: './',
})

// 添加任何自定义 Jest 配置
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // 根据测试类型使用不同的测试环境
  testEnvironment: 'jest-environment-jsdom',
  
  // 路径别名映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/scripts/',
    '<rootDir>/data/',
    '<rootDir>/src/__tests__/__mocks__/',
  ],
  
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
  ],
  
  // 确保不忽略需要转换的文件
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))',
  ],
  
  // 项目配置：支持不同类型的测试
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/__tests__/unit/**/*.test.[jt]s?(x)'],
      testEnvironment: 'jest-environment-jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest', {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
            },
            transform: {
              react: {
                runtime: 'automatic',
              },
            },
          },
        }],
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.[jt]s?(x)'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.integration.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest', {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
            },
          },
        }],
      },
    },
    {
      displayName: 'components',
      testMatch: ['<rootDir>/src/components/**/*.test.[jt]s?(x)'],
      testEnvironment: 'jest-environment-jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest', {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true,
              decorators: true,
            },
            transform: {
              react: {
                runtime: 'automatic',
              },
            },
          },
        }],
      },
    },
  ],
}

// createJestConfig 被导出，这样 next/jest 可以加载 Next.js 配置，异步设置 Jest
module.exports = createJestConfig(customJestConfig)
