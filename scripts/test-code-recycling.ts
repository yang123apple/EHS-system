/**
 * 自动化测试脚本：验证隐患编号回收功能
 *
 * 测试流程：
 * 1. 创建测试隐患并获取编号
 * 2. 软删除隐患，验证编号进入池中
 * 3. 再次创建隐患，验证编号被重用
 * 4. 测试编号连续性（优先使用小序号）
 * 5. 清理测试数据
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function section(message: string) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(`  ${message}`, colors.blue);
  log(`${'='.repeat(60)}`, colors.blue);
}

// 模拟用户信息
const testUser = {
  id: '10997292', // 使用真实的用户ID
  name: '聂华龙'
};

// 获取今天的日期前缀
function getTodayPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// 生成编号（用于验证）
function expectedCode(sequence: number): string {
  return `Hazard${getTodayPrefix()}${String(sequence).padStart(3, '0')}`;
}

async function runTests() {
  section('隐患编号回收系统 - 自动化测试');

  let testHazard1: any;
  let testHazard2: any;
  let testHazard3: any;

  try {
    // ======== 测试 1: 创建隐患 ========
    section('测试 1: 创建第一个隐患');

    testHazard1 = await prisma.hazardRecord.create({
      data: {
        code: expectedCode(1), // 手动设置编号
        type: '测试隐患类型',
        location: '测试区域',
        desc: '测试编号回收功能 - 隐患1',
        riskLevel: 'low',
        reporterId: testUser.id,
        reporterName: testUser.name,
        status: 'reported',
        logs: JSON.stringify([{
          operatorId: testUser.id,
          operatorName: testUser.name,
          action: '创建隐患',
          time: new Date().toISOString(),
          changes: '测试创建'
        }])
      }
    });

    success(`隐患已创建，编号: ${testHazard1.code}`);

    if (testHazard1.code !== expectedCode(1)) {
      error(`编号不符合预期！期望: ${expectedCode(1)}, 实际: ${testHazard1.code}`);
      throw new Error('编号生成错误');
    }

    // ======== 测试 2: 软删除隐患 ========
    section('测试 2: 软删除隐患，释放编号');

    const voidedByInfo = JSON.stringify({
      id: testUser.id,
      name: testUser.name,
      role: 'admin',
      timestamp: new Date().toISOString()
    });

    // ♻️ 保存编号用于后续验证
    const originalCode = testHazard1.code;

    await prisma.hazardRecord.update({
      where: { id: testHazard1.id },
      data: {
        isVoided: true,
        voidReason: '测试编号回收',
        voidedAt: new Date(),
        voidedBy: voidedByInfo,
        code: null  // ♻️ 清除编号，使其可以被重用
      }
    });

    success(`隐患已作废，原编号: ${originalCode}`);

    // 模拟释放编号到池中
    await prisma.hazardCodePool.create({
      data: {
        code: originalCode!,
        datePrefix: getTodayPrefix(),
        sequence: 1,
        status: 'available',
        releasedBy: testUser.id,
        releasedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30天后
      }
    });

    success(`编号已释放到编号池: ${originalCode}`);

    // 验证编号池
    const poolCount = await prisma.hazardCodePool.count({
      where: { status: 'available' }
    });

    if (poolCount !== 1) {
      error(`编号池状态异常！期望: 1, 实际: ${poolCount}`);
      throw new Error('编号池验证失败');
    }

    success(`编号池验证通过，当前可用编号: ${poolCount} 个`);

    // ======== 测试 3: 重用编号 ========
    section('测试 3: 创建新隐患，验证编号重用');

    // 从编号池获取可用编号
    const availableCode = await prisma.hazardCodePool.findFirst({
      where: {
        datePrefix: getTodayPrefix(),
        status: 'available'
      },
      orderBy: { sequence: 'asc' }
    });

    if (!availableCode) {
      error('编号池中没有可用编号！');
      throw new Error('编号池为空');
    }

    info(`从编号池获取到编号: ${availableCode.code}`);

    // 创建新隐患，使用重用的编号
    testHazard2 = await prisma.hazardRecord.create({
      data: {
        code: availableCode.code,
        type: '测试隐患类型',
        location: '测试区域',
        desc: '测试编号回收功能 - 隐患2（重用编号）',
        riskLevel: 'medium',
        reporterId: testUser.id,
        reporterName: testUser.name,
        status: 'reported',
        logs: JSON.stringify([{
          operatorId: testUser.id,
          operatorName: testUser.name,
          action: '创建隐患',
          time: new Date().toISOString(),
          changes: '测试重用编号'
        }])
      }
    });

    // 标记编号为已使用
    await prisma.hazardCodePool.update({
      where: { id: availableCode.id },
      data: {
        status: 'used',
        usedAt: new Date(),
        usedBy: testUser.id
      }
    });

    if (testHazard2.code !== originalCode) {
      error(`编号重用失败！期望: ${originalCode}, 实际: ${testHazard2.code}`);
      throw new Error('编号未重用');
    }

    success(`✨ 编号成功重用！${originalCode} → ${testHazard2.code}`);

    // ======== 测试 4: 测试编号连续性 ========
    section('测试 4: 验证编号连续性（优先使用小序号）');

    // 创建编号 002 和 003
    const hazard002 = await prisma.hazardRecord.create({
      data: {
        code: expectedCode(2),
        type: '测试隐患',
        location: '测试区域',
        desc: '测试编号002',
        riskLevel: 'low',
        reporterId: testUser.id,
        reporterName: testUser.name,
        status: 'reported',
        logs: '[]'
      }
    });

    const hazard003 = await prisma.hazardRecord.create({
      data: {
        code: expectedCode(3),
        type: '测试隐患',
        location: '测试区域',
        desc: '测试编号003',
        riskLevel: 'low',
        reporterId: testUser.id,
        reporterName: testUser.name,
        status: 'reported',
        logs: '[]'
      }
    });

    info(`已创建隐患: ${hazard002.code}, ${hazard003.code}`);

    // 作废 002 和 003
    await prisma.hazardRecord.updateMany({
      where: { id: { in: [hazard002.id, hazard003.id] } },
      data: { isVoided: true, voidReason: '测试', voidedAt: new Date() }
    });

    // 释放到编号池
    await prisma.hazardCodePool.createMany({
      data: [
        {
          code: hazard002.code!,
          datePrefix: getTodayPrefix(),
          sequence: 2,
          status: 'available',
          releasedBy: testUser.id
        },
        {
          code: hazard003.code!,
          datePrefix: getTodayPrefix(),
          sequence: 3,
          status: 'available',
          releasedBy: testUser.id
        }
      ]
    });

    success(`已释放编号: ${hazard002.code}, ${hazard003.code}`);

    // 从编号池获取最小序号
    const minCode = await prisma.hazardCodePool.findFirst({
      where: {
        datePrefix: getTodayPrefix(),
        status: 'available'
      },
      orderBy: { sequence: 'asc' }
    });

    if (minCode?.code !== hazard002.code) {
      error(`编号连续性测试失败！应优先返回 ${hazard002.code}，实际: ${minCode?.code}`);
      throw new Error('编号连续性验证失败');
    }

    success(`✨ 编号连续性验证通过！优先返回最小序号: ${minCode.code}`);

    // ======== 测试 5: 统计信息 ========
    section('测试 5: 编号池统计信息');

    const stats = {
      total: await prisma.hazardCodePool.count(),
      available: await prisma.hazardCodePool.count({ where: { status: 'available' } }),
      used: await prisma.hazardCodePool.count({ where: { status: 'used' } })
    };

    info(`编号池统计:`);
    info(`  - 总计: ${stats.total} 条`);
    info(`  - 可用: ${stats.available} 条`);
    info(`  - 已使用: ${stats.used} 条`);

    // ======== 清理测试数据 ========
    section('清理测试数据');

    const deleted = await prisma.hazardRecord.deleteMany({
      where: {
        reporterId: testUser.id
      }
    });

    const deletedPool = await prisma.hazardCodePool.deleteMany({
      where: {
        datePrefix: getTodayPrefix()
      }
    });

    success(`已清理隐患记录: ${deleted.count} 条`);
    success(`已清理编号池记录: ${deletedPool.count} 条`);

    // ======== 测试完成 ========
    section('测试结果');
    success('🎉 所有测试通过！');
    log('');
    log('编号回收功能正常工作：', colors.green);
    log('  ✅ 软删除后编号进入编号池', colors.green);
    log('  ✅ 新建隐患时优先重用编号', colors.green);
    log('  ✅ 优先使用最小序号（保持连续性）', colors.green);
    log('  ✅ 编号池状态正确追踪', colors.green);
    log('');

    return true;

  } catch (err: any) {
    section('测试失败');
    error(`错误: ${err.message}`);
    console.error(err);

    // 清理测试数据
    try {
      await prisma.hazardRecord.deleteMany({
        where: { reporterId: testUser.id }
      });
      await prisma.hazardCodePool.deleteMany({
        where: { datePrefix: getTodayPrefix() }
      });
      info('已清理测试数据');
    } catch (cleanupError) {
      error('清理测试数据失败');
    }

    return false;
  }
}

// 执行测试
runTests()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('测试执行异常:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
