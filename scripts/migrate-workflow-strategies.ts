/**
 * 工作流策略配置数据迁移脚本
 * 
 * 功能：
 * 1. 将隐患管理的工作流配置迁移到新的统一格式
 * 2. 将作业票管理的工作流配置迁移到新的统一格式
 * 3. 备份原始数据
 * 4. 生成迁移报告
 * 
 * 使用方法：
 * npx tsx scripts/migrate-workflow-strategies.ts [--dry-run] [--backup]
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  convertHazardConfigToUnified,
  convertWorkPermitConfigToUnified,
  convertUnifiedToHazardConfig,
  convertUnifiedToWorkPermitConfig,
} from '../src/components/workflow/converter';

const prisma = new PrismaClient();

interface MigrationReport {
  startTime: string;
  endTime?: string;
  mode: 'dry-run' | 'production';
  hazardConfig: {
    total: number;
    migrated: number;
    failed: number;
    errors: Array<{ key: string; error: string }>;
  };
  workPermitTemplates: {
    total: number;
    migrated: number;
    failed: number;
    errors: Array<{ id: string; name: string; error: string }>;
  };
  backupPath?: string;
}

const report: MigrationReport = {
  startTime: new Date().toISOString(),
  mode: 'production',
  hazardConfig: { total: 0, migrated: 0, failed: 0, errors: [] },
  workPermitTemplates: { total: 0, migrated: 0, failed: 0, errors: [] },
};

/**
 * 备份原始数据
 */
async function backupData(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', 'workflow-migration');
  const backupPath = path.join(backupDir, `backup-${timestamp}.json`);

  // 确保备份目录存在
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 读取现有数据
  const hazardConfigs = await prisma.hazardConfig.findMany();
  const workPermitTemplates = await prisma.workPermitTemplate.findMany({
    select: {
      id: true,
      name: true,
      workflowConfig: true,
    },
  });

  const backupData = {
    timestamp,
    hazardConfigs,
    workPermitTemplates,
  };

  // 写入备份文件
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`✅ 数据已备份到: ${backupPath}`);

  return backupPath;
}

/**
 * 迁移隐患管理工作流配置
 */
async function migrateHazardConfigs(dryRun: boolean): Promise<void> {
  console.log('\n📋 开始迁移隐患管理工作流配置...');

  const configs = await prisma.hazardConfig.findMany({
    where: {
      key: {
        in: ['workflow_steps', 'handler_strategy', 'workflow_config'],
      },
    },
  });

  report.hazardConfig.total = configs.length;

  for (const config of configs) {
    try {
      const oldValue = JSON.parse(config.value);
      
      // 如果是工作流步骤配置
      if (config.key === 'workflow_steps' && Array.isArray(oldValue)) {
        const newSteps = oldValue.map((step: any) => {
          if (step.handlerStrategy) {
            const newStrategies = Array.isArray(step.handlerStrategy)
              ? step.handlerStrategy.map((s: any) => convertHazardConfigToUnified(s))
              : [convertHazardConfigToUnified(step.handlerStrategy)];

            return {
              ...step,
              strategies: newStrategies,
              handlerStrategy: undefined, // 移除旧字段
            };
          }
          return step;
        });

        const newValue = JSON.stringify(newSteps);

        if (!dryRun) {
          await prisma.hazardConfig.update({
            where: { id: config.id },
            data: { value: newValue },
          });
        }

        console.log(`  ✓ 已迁移配置: ${config.key}`);
        report.hazardConfig.migrated++;
      }
      // 如果是单个策略配置
      else if (config.key === 'handler_strategy') {
        const newStrategy = convertHazardConfigToUnified(oldValue);
        const newValue = JSON.stringify(newStrategy);

        if (!dryRun) {
          await prisma.hazardConfig.update({
            where: { id: config.id },
            data: { value: newValue },
          });
        }

        console.log(`  ✓ 已迁移配置: ${config.key}`);
        report.hazardConfig.migrated++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ 迁移失败: ${config.key} - ${errorMsg}`);
      report.hazardConfig.failed++;
      report.hazardConfig.errors.push({
        key: config.key,
        error: errorMsg,
      });
    }
  }

  console.log(`✅ 隐患配置迁移完成: ${report.hazardConfig.migrated}/${report.hazardConfig.total} 成功`);
}

/**
 * 迁移作业票模板工作流配置
 */
async function migrateWorkPermitTemplates(dryRun: boolean): Promise<void> {
  console.log('\n📋 开始迁移作业票模板工作流配置...');

  const templates = await prisma.workPermitTemplate.findMany({
    where: {
      workflowConfig: {
        not: null,
      },
    },
  });

  report.workPermitTemplates.total = templates.length;

  for (const template of templates) {
    try {
      if (!template.workflowConfig) continue;

      const oldConfig = JSON.parse(template.workflowConfig);

      // 如果是工作流步骤配置
      if (oldConfig.steps && Array.isArray(oldConfig.steps)) {
        const newSteps = oldConfig.steps.map((step: any) => {
          if (step.approverStrategy || step.strategies) {
            // 支持旧的 approverStrategy 或新的 strategies
            const oldStrategies = step.approverStrategy || step.strategies || [];
            const strategiesArray = Array.isArray(oldStrategies) ? oldStrategies : [oldStrategies];

            const newStrategies = strategiesArray.map((s: any) =>
              convertWorkPermitConfigToUnified(s)
            );

            return {
              ...step,
              strategies: newStrategies,
              approverStrategy: undefined, // 移除旧字段
            };
          }
          return step;
        });

        const newConfig = {
          ...oldConfig,
          steps: newSteps,
        };

        const newValue = JSON.stringify(newConfig);

        if (!dryRun) {
          await prisma.workPermitTemplate.update({
            where: { id: template.id },
            data: { workflowConfig: newValue },
          });
        }

        console.log(`  ✓ 已迁移模板: ${template.name} (ID: ${template.id})`);
        report.workPermitTemplates.migrated++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ 迁移失败: ${template.name} (${template.id}) - ${errorMsg}`);
      report.workPermitTemplates.failed++;
      report.workPermitTemplates.errors.push({
        id: template.id,
        name: template.name,
        error: errorMsg,
      });
    }
  }

  console.log(`✅ 作业票模板迁移完成: ${report.workPermitTemplates.migrated}/${report.workPermitTemplates.total} 成功`);
}

/**
 * 验证迁移结果
 */
async function validateMigration(): Promise<boolean> {
  console.log('\n🔍 验证迁移结果...');

  let isValid = true;

  // 验证隐患配置
  const hazardConfigs = await prisma.hazardConfig.findMany({
    where: {
      key: {
        in: ['workflow_steps', 'handler_strategy', 'workflow_config'],
      },
    },
  });

  for (const config of hazardConfigs) {
    try {
      const value = JSON.parse(config.value);
      
      // 检查是否包含新格式的 strategies 字段
      if (config.key === 'workflow_steps' && Array.isArray(value)) {
        const hasNewFormat = value.every((step: any) => 
          !step.handlerStrategy && (step.strategies || step.strategies === undefined)
        );
        
        if (!hasNewFormat) {
          console.error(`  ✗ 配置仍包含旧格式: ${config.key}`);
          isValid = false;
        }
      }
    } catch (error) {
      console.error(`  ✗ 配置格式错误: ${config.key}`);
      isValid = false;
    }
  }

  // 验证作业票模板
  const templates = await prisma.workPermitTemplate.findMany({
    where: {
      workflowConfig: {
        not: null,
      },
    },
  });

  for (const template of templates) {
    try {
      if (!template.workflowConfig) continue;
      
      const config = JSON.parse(template.workflowConfig);
      
      if (config.steps && Array.isArray(config.steps)) {
        const hasNewFormat = config.steps.every((step: any) =>
          !step.approverStrategy && (step.strategies || step.strategies === undefined)
        );
        
        if (!hasNewFormat) {
          console.error(`  ✗ 模板仍包含旧格式: ${template.name}`);
          isValid = false;
        }
      }
    } catch (error) {
      console.error(`  ✗ 模板配置格式错误: ${template.name}`);
      isValid = false;
    }
  }

  if (isValid) {
    console.log('✅ 验证通过：所有配置已成功迁移到新格式');
  } else {
    console.log('❌ 验证失败：部分配置仍使用旧格式');
  }

  return isValid;
}

/**
 * 生成迁移报告
 */
function generateReport(): void {
  report.endTime = new Date().toISOString();

  const reportDir = path.join(process.cwd(), 'backups', 'workflow-migration');
  const reportPath = path.join(
    reportDir,
    `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );

  // 确保报告目录存在
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('📊 迁移报告');
  console.log('='.repeat(60));
  console.log(`开始时间: ${report.startTime}`);
  console.log(`结束时间: ${report.endTime}`);
  console.log(`运行模式: ${report.mode}`);
  console.log('\n隐患管理配置:');
  console.log(`  总数: ${report.hazardConfig.total}`);
  console.log(`  成功: ${report.hazardConfig.migrated}`);
  console.log(`  失败: ${report.hazardConfig.failed}`);
  
  if (report.hazardConfig.errors.length > 0) {
    console.log('\n  错误详情:');
    report.hazardConfig.errors.forEach((err) => {
      console.log(`    - ${err.key}: ${err.error}`);
    });
  }

  console.log('\n作业票模板配置:');
  console.log(`  总数: ${report.workPermitTemplates.total}`);
  console.log(`  成功: ${report.workPermitTemplates.migrated}`);
  console.log(`  失败: ${report.workPermitTemplates.failed}`);

  if (report.workPermitTemplates.errors.length > 0) {
    console.log('\n  错误详情:');
    report.workPermitTemplates.errors.forEach((err) => {
      console.log(`    - ${err.name} (${err.id}): ${err.error}`);
    });
  }

  if (report.backupPath) {
    console.log(`\n备份文件: ${report.backupPath}`);
  }

  console.log(`\n详细报告: ${reportPath}`);
  console.log('='.repeat(60));
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const shouldBackup = args.includes('--backup') || !dryRun;

  console.log('🚀 工作流策略配置迁移脚本');
  console.log('='.repeat(60));
  
  if (dryRun) {
    console.log('⚠️  运行模式: DRY RUN（模拟运行，不会修改数据）');
    report.mode = 'dry-run';
  } else {
    console.log('🔧 运行模式: PRODUCTION（将实际修改数据库）');
  }

  try {
    // 备份数据
    if (shouldBackup) {
      report.backupPath = await backupData();
    }

    // 执行迁移
    await migrateHazardConfigs(dryRun);
    await migrateWorkPermitTemplates(dryRun);

    // 验证迁移（仅在非 dry-run 模式下）
    if (!dryRun) {
      await validateMigration();
    }

    // 生成报告
    generateReport();

    const totalMigrated =
      report.hazardConfig.migrated + report.workPermitTemplates.migrated;
    const totalFailed = report.hazardConfig.failed + report.workPermitTemplates.failed;

    if (totalFailed === 0) {
      console.log('\n✅ 迁移成功完成！');
    } else {
      console.log(`\n⚠️  迁移完成，但有 ${totalFailed} 个项目失败`);
      console.log('请查看报告了解详情');
    }

    if (dryRun) {
      console.log('\n💡 这是模拟运行。要执行实际迁移，请运行:');
      console.log('   npx tsx scripts/migrate-workflow-strategies.ts');
    }
  } catch (error) {
    console.error('\n❌ 迁移过程中发生错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行主函数
main();
