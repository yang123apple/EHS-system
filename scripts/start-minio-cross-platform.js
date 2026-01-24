#!/usr/bin/env node
/**
 * 跨平台 MinIO 启动脚本
 * 在 npm run dev 之前自动启动 MinIO（如果未运行）
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { getLocalIP } = require('./get-local-ip');

const isWindows = os.platform() === 'win32';
const MINIO_PORT = 9000;
const MINIO_CONSOLE_PORT = 9001;
const NEXTJS_PORT = 3000;

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
 * 检查 MinIO 是否真的可以连接（不仅仅是端口被占用）
 */
function checkMinIOHealth() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get('http://localhost:9000/minio/health/live', { timeout: 2000 }, (res) => {
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
 * 等待 MinIO 服务就绪（最多等待 30 秒）
 */
async function waitForMinIOReady(maxAttempts = 30, interval = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isHealthy = await checkMinIOHealth();
    if (isHealthy) {
      return true;
    }
    if (attempt < maxAttempts) {
      process.stdout.write(`[MinIO] 等待服务就绪... (${attempt}/${maxAttempts})\r`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  throw new Error('MinIO 服务启动超时（30秒）');
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
    
    // 短暂等待，确保进程启动
    setTimeout(() => {
      try {
        process.kill(minioProcess.pid, 0);
        console.log('[MinIO] ✓ MinIO 进程已启动 (PID: ' + minioProcess.pid + ')');
      } catch (e) {
        console.warn('[MinIO] ⚠ 无法确认 MinIO 进程状态');
      }
    }, 500);
    
    return minioProcess;
  } catch (error) {
    console.error('[MinIO] ❌ 启动 MinIO 时发生错误:', error.message);
    console.error('[MinIO] ❌ 请检查：');
    console.error('[MinIO]   1. bin/minio 或 bin/minio.exe 是否存在');
    console.error('[MinIO]   2. 文件是否有执行权限');
    console.error('[MinIO]   3. 端口 9000 是否被其他服务占用');
    throw error;
  }
}

/**
 * 等待 MinIO 服务就绪（最多等待 30 秒）
 */
async function waitForMinIOReady(maxAttempts = 30, interval = 1000) {
  console.log('[MinIO] 等待 MinIO 服务启动...');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const isHealthy = await checkMinIOHealth();
    if (isHealthy) {
      // 清除进度行
      process.stdout.write('\r' + ' '.repeat(50) + '\r');
      return true;
    }
    if (attempt < maxAttempts) {
      process.stdout.write(`[MinIO] 等待服务就绪... (${attempt}/${maxAttempts})\r`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  // 清除进度行
  process.stdout.write('\r' + ' '.repeat(50) + '\r');
  throw new Error('MinIO 服务启动超时（30秒）');
}

/**
 * 显示局域网访问信息
 */
async function displayNetworkInfo() {
  try {
    const localIP = await getLocalIP();
    if (localIP && localIP !== 'localhost') {
      console.log('');
      console.log('========================================');
      console.log('  🌐 局域网访问信息');
      console.log('========================================');
      console.log(`📍 本机 IP 地址: ${localIP}`);
      console.log('');
      console.log('局域网内其他设备可通过以下地址访问：');
      console.log(`  • Web 应用:     http://${localIP}:${NEXTJS_PORT}`);
      console.log(`  • MinIO API:    http://${localIP}:${MINIO_PORT}`);
      console.log(`  • MinIO Console: http://${localIP}:${MINIO_CONSOLE_PORT}`);
      console.log('');
      console.log('========================================');
      console.log('');
    }
  } catch (error) {
    // 忽略错误，不影响启动
  }
}

/**
 * 主函数
 */
async function main() {
  // 确保输出立即刷新，使用 console.log 而不是 process.stdout.write
  console.log('========================================');
  console.log('  MinIO 自动启动检查');
  console.log('========================================');
  console.log(`[MinIO] 平台: ${isWindows ? 'Windows' : os.platform()}`);
  console.log(`[MinIO] 架构: ${os.arch()}`);
  console.log('');
  
  // 强制刷新输出缓冲区
  if (process.stdout.isTTY) {
    process.stdout.write('');
  }
  
  // 确保错误也会被捕获
  process.on('unhandledRejection', (error) => {
    console.error('[MinIO] ❌ 未处理的错误:', error);
    process.exit(1);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('[MinIO] ❌ 未捕获的异常:', error);
    process.exit(1);
  });
  
  try {
    // 首先检查 MinIO 是否真的可以连接（不仅仅是端口被占用）
    const isHealthy = await checkMinIOHealth();
    if (isHealthy) {
      const localIP = await getLocalIP();
      console.log(`[MinIO] ✓ MinIO 服务已在运行并可以连接`);
      console.log('[MinIO] 📍 API (本地): http://localhost:9000');
      console.log('[MinIO] 📍 Console (本地): http://localhost:9001');
      if (localIP && localIP !== 'localhost') {
        console.log(`[MinIO] 📍 API (局域网): http://${localIP}:9000`);
        console.log(`[MinIO] 📍 Console (局域网): http://${localIP}:9001`);
      }
      console.log('');
      
      // 显示局域网访问信息
      await displayNetworkInfo();
      return;
    }
    
    // 检查端口是否被占用
    const isPortInUse = await checkPort(MINIO_PORT);
    if (isPortInUse) {
      // 端口被占用但健康检查失败，可能是 MinIO 正在启动中
      console.log(`[MinIO] ⚠ 端口 ${MINIO_PORT} 已被占用，但健康检查失败`);
      console.log('[MinIO] ⚠ 可能是 MinIO 正在启动中，等待 5 秒后重试...');
      console.log('');
      
      // 等待 5 秒后再次检查
      await new Promise(resolve => setTimeout(resolve, 5000));
      const retryHealthy = await checkMinIOHealth();
      
      if (retryHealthy) {
        const localIP = await getLocalIP();
        console.log(`[MinIO] ✓ MinIO 服务已就绪`);
        console.log('[MinIO] 📍 API (本地): http://localhost:9000');
        console.log('[MinIO] 📍 Console (本地): http://localhost:9001');
        if (localIP && localIP !== 'localhost') {
          console.log(`[MinIO] 📍 API (局域网): http://${localIP}:9000`);
          console.log(`[MinIO] 📍 Console (局域网): http://${localIP}:9001`);
        }
        console.log('');
        
        // 显示局域网访问信息
        await displayNetworkInfo();
        return;
      }
      
      // 仍然不健康，可能是其他服务占用了端口
      console.log('[MinIO] ⚠ 等待后仍无法连接，可能是其他服务占用了端口');
      console.log('[MinIO] ⚠ 将尝试启动新的 MinIO 实例（如果端口冲突，启动会失败）');
      console.log('');
    } else {
      // 端口未被占用，直接启动
      console.log(`[MinIO] 端口 ${MINIO_PORT} 未被占用，准备启动 MinIO 服务...`);
      console.log('');
    }
    
    // 启动 MinIO（必须尝试启动，不能跳过）
    console.log(`[MinIO] 🔄 正在启动 MinIO 服务...`);
    console.log(`[MinIO] 这是自动启动尝试，如果失败请手动启动`);
    
    let minioProcess;
    try {
      minioProcess = startMinIO();
    } catch (startError) {
      console.error('[MinIO] ❌ 启动 MinIO 时发生异常:', startError.message);
      console.error('[MinIO] ❌ 请检查 bin/minio 或 bin/minio.exe 是否存在');
      throw startError;
    }
    
    if (!minioProcess) {
      console.error('[MinIO] ❌ 无法启动 MinIO 进程（startMinIO 返回 null）');
      console.error('[MinIO] ❌ 请手动启动 MinIO');
      return;
    }
    
    console.log('[MinIO] ⏳ 等待 MinIO 服务就绪（最多 30 秒）...');
    
    // 等待 MinIO 真正启动完成（最多 30 秒）
    try {
      await waitForMinIOReady();
      // 额外等待 2 秒，确保服务完全就绪
      console.log('[MinIO] ⏳ 等待服务完全就绪...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('');
      
      const localIP = await getLocalIP();
      console.log('[MinIO] ✅ MinIO 服务已成功启动并可以连接');
      console.log('[MinIO] 📍 API (本地): http://localhost:9000');
      console.log('[MinIO] 📍 Console (本地): http://localhost:9001');
      if (localIP && localIP !== 'localhost') {
        console.log(`[MinIO] 📍 API (局域网): http://${localIP}:9000`);
        console.log(`[MinIO] 📍 Console (局域网): http://${localIP}:9001`);
      }
      console.log('');
      
      // 显示局域网访问信息
      await displayNetworkInfo();
    } catch (error) {
      console.log('');
      console.error('[MinIO] ⚠ 等待 MinIO 启动超时（30秒）');
      console.error('[MinIO] ⚠ 可能的原因：');
      console.error('[MinIO]   1. MinIO 启动失败（检查进程是否还在运行）');
      console.error('[MinIO]   2. 端口被其他服务占用');
      console.error('[MinIO]   3. 网络连接问题');
      console.error('[MinIO] ⚠ Next.js 开发服务器仍会继续启动，但 MinIO 功能可能暂时不可用');
      console.error('[MinIO] ⚠ 请稍后检查 MinIO 服务状态或手动启动');
      console.log('');
    }
    
  } catch (error) {
    console.error('');
    console.error('[MinIO] ❌ 启动过程发生错误:', error.message);
    if (error.stack) {
      console.error('[MinIO] 堆栈:', error.stack);
    }
    console.error('[MinIO] 提示: Next.js 开发服务器仍会继续启动，但 MinIO 功能可能不可用');
    console.error('[MinIO] 您可以使用以下方式手动启动 MinIO:');
    if (isWindows) {
      console.error('[MinIO]   - .\\start-minio-local.bat');
      console.error('[MinIO]   - .\\start-minio.ps1');
      console.error('[MinIO]   - .\\bin\\minio.exe server .\\data\\minio-data --console-address ":9001"');
    } else {
      console.error('[MinIO]   - ./start-minio-local.sh');
      console.error('[MinIO]   - ./bin/minio server ./data/minio-data --console-address ":9001"');
    }
    console.error('[MinIO]   - docker-compose -f docker-compose.minio.yml up -d');
    console.error('');
    // 不阻止 dev 脚本继续运行，但确保错误被记录
    process.exitCode = 0; // 确保不会阻止后续脚本
  }
}

// 确保脚本一定会执行
main().catch((error) => {
  console.error('[MinIO] ❌ 脚本执行失败:', error);
  console.error('[MinIO] 堆栈:', error.stack);
  // 即使失败也不阻止 dev 脚本继续运行
  process.exit(0);
});
