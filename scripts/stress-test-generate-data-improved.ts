/**
 * 隐患可见性表压力测试 - 数据生成脚本（改进版）
 * 
 * 目标：生成100万条不同人员可见的隐患数据
 * 
 * 改进功能：
 * 1. 断点续传：自动检测已生成的数据，从中断处继续
 * 2. 进度保存：每100批次保存一次进度
 * 3. 错误恢复：批次失败时自动重试，最多3次
 * 4. 性能优化：使用更小的批次大小，减少内存占用
 * 
 * 策略：
 * 1. 创建测试用户（100个普通用户 + 10个管理员）
 * 2. 批量生成100万条隐患记录
 * 3. 自动生成可见性记录（每条隐患3-8个可见用户）
 * 4. 使用事务批量插入以提高性能
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// 配置参数
const CONFIG = {
  TOTAL_HAZARDS: 1_000_000, // 目标：100万条隐患
  BATCH_SIZE: 1000, // 每批插入1000条
  TEST_USERS: 100, // 测试用户数量
  ADMIN_USERS: 10, // 管理员数量
  MIN_VISIBILITY_PER_HAZARD: 3, // 每条隐患最少可见人数
  MAX_VISIBILITY_PER_HAZARD: 8, // 每条隐患最多可见人数
  PROGRESS_FILE: path.join(process.cwd(), '.stress-test-progress.json'), // 进度文件
  MAX_RETRIES: 3, // 最大重试次数
};

// 隐患类型
const HAZARD_TYPES = [
  '高处作业', '动火作业', '受限空间', '临时用电', '吊装作业',
  '设备缺陷', '环境污染', '消防隐患', '化学品泄漏', '其他隐患'
];

// 风险等级
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

// 隐患状态
const STATUSES = ['reported', 'assigned', 'rectifying', 'verifying', 'completed'];

// 检查类型
const CHECK_TYPES = ['daily', 'special', 'monthly', 'pre-holiday', 'self', 'other'];

// 整改方式
const RECTIFICATION_TYPES = ['immediate', 'scheduled'];

// 位置列表
const LOCATIONS = [
  '生产车间A', '生产车间B', '仓库1号', '仓库2号', '办公楼',
  '食堂区域', '宿舍区域', '锅炉房', '配电室', '消防通道',
  '化学品仓库', '废料存放区', '装卸平台', '停车场', '绿化带'
];

/**
 * 生成密码哈希
 */
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * 随机选择数组元素
 */
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 随机整数
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 生成随机日期
 */
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * 保存进度
 */
async function saveProgress(batch: number, totalInserted: number) {
  try {
    await fs.writeFile(
      CONFIG.PROGRESS_FILE,
      JSON.stringify({ batch, totalInserted, timestamp: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (error) {
    console.warn('保存进度失败:', error);
  }
}

/**
 * 加载进度
 */
async function loadProgress(): Promise<{ batch: number; totalInserted: number } | null> {
  try {
    const content = await fs.readFile(CONFIG.PROGRESS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * 获取已生成的批次数量（断点续传）
 */
async function getLastBatch(): Promise<number> {
  // 优先从进度文件读取
  const progress = await loadProgress();
  if (progress) {
    console.log(`📂 从进度文件读取：批次 ${progress.batch}，已插入 ${progress.totalInserted.toLocaleString()} 条`);
    return progress.batch;
  }

  // 从数据库查询
  try {
    const lastHazard = await prisma.hazardRecord.findFirst({
      where: { id: { startsWith: 'stress_test_' } },
      orderBy: { id: 'desc' }
    });
    
    if (!lastHazard) return 0;
    
    // 从ID中提取批次号：stress_test_{batch}_{i}
    const match = lastHazard.id.match(/stress_test_(\d+)_/);
    if (match) {
      const lastBatch = parseInt(match[1], 10);
      // 检查该批次是否完整（应该包含BATCH_SIZE条记录）
      const batchCount = await prisma.hazardRecord.count({
        where: { id: { startsWith: `stress_test_${lastBatch}_` } }
      });
      
      // 如果批次完整，从下一批次开始；否则从当前批次重新开始
      if (batchCount >= CONFIG.BATCH_SIZE) {
        return lastBatch + 1;
      } else {
        // 批次不完整，删除该批次的数据，重新生成
        console.log(`⚠️ 检测到批次 ${lastBatch} 不完整（${batchCount}/${CONFIG.BATCH_SIZE}），将重新生成`);
        await prisma.$transaction(async (tx) => {
          const incompleteHazards = await tx.hazardRecord.findMany({
            where: { id: { startsWith: `stress_test_${lastBatch}_` } },
            select: { id: true }
          });
          const hazardIds = incompleteHazards.map(h => h.id);
          
          await (tx as any).hazardVisibility.deleteMany({
            where: { hazardId: { in: hazardIds } }
          });
          await tx.hazardRecord.deleteMany({
            where: { id: { in: hazardIds } }
          });
        });
        return lastBatch;
      }
    }
    return 0;
  } catch (error) {
    console.warn('获取最后批次失败，从0开始:', error);
    return 0;
  }
}

/**
 * 第一步：创建测试用户
 */
async function createTestUsers() {
  console.log('📝 第一步：创建测试用户...');
  
  // 检查是否已存在测试用户
  const existingUsers = await prisma.user.findMany({
    where: { 
      OR: [
        { username: { startsWith: 'test_user_' } },
        { username: { startsWith: 'test_admin_' } }
      ]
    }
  });
  
  if (existingUsers.length >= CONFIG.TEST_USERS + CONFIG.ADMIN_USERS) {
    console.log(`✅ 已存在 ${existingUsers.length} 个测试用户，跳过创建`);
    return existingUsers;
  }
  
  console.log('⏳ 创建测试用户中...');
  const users: any[] = [];
  const existingUsernames = new Set(existingUsers.map((user) => user.username));
  const password = hashPassword('test123'); // 统一密码
  
  // 创建普通用户
  for (let i = 1; i <= CONFIG.TEST_USERS; i++) {
    const username = `test_user_${i}`;
    if (!existingUsernames.has(username)) {
      users.push({
        username,
        name: `测试用户${i}`,
        password,
        role: 'user',
        isActive: true,
      });
    }
  }
  
  // 创建管理员用户
  for (let i = 1; i <= CONFIG.ADMIN_USERS; i++) {
    const username = `test_admin_${i}`;
    if (!existingUsernames.has(username)) {
      users.push({
        username,
        name: `测试管理员${i}`,
        password,
        role: 'admin',
        isActive: true,
      });
    }
  }
  
  // 批量插入
  if (users.length > 0) {
    await prisma.user.createMany({ data: users });
  }
  
  // 返回所有测试用户
  const allUsers = await prisma.user.findMany({
    where: { 
      OR: [
        { username: { startsWith: 'test_user_' } },
        { username: { startsWith: 'test_admin_' } }
      ]
    }
  });
  
  console.log(`✅ 创建完成：${allUsers.length} 个测试用户`);
  return allUsers;
}

/**
 * 第二步：批量生成隐患数据（支持断点续传）
 */
async function generateHazards(users: any[]) {
  console.log('\n📝 第二步：批量生成隐患数据...');
  console.log(`⏳ 目标数量：${CONFIG.TOTAL_HAZARDS.toLocaleString()} 条`);
  console.log(`⏳ 批量大小：${CONFIG.BATCH_SIZE} 条/批`);
  
  // 检查已生成的进度
  const startBatch = await getLastBatch();
  const existingCount = startBatch * CONFIG.BATCH_SIZE;
  
  if (startBatch > 0) {
    console.log(`\n🔄 检测到已有数据，从批次 ${startBatch} 继续生成...`);
    console.log(`   已完成：${existingCount.toLocaleString()} 条`);
    console.log(`   剩余：${(CONFIG.TOTAL_HAZARDS - existingCount).toLocaleString()} 条`);
  }
  
  const startTime = Date.now();
  const batches = Math.ceil(CONFIG.TOTAL_HAZARDS / CONFIG.BATCH_SIZE);
  const startDate = new Date('2023-01-01');
  const endDate = new Date();
  
  for (let batch = startBatch; batch < batches; batch++) {
    let retries = 0;
    let success = false;
    
    while (retries < CONFIG.MAX_RETRIES && !success) {
      try {
        const batchStartTime = Date.now();
        const hazards: any[] = [];
        const visibilityRecords: any[] = [];
        
        // 当前批次的数量
        const currentBatchSize = Math.min(
          CONFIG.BATCH_SIZE,
          CONFIG.TOTAL_HAZARDS - batch * CONFIG.BATCH_SIZE
        );
        
        for (let i = 0; i < currentBatchSize; i++) {
          const hazardId = `stress_test_${batch}_${i}`;
          const reporter = randomChoice(users);
          const responsible = randomChoice(users);
          const verifier = randomChoice(users);
          const reportTime = randomDate(startDate, endDate);
          const status = randomChoice(STATUSES);
          
          // 生成隐患记录
          const hazard: any = {
            id: hazardId,
            code: `HZ-TEST-${batch.toString().padStart(6, '0')}-${i.toString().padStart(4, '0')}`,
            status,
            riskLevel: randomChoice(RISK_LEVELS),
            checkType: randomChoice(CHECK_TYPES),
            rectificationType: randomChoice(RECTIFICATION_TYPES),
            type: randomChoice(HAZARD_TYPES),
            location: randomChoice(LOCATIONS),
            desc: `压力测试隐患 - 批次${batch} 序号${i}`,
            reporterId: reporter.id,
            reporterName: reporter.name,
            reportTime,
            isVoided: false,
            createdAt: reportTime,
            updatedAt: reportTime,
          };
          
          // 根据状态补充字段
          if (status !== 'reported') {
            hazard.responsibleId = responsible.id;
            hazard.responsibleName = responsible.name;
            hazard.responsibleDept = '测试部门';
            hazard.deadline = new Date(reportTime.getTime() + 7 * 24 * 60 * 60 * 1000);
          }
          
          if (['verifying', 'completed'].includes(status)) {
            hazard.rectifyDesc = '已完成整改';
            hazard.rectifyTime = new Date(reportTime.getTime() + 5 * 24 * 60 * 60 * 1000);
          }
          
          if (status === 'completed') {
            hazard.verifierId = verifier.id;
            hazard.verifierName = verifier.name;
            hazard.verifyTime = new Date(reportTime.getTime() + 6 * 24 * 60 * 60 * 1000);
            hazard.verifyDesc = '验收通过';
          }
          
          hazards.push(hazard);
          
          // 生成可见性记录（3-8个用户）
          const visibilityCount = randomInt(
            CONFIG.MIN_VISIBILITY_PER_HAZARD,
            CONFIG.MAX_VISIBILITY_PER_HAZARD
          );
          const visibleUsers = new Set<string>();
          
          // 确保核心角色可见
          visibleUsers.add(reporter.id);
          if (hazard.responsibleId) visibleUsers.add(hazard.responsibleId);
          if (hazard.verifierId) visibleUsers.add(hazard.verifierId);
          
          // 随机添加其他用户
          while (visibleUsers.size < visibilityCount) {
            visibleUsers.add(randomChoice(users).id);
          }
          
          // 创建可见性记录
          visibleUsers.forEach(userId => {
            let role = 'cc'; // 默认抄送
            if (userId === reporter.id) role = 'creator';
            else if (userId === hazard.responsibleId) role = 'responsible';
            else if (userId === hazard.verifierId) role = 'verifier';
            
            visibilityRecords.push({
              id: `${hazardId}_${userId}_${role}`,
              hazardId,
              userId,
              role,
              createdAt: reportTime,
              updatedAt: reportTime,
            });
          });
        }
        
        // 批量插入（带重试）
        await prisma.$transaction(async (tx) => {
          await tx.hazardRecord.createMany({ data: hazards });
          await (tx as any).hazardVisibility.createMany({ data: visibilityRecords });
        });
        
        const batchTime = Date.now() - batchStartTime;
        const progress = ((batch + 1) / batches * 100).toFixed(2);
        const avgTime = batchTime / currentBatchSize;
        const totalInserted = (batch + 1) * CONFIG.BATCH_SIZE;
        const remainingBatches = batches - batch - 1;
        const avgBatchTime = (Date.now() - startTime) / (batch - startBatch + 1);
        const eta = (remainingBatches * avgBatchTime / 1000 / 60).toFixed(1);
        
        console.log(
          `✅ 批次 ${batch + 1}/${batches} (${progress}%) | ` +
          `插入 ${currentBatchSize.toLocaleString()} 条 | ` +
          `耗时 ${(batchTime / 1000).toFixed(2)}s | ` +
          `均速 ${avgTime.toFixed(2)}ms/条 | ` +
          `已完成 ${totalInserted.toLocaleString()} 条 | ` +
          `预计剩余 ${eta}分钟`
        );
        
        // 每100批次保存一次进度
        if ((batch + 1) % 100 === 0) {
          await saveProgress(batch + 1, totalInserted);
          console.log(`💾 进度检查点：已保存 ${batch + 1} 批次的数据`);
        }
        
        success = true;
      } catch (error) {
        retries++;
        if (retries >= CONFIG.MAX_RETRIES) {
          console.error(`❌ 批次 ${batch + 1} 插入失败（已重试${CONFIG.MAX_RETRIES}次）:`, error);
          throw error;
        } else {
          console.warn(`⚠️ 批次 ${batch + 1} 插入失败，重试 ${retries}/${CONFIG.MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 指数退避
        }
      }
    }
  }
  
  // 删除进度文件（任务完成）
  try {
    await fs.unlink(CONFIG.PROGRESS_FILE);
  } catch (error) {
    // 忽略删除失败
  }
  
  const totalTime = (Date.now() - startTime) / 1000 / 60;
  console.log(`\n🎉 数据生成完成！总耗时：${totalTime.toFixed(2)} 分钟`);
}

/**
 * 第三步：验证数据完整性
 */
async function verifyData() {
  console.log('\n📝 第三步：验证数据完整性...');
  
  const [hazardCount, visibilityCount, userCount] = await Promise.all([
    prisma.hazardRecord.count({ where: { id: { startsWith: 'stress_test_' } } }),
    (prisma as any).hazardVisibility.count({ where: { hazardId: { startsWith: 'stress_test_' } } }),
    prisma.user.count({ 
      where: { 
        OR: [
          { username: { startsWith: 'test_user_' } },
          { username: { startsWith: 'test_admin_' } }
        ]
      }
    }),
  ]);
  
  console.log('📊 数据统计：');
  console.log(`   - 隐患记录：${hazardCount.toLocaleString()} 条`);
  console.log(`   - 可见性记录：${visibilityCount.toLocaleString()} 条`);
  console.log(`   - 测试用户：${userCount} 个`);
  if (hazardCount > 0) {
    console.log(`   - 平均可见性/隐患：${(visibilityCount / hazardCount).toFixed(2)}`);
  }
  
  // 检查索引
  const sampleUser = await prisma.user.findFirst({
    where: { username: { startsWith: 'test_user_' } }
  });
  
  if (sampleUser) {
    const userHazardsCount = await (prisma as any).hazardVisibility.count({
      where: { userId: sampleUser.id, hazardId: { startsWith: 'stress_test_' } }
    });
    console.log(`\n🔍 样本检查：`);
    console.log(`   - 用户：${sampleUser.name}`);
    console.log(`   - 可见隐患数：${userHazardsCount.toLocaleString()}`);
  }
  
  console.log('\n✅ 数据验证完成！');
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 隐患可见性表压力测试 - 数据生成脚本（改进版）');
  console.log('='.repeat(60));
  
  try {
    // 第一步：创建测试用户
    const users = await createTestUsers();
    
    if (users.length === 0) {
      throw new Error('未找到测试用户，无法继续');
    }
    
    // 第二步：批量生成隐患数据
    await generateHazards(users);
    
    // 第三步：验证数据完整性
    await verifyData();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 所有任务完成！');
    console.log('\n📝 下一步：');
    console.log('   运行性能测试脚本：npm run stress-test:performance');
    
  } catch (error) {
    console.error('\n❌ 错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行
main();
