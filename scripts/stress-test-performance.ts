/**
 * 隐患可见性表压力测试 - 性能测试脚本
 * 
 * 目标：自动化测试访问隐患系统不同页面的前后端响应情况
 * 
 * 测试场景：
 * 1. 普通用户访问"我的任务"
 * 2. 管理员访问"我的任务"（验证Admin Bypass优化）
 * 3. 分页查询性能测试
 * 4. 详情查询性能测试
 * 5. 搜索查询性能测试
 * 6. 并发访问压力测试
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// 配置参数
const CONFIG = {
  TEST_ROUNDS: 10, // 每个场景测试轮数
  CONCURRENT_USERS: 50, // 并发用户数
  PAGE_SIZE: 20, // 分页大小
  DETAIL_SAMPLES: 100, // 详情查询样本数
};

// 性能指标
interface PerformanceMetric {
  scenario: string;
  minTime: number;
  maxTime: number;
  avgTime: number;
  p50Time: number;
  p95Time: number;
  p99Time: number;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  qps: number;
}

// 测试结果
const testResults: PerformanceMetric[] = [];

/**
 * 计算百分位数
 */
function percentile(arr: number[], p: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((sorted.length * p) / 100) - 1;
  return sorted[index] || 0;
}

/**
 * 计算性能指标
 */
function calculateMetrics(
  scenario: string,
  times: number[],
  errors: number,
  totalTime: number
): PerformanceMetric {
  const successCount = times.length;
  const totalRequests = successCount + errors;
  
  return {
    scenario,
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    avgTime: times.reduce((a, b) => a + b, 0) / times.length,
    p50Time: percentile(times, 50),
    p95Time: percentile(times, 95),
    p99Time: percentile(times, 99),
    totalRequests,
    successCount,
    errorCount: errors,
    qps: (successCount / totalTime) * 1000, // 每秒查询数
  };
}

/**
 * 场景1：普通用户访问"我的任务"
 */
async function testNormalUserMyTasks() {
  console.log('\n📝 场景1：普通用户访问"我的任务"');
  console.log('=' .repeat(60));
  
  // 获取测试用户
  const users = await prisma.user.findMany({
    where: {
      username: { startsWith: 'test_user_' },
      role: 'user',
    },
    take: CONFIG.TEST_ROUNDS,
  });
  
  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const testStart = Date.now();
    
    try {
      // 模拟查询"我的任务"（使用可见性表）
      const result = await prisma.hazardRecord.findMany({
        where: {
          isVoided: false,
          visibilityRecords: {
            some: { userId: user.id },
          },
        },
        take: CONFIG.PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          status: true,
          type: true,
          riskLevel: true,
          location: true,
          reporterName: true,
          reportTime: true,
        },
      });
      
      const elapsed = Date.now() - testStart;
      times.push(elapsed);
      
      console.log(
        `  ✅ 第${i + 1}/${users.length}轮 | ` +
        `用户：${user.name} | ` +
        `结果：${result.length}条 | ` +
        `耗时：${elapsed}ms`
      );
    } catch (error) {
      errors++;
      console.error(`  ❌ 第${i + 1}/${users.length}轮失败:`, error);
    }
  }
  
  const totalTime = Date.now() - startTime;
  const metrics = calculateMetrics('普通用户-我的任务', times, errors, totalTime);
  testResults.push(metrics);
  
  console.log('\n📊 性能统计：');
  console.log(`  平均响应时间：${metrics.avgTime.toFixed(2)}ms`);
  console.log(`  P50响应时间：${metrics.p50Time.toFixed(2)}ms`);
  console.log(`  P95响应时间：${metrics.p95Time.toFixed(2)}ms`);
  console.log(`  QPS：${metrics.qps.toFixed(2)}`);
}

/**
 * 场景2：管理员访问"我的任务"（验证Admin Bypass优化）
 */
async function testAdminUserMyTasks() {
  console.log('\n📝 场景2：管理员访问"我的任务"（Admin Bypass优化）');
  console.log('='.repeat(60));
  
  // 获取管理员用户
  const admins = await prisma.user.findMany({
    where: {
      username: { startsWith: 'test_admin_' },
      role: 'admin',
    },
    take: CONFIG.TEST_ROUNDS,
  });
  
  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < admins.length; i++) {
    const admin = admins[i];
    const testStart = Date.now();
    
    try {
      // 管理员查询（直接查询，跳过可见性JOIN）
      const result = await prisma.hazardRecord.findMany({
        where: {
          isVoided: false,
        },
        take: CONFIG.PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          status: true,
          type: true,
          riskLevel: true,
          location: true,
          reporterName: true,
          reportTime: true,
        },
      });
      
      const elapsed = Date.now() - testStart;
      times.push(elapsed);
      
      console.log(
        `  ✅ 第${i + 1}/${admins.length}轮 | ` +
        `管理员：${admin.name} | ` +
        `结果：${result.length}条 | ` +
        `耗时：${elapsed}ms`
      );
    } catch (error) {
      errors++;
      console.error(`  ❌ 第${i + 1}/${admins.length}轮失败:`, error);
    }
  }
  
  const totalTime = Date.now() - startTime;
  const metrics = calculateMetrics('管理员-我的任务(优化后)', times, errors, totalTime);
  testResults.push(metrics);
  
  console.log('\n📊 性能统计：');
  console.log(`  平均响应时间：${metrics.avgTime.toFixed(2)}ms`);
  console.log(`  P50响应时间：${metrics.p50Time.toFixed(2)}ms`);
  console.log(`  P95响应时间：${metrics.p95Time.toFixed(2)}ms`);
  console.log(`  QPS：${metrics.qps.toFixed(2)}`);
}

/**
 * 场景3：分页查询性能测试
 */
async function testPaginationPerformance() {
  console.log('\n📝 场景3：分页查询性能测试');
  console.log('='.repeat(60));
  
  const user = await prisma.user.findFirst({
    where: { username: { startsWith: 'test_user_' } },
  });
  
  if (!user) {
    console.error('❌ 未找到测试用户');
    return;
  }
  
  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  const pages = [1, 10, 50, 100, 500, 1000];
  
  for (const page of pages) {
    const testStart = Date.now();
    
    try {
      const skip = (page - 1) * CONFIG.PAGE_SIZE;
      const result = await prisma.hazardRecord.findMany({
        where: {
          isVoided: false,
          visibilityRecords: {
            some: { userId: user.id },
          },
        },
        skip,
        take: CONFIG.PAGE_SIZE,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          status: true,
        },
      });
      
      const elapsed = Date.now() - testStart;
      times.push(elapsed);
      
      console.log(
        `  ✅ 第${page}页 | ` +
        `偏移量：${skip} | ` +
        `结果：${result.length}条 | ` +
        `耗时：${elapsed}ms`
      );
    } catch (error) {
      errors++;
      console.error(`  ❌ 第${page}页查询失败:`, error);
    }
  }
  
  const totalTime = Date.now() - startTime;
  const metrics = calculateMetrics('分页查询', times, errors, totalTime);
  testResults.push(metrics);
  
  console.log('\n📊 性能统计：');
  console.log(`  平均响应时间：${metrics.avgTime.toFixed(2)}ms`);
  console.log(`  P95响应时间：${metrics.p95Time.toFixed(2)}ms`);
}

/**
 * 场景4：详情查询性能测试
 */
async function testDetailQueryPerformance() {
  console.log('\n📝 场景4：详情查询性能测试');
  console.log('='.repeat(60));
  
  // 随机获取样本隐患
  const samples = await prisma.hazardRecord.findMany({
    where: { isVoided: false },
    take: CONFIG.DETAIL_SAMPLES,
    select: { id: true },
  });
  
  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < samples.length; i++) {
    const testStart = Date.now();
    
    try {
      const result = await prisma.hazardRecord.findUnique({
        where: { id: samples[i].id },
        include: {
          reporter: {
            select: { id: true, name: true, departmentId: true },
          },
          responsible: {
            select: { id: true, name: true, departmentId: true },
          },
          visibilityRecords: {
            select: { userId: true, role: true },
          },
        },
      });
      
      const elapsed = Date.now() - testStart;
      times.push(elapsed);
      
      if (i % 10 === 0) {
        console.log(
          `  ✅ 第${i + 1}/${samples.length}条 | ` +
          `耗时：${elapsed}ms | ` +
          `可见用户：${result?.visibilityRecords.length || 0}个`
        );
      }
    } catch (error) {
      errors++;
      if (i % 10 === 0) {
        console.error(`  ❌ 第${i + 1}/${samples.length}条查询失败`);
      }
    }
  }
  
  const totalTime = Date.now() - startTime;
  const metrics = calculateMetrics('详情查询', times, errors, totalTime);
  testResults.push(metrics);
  
  console.log('\n📊 性能统计：');
  console.log(`  平均响应时间：${metrics.avgTime.toFixed(2)}ms`);
  console.log(`  P95响应时间：${metrics.p95Time.toFixed(2)}ms`);
  console.log(`  QPS：${metrics.qps.toFixed(2)}`);
}

/**
 * 场景5：搜索查询性能测试
 */
async function testSearchPerformance() {
  console.log('\n📝 场景5：搜索查询性能测试');
  console.log('='.repeat(60));
  
  const user = await prisma.user.findFirst({
    where: { username: { startsWith: 'test_user_' } },
  });
  
  if (!user) return;
  
  const searchTerms = ['车间', '隐患', '高处', '动火', '化学品'];
  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  
  for (const term of searchTerms) {
    for (let i = 0; i < CONFIG.TEST_ROUNDS; i++) {
      const testStart = Date.now();
      
      try {
        const result = await prisma.hazardRecord.findMany({
          where: {
            isVoided: false,
            visibilityRecords: {
              some: { userId: user.id },
            },
            OR: [
              { desc: { contains: term } },
              { location: { contains: term } },
              { type: { contains: term } },
            ],
          },
          take: CONFIG.PAGE_SIZE,
          select: {
            id: true,
            code: true,
            desc: true,
          },
        });
        
        const elapsed = Date.now() - testStart;
        times.push(elapsed);
        
        if (i === 0) {
          console.log(
            `  ✅ 关键词"${term}" | ` +
            `结果：${result.length}条 | ` +
            `耗时：${elapsed}ms`
          );
        }
      } catch (error) {
        errors++;
      }
    }
  }
  
  const totalTime = Date.now() - startTime;
  const metrics = calculateMetrics('搜索查询', times, errors, totalTime);
  testResults.push(metrics);
  
  console.log('\n📊 性能统计：');
  console.log(`  平均响应时间：${metrics.avgTime.toFixed(2)}ms`);
  console.log(`  P95响应时间：${metrics.p95Time.toFixed(2)}ms`);
}

/**
 * 场景6：并发访问压力测试
 */
async function testConcurrentAccess() {
  console.log('\n📝 场景6：并发访问压力测试');
  console.log('='.repeat(60));
  
  const users = await prisma.user.findMany({
    where: { username: { startsWith: 'test_user_' } },
    take: CONFIG.CONCURRENT_USERS,
  });
  
  console.log(`⏳ 启动${users.length}个并发查询...`);
  
  const times: number[] = [];
  let errors = 0;
  const startTime = Date.now();
  
  // 并发执行
  const promises = users.map(async (user, index) => {
    const testStart = Date.now();
    
    try {
      await prisma.hazardRecord.findMany({
        where: {
          isVoided: false,
          visibilityRecords: {
            some: { userId: user.id },
          },
        },
        take: CONFIG.PAGE_SIZE,
        select: {
          id: true,
          code: true,
          status: true,
        },
      });
      
      const elapsed = Date.now() - testStart;
      times.push(elapsed);
      
      if (index % 10 === 0) {
        console.log(`  ✅ 用户${index + 1} 完成，耗时：${elapsed}ms`);
      }
    } catch (error) {
      errors++;
      if (index % 10 === 0) {
        console.error(`  ❌ 用户${index + 1} 失败`);
      }
    }
  });
  
  await Promise.all(promises);
  
  const totalTime = Date.now() - startTime;
  const metrics = calculateMetrics('并发访问', times, errors, totalTime);
  testResults.push(metrics);
  
  console.log('\n📊 性能统计：');
  console.log(`  并发数：${users.length}`);
  console.log(`  总耗时：${totalTime}ms`);
  console.log(`  平均响应时间：${metrics.avgTime.toFixed(2)}ms`);
  console.log(`  P95响应时间：${metrics.p95Time.toFixed(2)}ms`);
  console.log(`  P99响应时间：${metrics.p99Time.toFixed(2)}ms`);
  console.log(`  QPS：${metrics.qps.toFixed(2)}`);
}

/**
 * 生成性能报告
 */
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 压力测试性能报告');
  console.log('='.repeat(60));
  
  // 表格头
  console.log('\n| 场景 | 平均(ms) | P50(ms) | P95(ms) | P99(ms) | QPS | 成功率 |');
  console.log('|------|----------|---------|---------|---------|-----|--------|');
  
  // 表格数据
  testResults.forEach(m => {
    const successRate = ((m.successCount / m.totalRequests) * 100).toFixed(1);
    console.log(
      `| ${m.scenario.padEnd(20)} | ` +
      `${m.avgTime.toFixed(2).padStart(8)} | ` +
      `${m.p50Time.toFixed(2).padStart(7)} | ` +
      `${m.p95Time.toFixed(2).padStart(7)} | ` +
      `${m.p99Time.toFixed(2).padStart(7)} | ` +
      `${m.qps.toFixed(1).padStart(3)} | ` +
      `${successRate.padStart(6)}% |`
    );
  });
  
  // 保存JSON报告
  const reportPath = path.join(process.cwd(), 'docs/stress-test-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    results: testResults,
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ 详细报告已保存：${reportPath}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 隐患可见性表压力测试 - 性能测试脚本');
  console.log('='.repeat(60));
  
  try {
    // 场景1：普通用户访问"我的任务"
    await testNormalUserMyTasks();
    
    // 场景2：管理员访问"我的任务"
    await testAdminUserMyTasks();
    
    // 场景3：分页查询性能测试
    await testPaginationPerformance();
    
    // 场景4：详情查询性能测试
    await testDetailQueryPerformance();
    
    // 场景5：搜索查询性能测试
    await testSearchPerformance();
    
    // 场景6：并发访问压力测试
    await testConcurrentAccess();
    
    // 生成性能报告
    generateReport();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 所有性能测试完成！');
    
  } catch (error) {
    console.error('\n❌ 错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行
main();
