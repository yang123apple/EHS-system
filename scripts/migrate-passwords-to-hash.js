/**
 * 密码迁移脚本：将现有的明文密码迁移为 bcrypt 哈希密码
 * 
 * 使用方法:
 * node scripts/migrate-passwords-to-hash.js
 * 
 * 功能:
 * 1. 读取所有用户记录
 * 2. 检测密码是否已加密（通过检查 bcrypt hash 前缀 $2a$ 或 $2b$）
 * 3. 对未加密的密码进行 bcrypt 哈希加密
 * 4. 更新数据库
 * 5. 生成详细的迁移报告
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function migratePasswords() {
  console.log('🔐 开始密码迁移...\n');

  try {
    // 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        password: true
      }
    });

    console.log(`📊 共找到 ${users.length} 个用户\n`);

    let migratedCount = 0;
    let alreadyHashedCount = 0;
    let noPasswordCount = 0;
    const errors = [];

    // 逐个处理用户
    for (const user of users) {
      try {
        // 检查是否有密码
        if (!user.password) {
          noPasswordCount++;
          console.log(`⏭️  跳过: ${user.username} (${user.name}) - 无密码 (OAuth用户)`);
          continue;
        }

        // 检查密码是否已经是 bcrypt hash
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          alreadyHashedCount++;
          console.log(`✅ 已加密: ${user.username} (${user.name})`);
          continue;
        }

        // 密码是明文，需要加密
        const plainPassword = user.password;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);

        // 更新数据库
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });

        migratedCount++;
        console.log(`🔄 已迁移: ${user.username} (${user.name}) - 原密码: ${plainPassword}`);

      } catch (error) {
        errors.push({
          user: `${user.username} (${user.name})`,
          error: error.message
        });
        console.error(`❌ 错误: ${user.username} (${user.name}) - ${error.message}`);
      }
    }

    // 输出汇总报告
    console.log('\n' + '='.repeat(60));
    console.log('📋 迁移报告');
    console.log('='.repeat(60));
    console.log(`总用户数:        ${users.length}`);
    console.log(`已迁移:          ${migratedCount}`);
    console.log(`已加密(跳过):    ${alreadyHashedCount}`);
    console.log(`无密码(跳过):    ${noPasswordCount}`);
    console.log(`错误数:          ${errors.length}`);
    console.log('='.repeat(60));

    if (errors.length > 0) {
      console.log('\n❌ 错误详情:');
      errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.user}: ${err.error}`);
      });
    }

    if (migratedCount > 0) {
      console.log('\n✅ 密码迁移完成！');
      console.log(`\n⚠️  重要: 迁移了 ${migratedCount} 个明文密码，这些用户的原密码已在上面显示。`);
      console.log('建议通知用户或为其重置密码。');
    } else {
      console.log('\n✅ 所有密码已经加密或无需迁移。');
    }

  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
migratePasswords()
  .then(() => {
    console.log('\n✨ 迁移脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 迁移脚本执行失败:', error);
    process.exit(1);
  });
