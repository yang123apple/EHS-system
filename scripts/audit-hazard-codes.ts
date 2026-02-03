/**
 * 隐患编号审计和自动修复脚本
 *
 * 功能：
 * 1. 检测僵尸编号（USED 状态但无对应隐患记录）
 * 2. 检测重复编号（编号池中有重复的编号）
 * 3. 检测缺失的编号（隐患存在但池中无 USED 记录）
 * 4. 自动修复检测到的问题
 *
 * 使用方法：
 * 1. 手动执行：
 *    ```bash
 *    npx ts-node scripts/audit-hazard-codes.ts
 *    ```
 *
 * 2. 定时任务（使用 node-cron）：
 *    ```typescript
 *    import cron from 'node-cron';
 *    import { auditHazardCodes } from './scripts/audit-hazard-codes';
 *
 *    // 每天凌晨3点执行
 *    cron.schedule('0 3 * * *', auditHazardCodes);
 *    ```
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuditResult {
  totalHazards: number;
  totalPoolRecords: number;
  zombieCodesFixed: number;
  duplicateCodesFixed: number;
  missingRecordsCreated: number;
  errors: string[];
}

/**
 * 执行编号审计和自动修复
 */
export async function auditHazardCodes(autoFix: boolean = true): Promise<AuditResult> {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 [${timestamp}] ========== 开始隐患编号审计 ==========\n`);

  const result: AuditResult = {
    totalHazards: 0,
    totalPoolRecords: 0,
    zombieCodesFixed: 0,
    duplicateCodesFixed: 0,
    missingRecordsCreated: 0,
    errors: []
  };

  try {
    // ====== 1. 统计基础信息 ======
    console.log('📊 [审计] 统计基础信息...');
    result.totalHazards = await prisma.hazardRecord.count({
      where: { code: { not: null } }
    });
    result.totalPoolRecords = await prisma.hazardCodePool.count();

    console.log(`   - 隐患记录总数（有编号）: ${result.totalHazards}`);
    console.log(`   - 编号池记录总数: ${result.totalPoolRecords}\n`);

    // ====== 2. 检测僵尸编号（USED 但无对应隐患） ======
    console.log('🧟 [审计] 检测僵尸编号（USED 但无对应隐患）...');

    const allHazardCodes = await prisma.hazardRecord.findMany({
      where: { code: { not: null } },
      select: { code: true }
    }).then(records => records.map(r => r.code).filter(Boolean) as string[]);

    const zombieCodes = await prisma.hazardCodePool.findMany({
      where: {
        status: 'used',
        code: { notIn: allHazardCodes.length > 0 ? allHazardCodes : ['__PLACEHOLDER__'] }
      }
    });

    console.log(`   - 发现 ${zombieCodes.length} 个僵尸编号`);

    if (zombieCodes.length > 0 && autoFix) {
      console.log('   🔧 [修复] 释放僵尸编号到编号池...');
      for (const zombie of zombieCodes) {
        try {
          const now = new Date();
          const expiresAt = new Date(now);
          expiresAt.setDate(expiresAt.getDate() + 30); // 30天后过期

          await prisma.hazardCodePool.update({
            where: { id: zombie.id },
            data: {
              status: 'available',
              releasedBy: 'system',
              releasedAt: now,
              expiresAt,
              usedAt: null,
              usedBy: null
            }
          });

          result.zombieCodesFixed++;
          console.log(`      ✅ 已释放: ${zombie.code} (序号: ${zombie.sequence})`);
        } catch (error: any) {
          const errorMsg = `释放僵尸编号失败: ${zombie.code} - ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`      ❌ ${errorMsg}`);
        }
      }
      console.log(`   ✅ 修复完成，共释放 ${result.zombieCodesFixed} 个僵尸编号\n`);
    } else if (zombieCodes.length > 0) {
      console.log(`   ⚠️ 检测到僵尸编号，但未启用自动修复（autoFix=false）\n`);
    } else {
      console.log(`   ✅ 未发现僵尸编号\n`);
    }

    // ====== 3. 检测重复编号 ======
    console.log('🔁 [审计] 检测重复编号（编号池中有重复）...');

    const duplicateCodes = await prisma.$queryRaw<Array<{ code: string; count: bigint }>>`
      SELECT code, COUNT(*) as count
      FROM HazardCodePool
      GROUP BY code
      HAVING COUNT(*) > 1
    `;

    console.log(`   - 发现 ${duplicateCodes.length} 个重复编号`);

    if (duplicateCodes.length > 0) {
      console.log('   ⚠️ 重复编号详情:');
      for (const dup of duplicateCodes) {
        console.log(`      - ${dup.code}: ${dup.count} 条记录`);
      }

      if (autoFix) {
        console.log('   🔧 [修复] 合并重复编号记录...');
        for (const dup of duplicateCodes) {
          try {
            // 查询所有重复记录
            const records = await prisma.hazardCodePool.findMany({
              where: { code: dup.code },
              orderBy: [
                { status: 'desc' }, // USED 优先
                { updatedAt: 'desc' } // 最新的优先
              ]
            });

            // 保留第一条，删除其他
            const [keep, ...remove] = records;

            for (const record of remove) {
              await prisma.hazardCodePool.delete({
                where: { id: record.id }
              });
            }

            result.duplicateCodesFixed += remove.length;
            console.log(`      ✅ 已合并: ${dup.code} (保留1条，删除${remove.length}条)`);
          } catch (error: any) {
            const errorMsg = `合并重复编号失败: ${dup.code} - ${error.message}`;
            result.errors.push(errorMsg);
            console.error(`      ❌ ${errorMsg}`);
          }
        }
        console.log(`   ✅ 修复完成，共删除 ${result.duplicateCodesFixed} 条重复记录\n`);
      } else {
        console.log(`   ⚠️ 检测到重复编号，但未启用自动修复（autoFix=false）\n`);
      }
    } else {
      console.log(`   ✅ 未发现重复编号\n`);
    }

    // ====== 4. 检测缺失的编号（隐患存在但池中无记录） ======
    console.log('🔍 [审计] 检测缺失的编号（隐患存在但池中无记录）...');

    const poolCodes = await prisma.hazardCodePool.findMany({
      select: { code: true }
    }).then(records => records.map(r => r.code));

    const missingCodes = allHazardCodes.filter(code => !poolCodes.includes(code));

    console.log(`   - 发现 ${missingCodes.length} 个缺失编号`);

    if (missingCodes.length > 0 && autoFix) {
      console.log('   🔧 [修复] 创建缺失的编号记录...');
      for (const code of missingCodes) {
        try {
          // 提取日期前缀和序号
          const match = code.match(/^Hazard(\d{8})(\d{3})$/);
          if (!match) {
            const errorMsg = `编号格式无效: ${code}`;
            result.errors.push(errorMsg);
            console.error(`      ❌ ${errorMsg}`);
            continue;
          }

          const datePrefix = match[1];
          const sequence = parseInt(match[2], 10);

          // 查询隐患的创建信息
          const hazard = await prisma.hazardRecord.findFirst({
            where: { code },
            select: { reporterId: true, createdAt: true }
          });

          if (!hazard) {
            console.warn(`      ⚠️ 隐患记录不存在: ${code}`);
            continue;
          }

          await prisma.hazardCodePool.create({
            data: {
              code,
              datePrefix,
              sequence,
              status: 'used',
              usedAt: hazard.createdAt,
              usedBy: hazard.reporterId
            }
          });

          result.missingRecordsCreated++;
          console.log(`      ✅ 已创建: ${code} (序号: ${sequence})`);
        } catch (error: any) {
          const errorMsg = `创建缺失编号记录失败: ${code} - ${error.message}`;
          result.errors.push(errorMsg);
          console.error(`      ❌ ${errorMsg}`);
        }
      }
      console.log(`   ✅ 修复完成，共创建 ${result.missingRecordsCreated} 条记录\n`);
    } else if (missingCodes.length > 0) {
      console.log(`   ⚠️ 检测到缺失编号，但未启用自动修复（autoFix=false）\n`);
    } else {
      console.log(`   ✅ 未发现缺失编号\n`);
    }

    // ====== 5. 生成审计报告 ======
    console.log('📋 [审计] 生成审计报告...\n');
    console.log('========== 审计报告 ==========');
    console.log(`执行时间: ${timestamp}`);
    console.log(`\n基础信息:`);
    console.log(`  - 隐患记录总数: ${result.totalHazards}`);
    console.log(`  - 编号池记录总数: ${result.totalPoolRecords}`);
    console.log(`\n修复结果:`);
    console.log(`  - 僵尸编号已修复: ${result.zombieCodesFixed}`);
    console.log(`  - 重复记录已删除: ${result.duplicateCodesFixed}`);
    console.log(`  - 缺失记录已创建: ${result.missingRecordsCreated}`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️ 错误 (${result.errors.length}):`);
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    } else {
      console.log(`\n✅ 无错误`);
    }
    console.log('================================\n');

    console.log(`✅ [${new Date().toISOString()}] 审计完成！\n`);

    return result;
  } catch (error: any) {
    console.error(`\n❌ [审计] 执行失败:`, error);
    result.errors.push(`审计失败: ${error.message}`);
    throw error;
  }
}

// 如果直接运行此脚本，则执行审计任务
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const autoFix = process.argv.includes('--fix');

  console.log('🚀 隐患编号审计脚本');
  console.log(`   自动修复: ${autoFix ? '启用' : '禁用（仅检测）'}`);
  console.log(`   提示: 添加 --fix 参数以启用自动修复\n`);

  auditHazardCodes(autoFix)
    .then((result) => {
      console.log('🎉 脚本执行成功！');
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('💥 脚本执行失败:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
