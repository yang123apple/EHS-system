/**
 * 密码迁移脚本
 * 
 * 功能：将数据库中的明文密码转换为 bcrypt 哈希
 * 
 * 使用方法：
 * npx tsx scripts/migrate-passwords.ts
 * 
 * 安全性：
 * - 自动检测已加密的密码，避免重复加密
 * - 创建迁移前的备份
 * - 显示详细的迁移进度
 */

import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
}

/**
 * 创建数据备份
 */
async function createBackup() {
  console.log('📦 正在创建备份...');
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      password: true,
    }
  });

  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `passwords-backup-${timestamp}.json`);
  
  fs.writeFileSync(backupPath, JSON.stringify(users, null, 2));
  
  console.log(`✅ 备份已创建: ${backupPath}\n`);
  return backupPath;
}

/**
 * 检查密码是否已经是 bcrypt 哈希
 */
function isBcryptHash(password: string): boolean {
  // bcrypt 哈希以 $2a$ 或 $2b$ 开头
  return password.startsWith('$2a$') || password.startsWith('$2b$');
}

/**
 * 迁移单个用户的密码
 */
async function migrateUserPassword(
  userId: string, 
  username: string, 
  currentPassword: string
): Promise<'migrated' | 'skipped' | 'failed'> {
  try {
    // 检查是否已加密
    if (isBcryptHash(currentPassword)) {
      console.log(`⏭️  跳过 ${username} (已加密)`);
      return 'skipped';
    }

    // 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(currentPassword, salt);

    // 更新数据库
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    console.log(`✅ 已迁移 ${username}`);
    return 'migrated';
    
  } catch (error) {
    console.error(`❌ 迁移失败 ${username}:`, error);
    return 'failed';
  }
}

/**
 * 主迁移函数
 */
async function migratePasswords() {
  console.log('🔐 密码迁移工具\n');
  console.log('=' .repeat(50));
  console.log('');

  try {
    // 1. 创建备份
    const backupPath = await createBackup();

    // 2. 获取所有用户
    console.log('📋 正在获取用户列表...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
      }
    });

    console.log(`找到 ${users.length} 个用户\n`);

    if (users.length === 0) {
      console.log('⚠️  没有需要迁移的用户');
      return;
    }

    // 3. 迁移每个用户
    console.log('🚀 开始迁移...\n');
    
    const stats: MigrationStats = {
      total: users.length,
      migrated: 0,
      skipped: 0,
      failed: 0
    };

    for (const user of users) {
      const result = await migrateUserPassword(
        user.id, 
        user.username, 
        user.password
      );

      if (result === 'migrated') stats.migrated++;
      else if (result === 'skipped') stats.skipped++;
      else if (result === 'failed') stats.failed++;

      // 稍微延迟，避免过快
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 4. 显示统计信息
    console.log('\n' + '='.repeat(50));
    console.log('📊 迁移统计');
    console.log('='.repeat(50));
    console.log(`总用户数: ${stats.total}`);
    console.log(`✅ 成功迁移: ${stats.migrated}`);
    console.log(`⏭️  跳过（已加密）: ${stats.skipped}`);
    console.log(`❌ 失败: ${stats.failed}`);
    console.log('');

    if (stats.failed > 0) {
      console.log('⚠️  部分用户迁移失败，请检查错误日志');
      console.log(`可以从备份恢复: ${backupPath}`);
    } else if (stats.migrated > 0) {
      console.log('✨ 迁移成功完成！所有密码已加密。');
    } else {
      console.log('✨ 所有密码已经是加密状态，无需迁移。');
    }

    // 5. 验证迁移结果
    console.log('\n🔍 正在验证迁移结果...');
    const verifyUsers = await prisma.user.findMany({
      select: { password: true }
    });

    const allEncrypted = verifyUsers.every(u => isBcryptHash(u.password));
    
    if (allEncrypted) {
      console.log('✅ 验证通过：所有密码均已加密\n');
    } else {
      console.log('⚠️  警告：仍有部分密码未加密\n');
    }

  } catch (error) {
    console.error('\n❌ 迁移过程中发生错误:', error);
    console.log('\n请检查：');
    console.log('1. 数据库连接是否正常');
    console.log('2. Prisma Client 是否已生成 (npm run postinstall)');
    console.log('3. 是否有足够的数据库权限');
    process.exit(1);
  }
}

/**
 * 测试单个密码的加密和验证
 */
async function testPasswordEncryption() {
  console.log('\n🧪 测试密码加密...\n');

  const testPassword = '123456';
  console.log(`原始密码: ${testPassword}`);

  // 加密
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(testPassword, salt);
  console.log(`加密后: ${hashed}`);

  // 验证
  const isValid = await bcrypt.compare(testPassword, hashed);
  console.log(`验证结果: ${isValid ? '✅ 通过' : '❌ 失败'}`);

  const isInvalid = await bcrypt.compare('wrong', hashed);
  console.log(`错误密码: ${isInvalid ? '❌ 意外通过' : '✅ 正确拒绝'}\n`);
}

// 主程序
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    // 仅测试加密功能
    await testPasswordEncryption();
  } else if (args.includes('--help')) {
    // 显示帮助信息
    console.log(`
密码迁移工具

用法:
  npx tsx scripts/migrate-passwords.ts           # 执行迁移
  npx tsx scripts/migrate-passwords.ts --test    # 测试加密功能
  npx tsx scripts/migrate-passwords.ts --help    # 显示帮助

功能:
  - 自动将数据库中的明文密码转换为 bcrypt 哈希
  - 迁移前自动创建备份
  - 跳过已加密的密码
  - 显示详细的迁移进度和统计信息

注意事项:
  - 迁移是不可逆的（但有备份）
  - 建议在非生产环境先测试
  - 迁移后用户需要使用原密码登录
    `);
  } else {
    // 执行迁移
    await migratePasswords();
  }
}

// 执行
main()
  .catch((error) => {
    console.error('💥 未预期的错误:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
