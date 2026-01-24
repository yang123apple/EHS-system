/**
 * MinIO 自动启动辅助函数
 * 在应用初始化时，如果 MinIO 未运行，尝试自动启动
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

const isWindows = platform() === 'win32';

/**
 * 检查 MinIO 健康状态
 */
export async function checkMinIOHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get('http://localhost:9000/minio/health/live', { timeout: 2000 }, (res: any) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 尝试启动 MinIO
 */
export async function tryStartMinIO(): Promise<void> {
  const projectRoot = process.cwd();
  const binDir = join(projectRoot, 'bin');
  const dataDir = join(projectRoot, 'data', 'minio-data');
  
  // 查找 MinIO 可执行文件
  let command: string;
  if (isWindows) {
    const minioExe = join(binDir, 'minio.exe');
    if (existsSync(minioExe)) {
      command = minioExe;
    } else {
      console.log('⚠️  未找到 bin/minio.exe，跳过自动启动');
      return;
    }
  } else {
    const minioBin = join(binDir, 'minio');
    if (existsSync(minioBin)) {
      command = minioBin;
    } else {
      console.log('⚠️  未找到 bin/minio，跳过自动启动');
      return;
    }
  }
  
  // 确保数据目录存在
  if (!existsSync(dataDir)) {
    const fs = require('fs');
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const args = ['server', dataDir, '--console-address', ':9001'];
  const env = {
    ...process.env,
    MINIO_ROOT_USER: process.env.MINIO_ROOT_USER || 'admin',
    MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD || 'change-me-now',
  };
  
  console.log(`[MinIO] 正在后台启动: ${command} ${args.join(' ')}`);
  
  try {
    const minioProcess = spawn(command, args, {
      env,
      cwd: projectRoot,
      stdio: 'ignore',
      detached: true,
      ...(isWindows && { windowsHide: true }),
    });
    
    minioProcess.unref();
    console.log(`[MinIO] ✓ MinIO 进程已启动 (PID: ${minioProcess.pid})`);
  } catch (error: any) {
    console.error(`[MinIO] ❌ 启动失败: ${error.message}`);
    throw error;
  }
}
