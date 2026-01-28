#!/usr/bin/env node
/**
 * 自动更新 .env/.env.local 文件中的 MinIO 配置
 * 在 npm run dev 启动时自动检测本机 IP 并更新配置
 */

const fs = require('fs');
const path = require('path');
const { getLocalIP } = require('./get-local-ip');

const ENV_FILES = ['.env.local', '.env'];
const MINIO_DEFAULTS = {
  MINIO_PORT: '9000',
  MINIO_USE_SSL: 'false',
  MINIO_ACCESS_KEY: 'admin',
  MINIO_SECRET_KEY: 'change-me-now',
  MINIO_ROOT_USER: 'admin',
  MINIO_ROOT_PASSWORD: 'change-me-now',
  MINIO_PRIMARY_ACCESS_KEY: 'admin',
  MINIO_PRIMARY_SECRET_KEY: 'change-me-now',
  MINIO_BACKUP_TARGET: './data/minio-backup',
};

function normalizeValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvContent(content) {
  const lines = content.split('\n');
  const varIndexMap = new Map();
  const valueMap = new Map();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim().replace(/^\uFEFF/, '');
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = trimmed.match(/^([^=#\s]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    const value = normalizeValue(match[2] || '');
    varIndexMap.set(key, i);
    valueMap.set(key, value);
  }

  return { lines, varIndexMap, valueMap };
}

function buildMinioConfig(existingValues, localIP) {
  const minioPort = existingValues.get('MINIO_PORT') || MINIO_DEFAULTS.MINIO_PORT;
  const accessKey =
    existingValues.get('MINIO_ACCESS_KEY') ||
    existingValues.get('MINIO_ROOT_USER') ||
    MINIO_DEFAULTS.MINIO_ACCESS_KEY;
  const secretKey =
    existingValues.get('MINIO_SECRET_KEY') ||
    existingValues.get('MINIO_ROOT_PASSWORD') ||
    MINIO_DEFAULTS.MINIO_SECRET_KEY;

  return {
    MINIO_ENDPOINT: localIP,
    MINIO_PORT: minioPort,
    MINIO_USE_SSL: existingValues.get('MINIO_USE_SSL') || MINIO_DEFAULTS.MINIO_USE_SSL,
    MINIO_ACCESS_KEY: accessKey,
    MINIO_SECRET_KEY: secretKey,
    MINIO_ROOT_USER: existingValues.get('MINIO_ROOT_USER') || accessKey,
    MINIO_ROOT_PASSWORD: existingValues.get('MINIO_ROOT_PASSWORD') || secretKey,
    MINIO_PRIMARY_ENDPOINT: `http://${localIP}:${minioPort}`,
    MINIO_PRIMARY_ACCESS_KEY:
      existingValues.get('MINIO_PRIMARY_ACCESS_KEY') || accessKey,
    MINIO_PRIMARY_SECRET_KEY:
      existingValues.get('MINIO_PRIMARY_SECRET_KEY') || secretKey,
    MINIO_BACKUP_TARGET:
      existingValues.get('MINIO_BACKUP_TARGET') || MINIO_DEFAULTS.MINIO_BACKUP_TARGET,
  };
}

function updateEnvFile(envPath, localIP) {
  const envExists = fs.existsSync(envPath);
  const envContent = envExists ? fs.readFileSync(envPath, 'utf-8') : '';
  const { lines, varIndexMap, valueMap } = parseEnvContent(envContent);
  const minioConfig = buildMinioConfig(valueMap, localIP);

  let hasChanges = false;
  for (const [key, value] of Object.entries(minioConfig)) {
    const newLine = `${key}=${value}`;
    if (varIndexMap.has(key)) {
      const index = varIndexMap.get(key);
      if (lines[index] !== newLine) {
        lines[index] = newLine;
        hasChanges = true;
      }
    } else {
      lines.push(newLine);
      hasChanges = true;
    }
  }

  const commentTag = '# MinIO 对象存储配置（自动更新）';
  const hasComment = lines.some(line => line.includes(commentTag));
  if (!hasComment) {
    let firstMinioIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const cleaned = lines[i].trim().replace(/^\uFEFF/, '');
      if (/^MINIO_\w+\s*=/.test(cleaned)) {
        firstMinioIndex = i;
        break;
      }
    }

    if (firstMinioIndex !== -1) {
      lines.splice(firstMinioIndex, 0, commentTag, '');
    } else {
      lines.push('', commentTag);
    }
    hasChanges = true;
  }

  if (hasChanges || !envExists) {
    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
  }

  return { updated: hasChanges || !envExists, minioPort: minioConfig.MINIO_PORT };
}

/**
 * 更新 .env/.env.local 文件中的 MinIO 配置
 */
async function updateEnvLocal() {
  const projectRoot = process.cwd();
  const localIP = await getLocalIP();
  console.log(`[配置] 检测到本机 IP 地址: ${localIP}`);

  let minioPort = MINIO_DEFAULTS.MINIO_PORT;
  for (const file of ENV_FILES) {
    const envPath = path.join(projectRoot, file);
    const result = updateEnvFile(envPath, localIP);
    if (result.updated) {
      console.log(`[配置] ✅ 已更新 ${file}`);
    }
    minioPort = result.minioPort || minioPort;
  }

  console.log(`[配置]   MinIO Endpoint: ${localIP}:${minioPort}`);
  return localIP;
}

// 如果直接运行此脚本
if (require.main === module) {
  updateEnvLocal()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('更新配置失败:', err);
      process.exit(1);
    });
}

module.exports = { updateEnvLocal };
