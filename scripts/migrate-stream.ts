/**
 * 流式迁移脚本
 * 将旧文件系统（public/uploads）迁移到 MinIO
 * 
 * 使用流式处理避免内存溢出，适合 GB 级大文件
 * 
 * 使用方法：
 *   npx tsx scripts/migrate-stream.ts [--dry-run] [--batch-size=100]
 * 
 * 参数：
 *   --dry-run: 仅报告，不实际上传
 *   --batch-size: 批量处理大小（默认 100）
 */

import { PrismaClient } from '@prisma/client';
import { Client } from 'minio';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const prisma = new PrismaClient();

// 配置
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || process.env.MINIO_ROOT_USER || 'admin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || 'change-me-now';

const BUCKETS = {
  PRIVATE: 'ehs-private',
  PUBLIC: 'ehs-public',
};

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100', 10);
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * 初始化 MinIO Client
 */
function createMinIOClient(): Client {
  return new Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
  });
}

/**
 * 递归获取所有文件（流式处理）
 */
function* getAllFiles(dirPath: string, basePath: string = ''): Generator<{ filePath: string; relativePath: string; stat: fs.Stats }> {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relativePath = path.join(basePath, item).replace(/\\/g, '/');
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // 递归处理子目录
      yield* getAllFiles(fullPath, relativePath);
    } else if (stat.isFile()) {
      yield { filePath: fullPath, relativePath, stat };
    }
  }
}

/**
 * 流式上传文件到 MinIO
 */
async function uploadFileStream(
  client: Client,
  bucket: string,
  objectName: string,
  filePath: string
): Promise<{ success: boolean; size: number; error?: string }> {
  try {
    // 创建文件读取流
    const fileStream = fs.createReadStream(filePath);
    
    // 获取文件大小
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // 上传到 MinIO（流式传输，不加载到内存）
    await client.putObject(bucket, objectName, fileStream, fileSize, {
      'Content-Type': getContentType(filePath),
    });
    
    return { success: true, size: fileSize };
  } catch (error: any) {
    return { success: false, size: 0, error: error.message };
  }
}

/**
 * 根据文件扩展名获取 Content-Type
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * 确定文件应该存储到哪个 Bucket
 */
function determineBucket(relativePath: string): 'private' | 'public' {
  // 根据路径判断
  if (relativePath.includes('inspection') || relativePath.includes('report')) {
    return 'private';
  }
  if (relativePath.includes('training') || relativePath.includes('docs')) {
    return 'public';
  }
  // 默认公开
  return 'public';
}

/**
 * 更新数据库记录
 */
async function updateDatabaseRecord(
  oldPath: string,
  newDbRecord: string,
  tableName: 'trainingMaterial' | 'document' | 'fileMetadata'
): Promise<boolean> {
  try {
    // 根据表名更新不同的字段
    if (tableName === 'trainingMaterial') {
      await prisma.trainingMaterial.updateMany({
        where: { url: oldPath },
        data: { url: newDbRecord },
      });
    } else if (tableName === 'document') {
      await prisma.document.updateMany({
        where: { docxPath: oldPath },
        data: { docxPath: newDbRecord },
      });
    } else if (tableName === 'fileMetadata') {
      await prisma.fileMetadata.updateMany({
        where: { filePath: oldPath },
        data: { filePath: newDbRecord },
      });
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ 更新数据库失败: ${oldPath}`, error);
    return false;
  }
}

/**
 * 查找数据库中的引用
 */
async function findDatabaseReferences(relativePath: string): Promise<Array<{ table: string; field: string; id?: string }>> {
  const references: Array<{ table: string; field: string; id?: string }> = [];
  const oldPath = `/uploads/${relativePath}`;
  
  // 检查各个表
  const trainingMaterials = await prisma.trainingMaterial.findMany({
    where: { url: oldPath },
    select: { id: true },
  });
  trainingMaterials.forEach(m => {
    references.push({ table: 'trainingMaterial', field: 'url', id: m.id });
  });
  
  const documents = await prisma.document.findMany({
    where: { docxPath: oldPath },
    select: { id: true },
  });
  documents.forEach(d => {
    references.push({ table: 'document', field: 'docxPath', id: d.id });
  });
  
  const fileMetadata = await prisma.fileMetadata.findMany({
    where: { filePath: oldPath },
    select: { id: true },
  });
  fileMetadata.forEach(f => {
    references.push({ table: 'fileMetadata', field: 'filePath', id: f.id });
  });
  
  return references;
}

/**
 * 主迁移函数
 */
async function migrateFiles() {
  console.log('========================================');
  console.log('流式文件迁移脚本');
  console.log('========================================');
  console.log(`模式: ${DRY_RUN ? 'DRY-RUN（仅报告）' : '实际上传'}`);
  console.log(`批量大小: ${BATCH_SIZE}`);
  console.log(`源目录: ${UPLOADS_DIR}`);
  console.log('');
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('❌ 上传目录不存在:', UPLOADS_DIR);
    return;
  }
  
  const client = createMinIOClient();
  
  // 测试连接
  try {
    await client.listBuckets();
    console.log('✓ MinIO 连接成功');
  } catch (error) {
    console.error('❌ MinIO 连接失败:', error);
    return;
  }
  
  const stats = {
    total: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    updated: 0,
    totalSize: 0,
  };
  
  const batch: Array<{ filePath: string; relativePath: string; stat: fs.Stats }> = [];
  
  console.log('\n开始扫描文件...\n');
  
  // 流式处理文件（使用生成器避免内存溢出）
  for (const file of getAllFiles(UPLOADS_DIR)) {
    stats.total++;
    batch.push(file);
    
    // 批量处理
    if (batch.length >= BATCH_SIZE) {
      await processBatch(client, batch, stats);
      batch.length = 0; // 清空批次
    }
  }
  
  // 处理剩余文件
  if (batch.length > 0) {
    await processBatch(client, batch, stats);
  }
  
  // 输出总结
  console.log('\n========================================');
  console.log('迁移总结');
  console.log('========================================');
  console.log(`总文件数: ${stats.total}`);
  console.log(`上传成功: ${stats.uploaded}`);
  console.log(`跳过: ${stats.skipped}`);
  console.log(`失败: ${stats.failed}`);
  console.log(`数据库更新: ${stats.updated}`);
  console.log(`总大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('========================================\n');
}

/**
 * 批量处理文件
 */
async function processBatch(
  client: Client,
  batch: Array<{ filePath: string; relativePath: string; stat: fs.Stats }>,
  stats: {
    total: number;
    uploaded: number;
    skipped: number;
    failed: number;
    updated: number;
    totalSize: number;
  }
) {
  for (const file of batch) {
    try {
      const { filePath, relativePath, stat } = file;
      
      // 确定存储桶
      const bucketType = determineBucket(relativePath);
      const bucket = bucketType === 'private' ? BUCKETS.PRIVATE : BUCKETS.PUBLIC;
      
      // 生成对象键（保持原有目录结构）
      const objectName = relativePath;
      
      // 检查文件是否已存在
      try {
        await client.statObject(bucket, objectName);
        console.log(`   ⏭️  跳过（已存在）: ${relativePath}`);
        stats.skipped++;
        continue;
      } catch (error: any) {
        if (error.code !== 'NotFound') {
          throw error;
        }
        // 文件不存在，继续上传
      }
      
      if (DRY_RUN) {
        console.log(`   [DRY-RUN] 将上传: ${relativePath} -> ${bucket}/${objectName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
        stats.uploaded++;
        stats.totalSize += stat.size;
      } else {
        // 流式上传
        const result = await uploadFileStream(client, bucket, objectName, filePath);
        
        if (result.success) {
          console.log(`   ✓ 上传成功: ${relativePath} (${(result.size / 1024 / 1024).toFixed(2)} MB)`);
          stats.uploaded++;
          stats.totalSize += result.size;
          
          // 查找数据库引用并更新
          const references = await findDatabaseReferences(relativePath);
          if (references.length > 0) {
            const newDbRecord = `${bucketType}:${objectName}`;
            const oldPath = `/uploads/${relativePath}`;
            
            for (const ref of references) {
              const updated = await updateDatabaseRecord(
                oldPath,
                newDbRecord,
                ref.table as 'trainingMaterial' | 'document' | 'fileMetadata'
              );
              if (updated) {
                stats.updated++;
                console.log(`     ✓ 更新数据库: ${ref.table}.${ref.field}`);
              }
            }
          }
        } else {
          console.error(`   ❌ 上传失败: ${relativePath} - ${result.error}`);
          stats.failed++;
        }
      }
    } catch (error: any) {
      console.error(`   ❌ 处理失败: ${file.relativePath} - ${error.message}`);
      stats.failed++;
    }
  }
}

// 运行主函数
if (require.main === module) {
  migrateFiles()
    .then(() => {
      console.log('✅ 迁移完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移失败:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { migrateFiles, processBatch };

