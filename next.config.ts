import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // Turbopack 配置（Next.js 16+ 默认使用 Turbopack）
  turbopack: {
    resolveAlias: {
      // 配置 PDF.js worker 文件处理
      'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.min.mjs',
    },
  },

  // Webpack 配置（仅在开发环境使用 --webpack 时生效）
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

    // 配置 PDF.js worker 文件处理
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.min.mjs',
    };

    return config;
  },
};

export default nextConfig;
