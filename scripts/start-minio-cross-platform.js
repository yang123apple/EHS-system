#!/usr/bin/env node
/**
 * 跨平台 MinIO 启动脚本
 * 在 npm run dev 之前自动启动 MinIO（如果未运行）
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const isWindows = os.platform() === 'win32';
const MINIO_PORT = 9000;

/**
 * 检查端口是否被占用
 */
function checkPort(port) {
  return new Promise((resolve) => {
    if (isWindows) {
      exec(`netstat -ano | findstr ":${port}"`, (error, stdout) => {
        resolve(stdout.includes('LISTENING'));
      });
    } else {
      exec(`lsof -ti:${port} 2>/dev/null`, (error) => {
        resolve(!error);
      });
    }
  });
}

/**
 * 查找 MinIO 可执行文件
 */
function findMinIOExecutable() {
  const scriptDir = __dirname;
  const projectRoot = path.join(scriptDir, '..');
  const binDir = path.join(projectRoot, 'bin');
  
  if (isWindows) {
    // Windows: 优先查找 bin/minio.exe
    const minioExe = path.join(binDir, 'minio.exe');
    if (fs.existsSync(minioExe)) {
      console.log('[MinIO] ✓ 找到 MinIO (Windows): bin/minio.exe');
      return minioExe;
    }
    
    // 检查系统 PATH
    console.log('[MinIO] ⚠ bin/minio.exe 不存在，尝试使用系统 PATH 中的 minio');
    return 'minio';
  } else {
    // Mac/Linux: 优先查找 bin/minio
    const minioExe = path.join(binDir, 'minio');
    if (fs.existsSync(minioExe)) {
      // 确保有执行权限
      try {
        fs.chmodSync(minioExe, '755');
        console.log('[MinIO] ✓ 找到 MinIO (Mac/Linux): bin/minio');
        return minioExe;
      } catch (e) {
        console.warn('[MinIO] ⚠ 无法设置执行权限，尝试继续...');
      }
      return minioExe;
    }
    
    // 检查系统 PATH
    console.log('[MinIO] ⚠ bin/minio 不存在，尝试使用系统 PATH 中的 minio');
    return 'minio';
  }
}

/**
 * 启动 MinIO
 */
function startMinIO() {
  // 获取脚本所在目录
  const scriptDir = __dirname;
  const projectRoot = path.join(scriptDir, '..');
  const dataDir = path.join(projectRoot, 'data', 'minio-data');
  
  // 确保数据目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[MinIO] ✓ 创建数据目录:', dataDir);
  }
  
  // 查找 MinIO 可执行文件
  const command = findMinIOExecutable();
  const args = ['server', dataDir, '--console-address', ':9001'];
  
  // 设置环境变量
  const env = {
    ...process.env,
    MINIO_ROOT_USER: process.env.MINIO_ROOT_USER || 'admin',
    MINIO_ROOT_PASSWORD: process.env.MINIO_ROOT_PASSWORD || 'change-me-now',
  };
  
  console.log('[MinIO] 正在后台启动 MinIO 服务...');
  console.log(`[MinIO] 命令: ${command} ${args.join(' ')}`);
  console.log(`[MinIO] 数据目录: ${dataDir}`);
  console.log(`[MinIO] Root User: ${env.MINIO_ROOT_USER}`);
  
  // 在后台启动 MinIO
  let minioProcess;
  try {
    if (isWindows) {
      // Windows: 使用 spawn 并在后台运行
      minioProcess = spawn(command, args, {
        env,
        cwd: projectRoot,
        stdio: 'ignore',
        detached: true,
        windowsHide: true,
      });
    } else {
      // Mac/Linux: 使用 spawn 并在后台运行
      minioProcess = spawn(command, args, {
        env,
        cwd: projectRoot,
        stdio: 'ignore',
        detached: true,
      });
    }
    
    // 分离进程，让它在后台运行
    minioProcess.unref();
    
    // 检查进程是否立即退出（说明启动失败）
    minioProcess.on('error', (error) => {
      console.error('[MinIO] ❌ 启动失败:', error.message);
      if (error.code === 'ENOENT') {
        console.error('[MinIO] ❌ 未找到 MinIO 可执行文件');
        console.error('[MinIO] 提示:');
        if (isWindows) {
          console.error('[MinIO]   - 请将 minio.exe 放到 bin/ 目录');
          console.error('[MinIO]   - 或使用: .\\install-minio-windows.ps1');
        } else {
          console.error('[MinIO]   - 请将 minio 放到 bin/ 目录');
          console.error('[MinIO]   - 或使用: brew install minio/stable/minio');
          console.error('[MinIO]   - 或使用: docker-compose -f docker-compose.minio.yml up -d');
        }
      }
    });
    
    // 等待进程启动
    setTimeout(() => {
      // 检查进程是否还在运行
      try {
        process.kill(minioProcess.pid, 0);
        console.log('[MinIO] ✅ MinIO 服务已在后台启动 (PID: ' + minioProcess.pid + ')');
        console.log('[MinIO] 📍 API: http://localhost:9000');
        console.log('[MinIO] 📍 Console: http://localhost:9001');
      } catch (e) {
        // 进程可能已退出
        console.warn('[MinIO] ⚠ 无法确认 MinIO 进程状态，请检查日志');
      }
    }, 2000);
    
  } catch (error) {
    console.error('[MinIO] ❌ 启动 MinIO 时发生错误:', error.message);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('  MinIO 自动启动检查');
  console.log('========================================');
  console.log(`[MinIO] 平台: ${isWindows ? 'Windows' : os.platform()}`);
  console.log(`[MinIO] 架构: ${os.arch()}`);
  console.log('');
  
  try {
    // 检查端口是否被占用
    const isRunning = await checkPort(MINIO_PORT);
    
    if (isRunning) {
      console.log(`[MinIO] ✓ 端口 ${MINIO_PORT} 已被占用，MinIO 可能已在运行`);
      console.log('[MinIO] 📍 API: http://localhost:9000');
      console.log('[MinIO] 📍 Console: http://localhost:9001');
      console.log('');
      return;
    }
    
    // 启动 MinIO
    console.log(`[MinIO] 端口 ${MINIO_PORT} 未被占用，准备启动 MinIO...`);
    console.log('');
    startMinIO();
    
  } catch (error) {
    console.error('');
    console.error('[MinIO] ❌ 启动失败:', error.message);
    console.error('[MinIO] 提示: Next.js 开发服务器仍会继续启动，但 MinIO 功能可能不可用');
    console.error('[MinIO] 您可以使用以下方式手动启动 MinIO:');
    if (isWindows) {
      console.error('[MinIO]   - .\\start-minio-local.bat');
    } else {
      console.error('[MinIO]   - ./start-minio-local.sh');
    }
    console.error('[MinIO]   - docker-compose -f docker-compose.minio.yml up -d');
    console.error('');
    // 不阻止 dev 脚本继续运行
  }
}

main();
