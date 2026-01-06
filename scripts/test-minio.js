/**
 * MinIO 连接测试脚本
 * 用于验证 MinIO 服务是否正常运行
 */

require('dotenv').config({ path: '.env.local' });
const { minioService } = require('../src/lib/minio');

async function testMinIO() {
  console.log('========================================');
  console.log('🔍 MinIO 连接测试');
  console.log('========================================\n');

  // 检查环境变量
  console.log('1. 检查环境变量...');
  const hasConfig = 
    process.env.MINIO_ENDPOINT || 
    process.env.MINIO_ACCESS_KEY || 
    process.env.MINIO_SECRET_KEY;
  
  if (!hasConfig) {
    console.log('❌ MinIO 配置未找到');
    console.log('   请配置环境变量: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY');
    process.exit(1);
  }
  
  console.log('✅ 环境变量配置存在');
  console.log(`   端点: ${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`);
  console.log(`   访问密钥: ${process.env.MINIO_ACCESS_KEY ? '已配置' : '未配置'}`);
  console.log('');

  // 测试连接
  console.log('2. 测试 MinIO 连接...');
  try {
    await minioService.initialize();
    console.log('✅ MinIO 连接成功\n');
  } catch (error) {
    console.log('❌ MinIO 连接失败:', error.message);
    console.log('\n可能的原因:');
    console.log('  1. MinIO 服务未启动');
    console.log('    启动命令: docker-compose -f docker-compose.minio.yml up -d');
    console.log('  2. 网络连接问题');
    console.log('  3. 认证信息错误');
    process.exit(1);
  }

  // 列出 Buckets
  console.log('3. 检查 Buckets...');
  try {
    const client = minioService.getClient();
    const buckets = await client.listBuckets();
    
    console.log(`✅ 找到 ${buckets.length} 个 Buckets:`);
    buckets.forEach(bucket => {
      console.log(`   • ${bucket.name} (创建于: ${bucket.creationDate})`);
    });
    console.log('');

    // 检查必需的 Buckets
    const requiredBuckets = ['ehs-private', 'ehs-public'];
    const existingBuckets = buckets.map(b => b.name);
    const missingBuckets = requiredBuckets.filter(b => !existingBuckets.includes(b));
    
    if (missingBuckets.length > 0) {
      console.log('⚠️  缺少必需的 Buckets:');
      missingBuckets.forEach(b => console.log(`   • ${b}`));
      console.log('   这些 Buckets 将在首次使用时自动创建');
    } else {
      console.log('✅ 所有必需的 Buckets 已存在');
    }
  } catch (error) {
    console.log('❌ 检查 Buckets 失败:', error.message);
  }

  console.log('\n========================================');
  console.log('✅ MinIO 测试完成');
  console.log('========================================');
  
  process.exit(0);
}

testMinIO().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});

