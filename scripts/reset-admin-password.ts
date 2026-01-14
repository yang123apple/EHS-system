/**
 * 重置 admin 用户密码脚本
 * 
 * 功能：将 admin 用户的密码重置为 "admin" 的 bcrypt 哈希
 * 
 * 使用方法：
 * npx tsx scripts/reset-admin-password.ts
 */

import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function resetAdminPassword() {
  console.log('🔐 重置 admin 用户密码\n');
  console.log('='.repeat(50));
  console.log('');

  try {
    // 1. 查找 admin 用户
    console.log('📋 正在查找 admin 用户...');
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (!admin) {
      console.log('❌ 未找到 admin 用户！');
      console.log('💡 提示：请先运行数据库种子脚本创建 admin 用户');
      console.log('   命令：npx prisma db seed');
      return;
    }

    console.log(`✅ 找到 admin 用户: ${admin.name} (ID: ${admin.id})\n`);

    // 2. 检查当前密码状态
    const isBcryptHash = admin.password.startsWith('$2a$') || admin.password.startsWith('$2b$');
    console.log(`当前密码状态: ${isBcryptHash ? '已加密 (bcrypt)' : '明文或格式错误'}`);
    console.log(`当前密码值: ${admin.password.substring(0, 20)}${admin.password.length > 20 ? '...' : ''}\n`);

    // 3. 生成新的密码哈希
    console.log('🔒 正在生成新的密码哈希...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin', salt);
    console.log('✅ 密码哈希生成成功\n');

    // 4. 更新数据库
    console.log('💾 正在更新数据库...');
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedPassword }
    });
    console.log('✅ 数据库更新成功\n');

    // 5. 验证新密码
    console.log('🔍 正在验证新密码...');
    const verifyUser = await prisma.user.findUnique({
      where: { id: admin.id },
      select: { password: true }
    });

    if (verifyUser) {
      const isValid = await bcrypt.compare('admin', verifyUser.password);
      if (isValid) {
        console.log('✅ 密码验证通过！现在可以使用 admin/admin 登录了\n');
      } else {
        console.log('❌ 密码验证失败！请检查代码\n');
      }
    }

    console.log('='.repeat(50));
    console.log('✨ 重置完成！');
    console.log('');
    console.log('📝 登录信息：');
    console.log('   用户名: admin');
    console.log('   密码: admin');
    console.log('');

  } catch (error) {
    console.error('\n❌ 重置过程中发生错误:', error);
    console.log('\n请检查：');
    console.log('1. 数据库连接是否正常');
    console.log('2. Prisma Client 是否已生成 (npm run postinstall)');
    console.log('3. 是否有足够的数据库权限');
    process.exit(1);
  }
}

// 执行
resetAdminPassword()
  .catch((error) => {
    console.error('💥 未预期的错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

