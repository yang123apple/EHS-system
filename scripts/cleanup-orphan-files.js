/**
 * 清理 MinIO 孤儿文件脚本
 * 
 * 问题：用户上传文件到 MinIO 但没有提交表单保存到数据库，会产生垃圾文件
 * 
 * 策略：
 * 1. 扫描 temp/ 目录下的文件（超过 24 小时未移动/重命名）
 * 2. 扫描所有文件，检查是否在数据库中被引用
 * 3. 删除未被引用的文件
 * 
 * 使用方法：
 *   node scripts/cleanup-orphan-files.js [--dry-run] [--temp-only]
 * 
 * 参数：
 *   --dry-run: 仅报告，不实际删除
 *   --temp-only: 只清理 temp/ 目录下的文件
 */

const { PrismaClient } = require('@prisma/client');
const { Client } = require('minio');
const path = require('path');
const fs = require('fs');

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

// 临时文件过期时间（24 小时）
const TEMP_FILE_EXPIRY_HOURS = 24;
const TEMP_FILE_EXPIRY_MS = TEMP_FILE_EXPIRY_HOURS * 60 * 60 * 1000;

// 命令行参数
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TEMP_ONLY = args.includes('--temp-only');

/**
 * 初始化 MinIO Client
 */
function createMinIOClient() {
  return new Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: MINIO_USE_SSL,
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY,
  });
}

/**
 * 从数据库记录解析对象键
 */
function parseObjectKeyFromDbRecord(dbRecord) {
  if (!dbRecord) return null;
  
  // 格式: "bucket:key"
  if (dbRecord.includes(':')) {
    const [, ...keyParts] = dbRecord.split(':');
    return keyParts.join(':');
  }
  
  // 旧格式: "/uploads/..."
  if (dbRecord.startsWith('/uploads/')) {
    return dbRecord.replace('/uploads/', '');
  }
  
  // 假设是 key
  return dbRecord;
}

/**
 * 获取数据库中所有引用的文件
 */
async function getReferencedFiles() {
  const referencedFiles = new Set();
  
  try {
    // 查询所有可能包含文件引用的表
    const queries = [
      // TrainingMaterial
      prisma.trainingMaterial.findMany({
        select: { url: true },
      }),
      // Document (如果使用 MinIO)
      prisma.document.findMany({
        select: { docxPath: true },
      }),
      // FileMetadata
      prisma.fileMetadata.findMany({
        select: { filePath: true },
      }),
    ];
    
    const results = await Promise.all(queries);
    
    // 提取所有文件路径
    results.forEach((records) => {
      records.forEach((record) => {
        const url = record.url || record.docxPath || record.filePath;
        if (url) {
          const objectKey = parseObjectKeyFromDbRecord(url);
          if (objectKey) {
            referencedFiles.add(objectKey);
          }
        }
      });
    });
    
    console.log(`✓ 从数据库加载 ${referencedFiles.size} 个文件引用`);
    return referencedFiles;
  } catch (error) {
    console.error('❌ 查询数据库失败:', error);
    throw error;
  }
}

/**
 * 清理 temp/ 目录下的过期文件
 */
async function cleanupTempFiles(client, bucket, referencedFiles) {
  console.log(`\n📁 扫描 ${bucket}/temp/ 目录...`);
  
  const tempPrefix = 'temp/';
  const objectsList = [];
  const stream = client.listObjects(bucket, tempPrefix, true);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      objectsList.push(obj);
    });
    
    stream.on('end', async () => {
      console.log(`   找到 ${objectsList.length} 个临时文件`);
      
      let deletedCount = 0;
      let skippedCount = 0;
      const now = Date.now();
      
      for (const obj of objectsList) {
        try {
          // 获取文件信息
          const stat = await client.statObject(bucket, obj.name);
          const fileAge = now - stat.lastModified.getTime();
          
          // 检查是否过期
          if (fileAge > TEMP_FILE_EXPIRY_MS) {
            // 检查是否被数据库引用
            const objectKey = obj.name;
            if (referencedFiles.has(objectKey)) {
              console.log(`   ⏭️  跳过（已引用）: ${objectKey}`);
              skippedCount++;
              continue;
            }
            
            if (DRY_RUN) {
              console.log(`   [DRY-RUN] 将删除: ${objectKey} (${(fileAge / 1000 / 60 / 60).toFixed(2)} 小时前)`);
            } else {
              await client.removeObject(bucket, objectKey);
              console.log(`   🗑️  已删除: ${objectKey} (${(fileAge / 1000 / 60 / 60).toFixed(2)} 小时前)`);
            }
            deletedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.error(`   ❌ 处理文件失败: ${obj.name}`, error.message);
        }
      }
      
      console.log(`   ✓ 完成: 删除 ${deletedCount} 个，跳过 ${skippedCount} 个`);
      resolve({ deletedCount, skippedCount });
    });
    
    stream.on('error', reject);
  });
}

/**
 * 清理所有未被引用的文件（全量扫描）
 */
async function cleanupOrphanFiles(client, bucket, referencedFiles) {
  console.log(`\n📁 扫描 ${bucket} 所有文件...`);
  
  const objectsList = [];
  const stream = client.listObjects(bucket, '', true);
  
  return new Promise((resolve, reject) => {
    stream.on('data', (obj) => {
      objectsList.push(obj);
    });
    
    stream.on('end', async () => {
      console.log(`   找到 ${objectsList.length} 个文件`);
      
      let deletedCount = 0;
      let referencedCount = 0;
      
      for (const obj of objectsList) {
        try {
          const objectKey = obj.name;
          
          // 跳过 temp/ 目录（已单独处理）
          if (objectKey.startsWith('temp/')) {
            continue;
          }
          
          // 检查是否被数据库引用
          if (referencedFiles.has(objectKey)) {
            referencedCount++;
            continue;
          }
          
          if (DRY_RUN) {
            console.log(`   [DRY-RUN] 将删除（未引用）: ${objectKey}`);
          } else {
            await client.removeObject(bucket, objectKey);
            console.log(`   🗑️  已删除（未引用）: ${objectKey}`);
          }
          deletedCount++;
        } catch (error) {
          console.error(`   ❌ 处理文件失败: ${obj.name}`, error.message);
        }
      }
      
      console.log(`   ✓ 完成: 删除 ${deletedCount} 个，引用 ${referencedCount} 个`);
      resolve({ deletedCount, referencedCount });
    });
    
    stream.on('error', reject);
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('MinIO 孤儿文件清理脚本');
  console.log('========================================');
  console.log(`模式: ${DRY_RUN ? 'DRY-RUN（仅报告）' : '实际删除'}`);
  console.log(`范围: ${TEMP_ONLY ? '仅 temp/ 目录' : '全量扫描'}`);
  console.log('');
  
  try {
    // 初始化 MinIO Client
    const client = createMinIOClient();
    
    // 测试连接
    await client.listBuckets();
    console.log('✓ MinIO 连接成功');
    
    // 获取数据库引用的文件
    const referencedFiles = await getReferencedFiles();
    
    const results = {
      private: { temp: { deleted: 0, skipped: 0 }, orphan: { deleted: 0, referenced: 0 } },
      public: { temp: { deleted: 0, skipped: 0 }, orphan: { deleted: 0, referenced: 0 } },
    };
    
    // 清理私有 Bucket
    console.log('\n========================================');
    console.log('清理私有 Bucket (ehs-private)');
    console.log('========================================');
    
    // 清理 temp/ 目录
    const privateTempResult = await cleanupTempFiles(client, BUCKETS.PRIVATE, referencedFiles);
    results.private.temp = privateTempResult;
    
    // 清理孤儿文件（如果不是仅清理 temp）
    if (!TEMP_ONLY) {
      const privateOrphanResult = await cleanupOrphanFiles(client, BUCKETS.PRIVATE, referencedFiles);
      results.private.orphan = privateOrphanResult;
    }
    
    // 清理公开 Bucket
    console.log('\n========================================');
    console.log('清理公开 Bucket (ehs-public)');
    console.log('========================================');
    
    // 清理 temp/ 目录
    const publicTempResult = await cleanupTempFiles(client, BUCKETS.PUBLIC, referencedFiles);
    results.public.temp = publicTempResult;
    
    // 清理孤儿文件（如果不是仅清理 temp）
    if (!TEMP_ONLY) {
      const publicOrphanResult = await cleanupOrphanFiles(client, BUCKETS.PUBLIC, referencedFiles);
      results.public.orphan = publicOrphanResult;
    }
    
    // 输出总结
    console.log('\n========================================');
    console.log('清理总结');
    console.log('========================================');
    console.log('私有 Bucket:');
    console.log(`  temp/ 目录: 删除 ${results.private.temp.deleted} 个，跳过 ${results.private.temp.skipped} 个`);
    if (!TEMP_ONLY) {
      console.log(`  孤儿文件: 删除 ${results.private.orphan.deleted} 个，引用 ${results.private.orphan.referenced} 个`);
    }
    console.log('公开 Bucket:');
    console.log(`  temp/ 目录: 删除 ${results.public.temp.deleted} 个，跳过 ${results.public.temp.skipped} 个`);
    if (!TEMP_ONLY) {
      console.log(`  孤儿文件: 删除 ${results.public.orphan.deleted} 个，引用 ${results.public.orphan.referenced} 个`);
    }
    
    const totalDeleted = 
      results.private.temp.deleted + results.private.orphan.deleted +
      results.public.temp.deleted + results.public.orphan.deleted;
    
    console.log(`\n总计删除: ${totalDeleted} 个文件`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY-RUN 模式，未实际删除文件');
      console.log('   运行时不加 --dry-run 参数以实际删除');
    }
    
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ 清理失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行主函数
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { cleanupTempFiles, cleanupOrphanFiles };

