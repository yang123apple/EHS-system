import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { HazardWorkflowConfig } from '@/types/hidden-danger';
import { withErrorHandling, withAuth, withAdmin } from '@/middleware/auth';

const WORKFLOW_FILE = path.join(process.cwd(), 'data', 'hazard-workflow.json');

// 确保数据目录和文件存在
async function ensureWorkflowFile() {
  try {
    await fs.access(WORKFLOW_FILE);
  } catch {
    // 文件不存在，创建默认配置
    const defaultConfig: HazardWorkflowConfig = {
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
      steps: [
        {
          id: 'report',
          name: '上报并指派',
          description: '隐患上报，执行人强制为发起人',
          handlerStrategy: {
            type: 'fixed',
            description: '执行人：上报人（系统自动）',
            fixedUsers: []
          },
          ccRules: []
        },
        {
          id: 'assign',
          name: '开始整改',
          description: '指派整改责任人，默认为管理员',
          handlerStrategy: {
            type: 'role',
            description: '默认：管理员角色',
            roleName: '管理员'
          },
          ccRules: []
        },
        {
          id: 'rectify',
          name: '提交整改',
          description: '整改责任人提交整改结果',
          handlerStrategy: {
            type: 'fixed',
            description: '执行人：整改责任人（系统自动）',
            fixedUsers: []
          },
          ccRules: []
        },
        {
          id: 'verify',
          name: '验收闭环',
          description: '验收整改结果，默认为管理员',
          handlerStrategy: {
            type: 'role',
            description: '默认：管理员角色',
            roleName: '管理员'
          },
          ccRules: []
        }
      ]
    };
    
    const dataDir = path.dirname(WORKFLOW_FILE);
    try {
      await fs.access(dataDir);
    } catch {
      await fs.mkdir(dataDir, { recursive: true });
    }
    
    await fs.writeFile(WORKFLOW_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }
}

/**
 * GET /api/hazards/workflow
 * 获取工作流配置
 */
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, context, user) => {
    await ensureWorkflowFile();
    const data = await fs.readFile(WORKFLOW_FILE, 'utf-8');
    const config: HazardWorkflowConfig = JSON.parse(data);
    
    return NextResponse.json({
      success: true,
      data: config
    });
  })
);

/**
 * POST /api/hazards/workflow
 * 保存工作流配置
 */
export const POST = withErrorHandling(
  withAdmin(async (req: NextRequest, context, user) => {
    const body = await req.json();
    const { config } = body;
    const userId = user.id;
    const userName = user.name;
    
    if (!config || !config.steps) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid workflow configuration'
        },
        { status: 400 }
      );
    }
    
    // 验证配置结构
    const validatedConfig: HazardWorkflowConfig = {
      version: (config.version || 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: userName || userId || 'unknown',
      steps: config.steps.map((step: any) => ({
        id: step.id,
        name: step.name,
        description: step.description || '',
        handlerStrategy: step.handlerStrategy,
        ccRules: step.ccRules || []
      }))
    };
    
    // 保存到文件
    await ensureWorkflowFile();
    await fs.writeFile(
      WORKFLOW_FILE,
      JSON.stringify(validatedConfig, null, 2),
      'utf-8'
    );
    
    return NextResponse.json({
      success: true,
      data: validatedConfig,
      message: '工作流配置已保存'
    });
  })
);
