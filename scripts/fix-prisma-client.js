// 修复 Prisma 客户端缓存问题
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复 Prisma 客户端...\n');

// 1. 删除 node_modules/.prisma 和 node_modules/@prisma/client
const prismaPath = path.join(process.cwd(), 'node_modules', '.prisma');
const prismaClientPath = path.join(process.cwd(), 'node_modules', '@prisma', 'client');

try {
  if (fs.existsSync(prismaPath)) {
    console.log('📁 删除旧的 Prisma 客户端缓存...');
    fs.rmSync(prismaPath, { recursive: true, force: true });
    console.log('✅ 已删除 node_modules/.prisma\n');
  }
  
  if (fs.existsSync(prismaClientPath)) {
    fs.rmSync(prismaClientPath, { recursive: true, force: true });
    console.log('✅ 已删除 node_modules/@prisma/client\n');
  }
} catch (error) {
  console.error('⚠️  删除缓存时出错（可能不存在）:', error.message);
}

// 2. 重新安装 @prisma/client
console.log('📦 重新安装 @prisma/client...');
try {
  execSync('npm install @prisma/client', { stdio: 'inherit' });
  console.log('✅ @prisma/client 安装成功\n');
} catch (error) {
  console.error('❌ 安装失败:', error.message);
  process.exit(1);
}

// 3. 生成 Prisma 客户端
console.log('🔨 生成 Prisma 客户端...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('\n✅ Prisma 客户端生成成功\n');
} catch (error) {
  console.error('❌ 生成失败:', error.message);
  process.exit(1);
}

console.log('🎉 Prisma 客户端修复完成！');
console.log('💡 请重启开发服务器以应用更改。\n');
