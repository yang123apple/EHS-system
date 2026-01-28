#!/usr/bin/env node
/**
 * 跨平台 MinIO 启动脚本
 * 在 npm run dev 之前自动启动 MinIO（如果未运行）
 */

const { spawn, exec, spawnSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');
const { getLocalIP } = require('./get-local-ip');

const isWindows = os.platform() === 'win32';
const projectRoot = path.join(__dirname, '..');

loadMinioEnv();

const MINIO_PORT = Number.parseInt(process.env.MINIO_PORT || '9000', 10) || 9000;
const MINIO_CONSOLE_PORT = Number.parseInt(process.env.MINIO_CONSOLE_PORT || '9001', 10) || 9001;
const NEXTJS_PORT = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';

/**
 * 加载 .env/.env.local 中的 MINIO 配置
 */
function loadMinioEnv() {
  const explicitEnvKeys = new Set(Object.keys(process.env));
  const envFiles = [path.join(projectRoot, '.env'), path.join(projectRoot, '.env.local')];
  for (const envPath of envFiles) {
    if (!fs.existsSync(envPath)) {
      continue;
    }

    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim().replace(/^\uFEFF/, '');
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const match = trimmed.match(/^([^=#\s]+)\s*=\s*(.*)$/);
      if (!match) {
        continue;
      }

      const key = match[1].trim();
      if (!key.startsWith('MINIO_')) {
        continue;
      }

      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!explicitEnvKeys.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

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
    const protocol = MINIO_USE_SSL ? 'https' : 'http';
    const httpModule = MINIO_USE_SSL ? require('https') : require('http');
    const req = httpModule.get(`${protocol}://localhost:${MINIO_PORT}/minio/health/live`, { timeout: 2000 }, (res) => {
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
  const dataDir = path.join(projectRoot, 'data', 'minio-data');
  
  // 确保数据目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('[MinIO] ✓ 创建数据目录:', dataDir);
  }
  
  // 查找 MinIO 可执行文件
  const command = findMinIOExecutable();
  const args = [
    'server',
    dataDir,
    '--address',
    `:${MINIO_PORT}`,
    '--console-address',
    `:${MINIO_CONSOLE_PORT}`,
  ];
  
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
    console.error(`[MinIO]   3. 端口 ${MINIO_PORT} 是否被其他服务占用`);
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

function isMcCommandAvailable(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

function findMinioClientExecutable() {
  const binDir = path.join(projectRoot, 'bin');
  const localMc = isWindows ? path.join(binDir, 'mc.exe') : path.join(binDir, 'mc');

  if (fs.existsSync(localMc) && isMcCommandAvailable(localMc)) {
    return localMc;
  }

  if (isMcCommandAvailable('mc')) {
    return 'mc';
  }

  return null;
}

function getMcDownloadInfo() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === 'darwin') {
    if (arch === 'arm64') {
      return { url: 'https://dl.min.io/client/mc/release/darwin-arm64/mc', filename: 'mc' };
    }
    return { url: 'https://dl.min.io/client/mc/release/darwin-amd64/mc', filename: 'mc' };
  }

  if (platform === 'linux') {
    if (arch === 'arm64') {
      return { url: 'https://dl.min.io/client/mc/release/linux-arm64/mc', filename: 'mc' };
    }
    return { url: 'https://dl.min.io/client/mc/release/linux-amd64/mc', filename: 'mc' };
  }

  if (platform === 'win32') {
    return { url: 'https://dl.min.io/client/mc/release/windows-amd64/mc.exe', filename: 'mc.exe' };
  }

  return null;
}

function downloadFile(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (redirects >= 5) {
          reject(new Error('下载重定向次数过多'));
          return;
        }
        resolve(downloadFile(response.headers.location, destination, redirects + 1));
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，HTTP 状态码: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destination);
      response.pipe(fileStream);
      fileStream.on('finish', () => fileStream.close(resolve));
      fileStream.on('error', (error) => {
        fs.unlink(destination, () => reject(error));
      });
    });

    request.on('error', reject);
  });
}

function showMcInstallHints() {
  console.log('[MinIO] 提示: 可手动安装 MinIO Client (mc)');
  if (isWindows) {
    console.log('[MinIO]   - 下载: https://dl.min.io/client/mc/release/windows-amd64/mc.exe');
    console.log('[MinIO]   - 放入项目 bin/ 或加入系统 PATH');
  } else if (os.platform() === 'darwin') {
    console.log('[MinIO]   - brew install minio/stable/mc');
    console.log('[MinIO]   - 或运行: bash scripts/download-mc.sh');
  } else {
    console.log('[MinIO]   - wget https://dl.min.io/client/mc/release/linux-amd64/mc');
    console.log('[MinIO]   - chmod +x mc && sudo mv mc /usr/local/bin/');
  }
}

async function ensureMinioClient() {
  console.log('[MinIO] 检查 MinIO Client (mc)...');

  const existingMc = findMinioClientExecutable();
  if (existingMc) {
    console.log(`[MinIO] ✓ MinIO Client 已就绪: ${existingMc}`);
    return existingMc;
  }

  const downloadInfo = getMcDownloadInfo();
  if (!downloadInfo) {
    console.warn('[MinIO] ⚠ 当前平台不支持自动下载 mc');
    showMcInstallHints();
    return null;
  }

  const binDir = path.join(projectRoot, 'bin');
  const targetPath = path.join(binDir, downloadInfo.filename);
  try {
    fs.mkdirSync(binDir, { recursive: true });
    console.log('[MinIO] ⚠ 未检测到 mc，尝试自动下载...');
    await downloadFile(downloadInfo.url, targetPath);
    if (!isWindows) {
      fs.chmodSync(targetPath, '755');
    }

    if (!isMcCommandAvailable(targetPath)) {
      throw new Error('下载的 mc 无法执行');
    }

    console.log(`[MinIO] ✓ MinIO Client 已安装: ${targetPath}`);
    return targetPath;
  } catch (error) {
    console.warn(`[MinIO] ⚠ 自动安装 MinIO Client 失败: ${error.message}`);
    showMcInstallHints();
    return null;
  }
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

async function finalizeStartup() {
  await displayNetworkInfo();
  await ensureMinioClient();
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
      console.log(`[MinIO] 📍 API (本地): http://localhost:${MINIO_PORT}`);
      console.log(`[MinIO] 📍 Console (本地): http://localhost:${MINIO_CONSOLE_PORT}`);
      if (localIP && localIP !== 'localhost') {
        console.log(`[MinIO] 📍 API (局域网): http://${localIP}:${MINIO_PORT}`);
        console.log(`[MinIO] 📍 Console (局域网): http://${localIP}:${MINIO_CONSOLE_PORT}`);
      }
      console.log('');
      
      await finalizeStartup();
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
        console.log(`[MinIO] 📍 API (本地): http://localhost:${MINIO_PORT}`);
        console.log(`[MinIO] 📍 Console (本地): http://localhost:${MINIO_CONSOLE_PORT}`);
        if (localIP && localIP !== 'localhost') {
          console.log(`[MinIO] 📍 API (局域网): http://${localIP}:${MINIO_PORT}`);
          console.log(`[MinIO] 📍 Console (局域网): http://${localIP}:${MINIO_CONSOLE_PORT}`);
        }
        console.log('');
        
        await finalizeStartup();
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
      console.log(`[MinIO] 📍 API (本地): http://localhost:${MINIO_PORT}`);
      console.log(`[MinIO] 📍 Console (本地): http://localhost:${MINIO_CONSOLE_PORT}`);
      if (localIP && localIP !== 'localhost') {
        console.log(`[MinIO] 📍 API (局域网): http://${localIP}:${MINIO_PORT}`);
        console.log(`[MinIO] 📍 Console (局域网): http://${localIP}:${MINIO_CONSOLE_PORT}`);
      }
      console.log('');
      
      await finalizeStartup();
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
      console.error(`[MinIO]   - .\\bin\\minio.exe server .\\data\\minio-data --console-address ":${MINIO_CONSOLE_PORT}"`);
    } else {
      console.error('[MinIO]   - ./start-minio-local.sh');
      console.error(`[MinIO]   - ./bin/minio server ./data/minio-data --console-address ":${MINIO_CONSOLE_PORT}"`);
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
