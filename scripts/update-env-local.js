#!/usr/bin/env node
/**
 * 自动更新 .env.local 文件中的 MinIO 配置
 * 在 npm run dev 启动时自动检测本机 IP 并更新配置
 */

const fs = require('fs');
const path = require('path');
const { getLocalIP } = require('./get-local-ip');

/**
 * 更新 .env.local 文件中的 MinIO 配置
 */
async function updateEnvLocal() {
  const projectRoot = process.cwd();
  const envLocalPath = path.join(projectRoot, '.env.local');
  
  try {
    // 获取本机 IP 地址
    const localIP = await getLocalIP();
    console.log(`[配置] 检测到本机 IP 地址: ${localIP}`);
    
    // 读取现有的 .env.local 文件
    let envContent = '';
    if (fs.existsSync(envLocalPath)) {
      envContent = fs.readFileSync(envLocalPath, 'utf-8');
    }
    
    // MinIO 配置
    const minioConfig = {
      'MINIO_ENDPOINT': localIP,
      'MINIO_PORT': '9000',
      'MINIO_USE_SSL': 'false',
      'MINIO_ACCESS_KEY': 'admin',
      'MINIO_SECRET_KEY': 'change-me-now',
      'MINIO_ROOT_USER': 'admin',
      'MINIO_ROOT_PASSWORD': 'change-me-now',
      'MINIO_PRIMARY_ENDPOINT': `http://${localIP}:9000`,
      'MINIO_PRIMARY_ACCESS_KEY': 'admin',
      'MINIO_PRIMARY_SECRET_KEY': 'change-me-now',
    };
    
    // 解析现有的环境变量，建立变量名到行索引的映射
    const lines = envContent.split('\n');
    const varIndexMap = new Map(); // key -> lineIndex
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // 解析 KEY=VALUE 格式（忽略注释和空行）
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=#\s]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          varIndexMap.set(key, i);
        }
      }
    }
    
    // 更新或添加 MinIO 配置
    let hasMinioConfig = false;
    for (const [key, value] of Object.entries(minioConfig)) {
      if (varIndexMap.has(key)) {
        // 更新现有配置
        const index = varIndexMap.get(key);
        lines[index] = `${key}=${value}`;
        hasMinioConfig = true;
      } else {
        // 添加新配置到文件末尾
        lines.push(`${key}=${value}`);
        hasMinioConfig = true;
      }
    }
    
    // 如果添加了 MinIO 配置但没有配置区块注释，添加注释
    if (hasMinioConfig && !envContent.includes('# MinIO 对象存储配置')) {
      // 找到第一个 MinIO 配置的位置，在前面插入注释
      let firstMinioIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^(MINIO_\w+)\s*=/);
        if (match) {
          firstMinioIndex = i;
          break;
        }
      }
      
      if (firstMinioIndex !== -1) {
        lines.splice(firstMinioIndex, 0, '# MinIO 对象存储配置（自动更新）', '');
      } else {
        // 如果找不到，添加到文件末尾
        lines.push('');
        lines.push('# MinIO 对象存储配置（自动更新）');
      }
    }
    
    // 写入文件
    const newContent = lines.join('\n');
    fs.writeFileSync(envLocalPath, newContent, 'utf-8');
    
    console.log(`[配置] ✅ 已更新 .env.local 文件`);
    console.log(`[配置]   MinIO Endpoint: ${localIP}:9000`);
    
    return localIP;
  } catch (error) {
    console.error('[配置] ❌ 更新 .env.local 失败:', error.message);
    // 不抛出错误，允许继续启动
    return 'localhost';
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  updateEnvLocal().then(ip => {
    process.exit(0);
  }).catch(err => {
    console.error('更新配置失败:', err);
    process.exit(1);
  });
}

module.exports = { updateEnvLocal };
