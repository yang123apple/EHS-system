import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {},
  // 排除频繁变化的文件，防止 Fast Refresh 持续重建
  webpack: (config, { isServer }) => {
    // 配置文件监听选项，排除频繁变化的文件
    const ignoredPatterns = [
      '**/node_modules/**',
      '**/.next/**',
      '**/prisma/**/*.db*',
      '**/prisma/**/*.db-journal',
      '**/prisma/**/*.db-shm',
      '**/prisma/**/*.db-wal',
      '**/*.db',
      '**/*.db-journal',
      '**/*.db-shm',
      '**/*.db-wal',
      '**/*.log',
      '**/build.log',
      '**/build_output.txt',
      '**/*.tsbuildinfo',
      '**/data/**',
      '**/public/uploads/**',
      '**/certs/**',
      '**/ehs-private/**',
      '**/ehs-public/**',
    ];

    config.watchOptions = {
      ...config.watchOptions,
      ignored: ignoredPatterns,
      // 增加轮询间隔，减少文件系统事件
      poll: false,
      // 聚合延迟，减少频繁触发
      aggregateTimeout: 300,
    };

    return config;
  },
};

export default nextConfig;
