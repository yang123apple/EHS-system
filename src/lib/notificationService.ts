/**
 * 通知服务 - 基于模板的消息通知管理
 * 支持模板驱动的通知创建和变量替换
 */

import { prisma } from '@/lib/prisma';

// 通知上下文数据类型
export interface NotificationContext {
  user?: {
    id: string;
    name: string;
    department?: string;
    [key: string]: any;
  };
  hazard?: {
    id: string;
    code: string;
    location?: string;
    status?: string;
    riskLevel?: string;
    [key: string]: any;
  };
  task?: {
    id: string;
    title: string;
    [key: string]: any;
  };
  permit?: {
    id: string;
    code: string;
    templateName?: string;
    projectName?: string;
    [key: string]: any;
  };
  training?: {
    id: string;
    title: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// 通知创建参数
export interface CreateNotificationParams {
  triggerEvent: string;
  recipientIds: string[];
  context: NotificationContext;
  relatedType?: string;
  relatedId?: string;
}

/**
 * 替换模板中的变量占位符
 * @param template 模板字符串，如 "{{user.name}}分配给您一个任务"
 * @param context 上下文数据
 */
function replaceVariables(template: string, context: NotificationContext): string {
  let result = template;
  
  // 匹配 {{变量名}} 格式
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = template.matchAll(regex);
  
  for (const match of matches) {
    const variable = match[1].trim();
    const value = getNestedValue(context, variable);
    result = result.replace(match[0], value !== undefined ? String(value) : '');
  }
  
  return result;
}

/**
 * 从嵌套对象中获取值
 * @param obj 对象
 * @param path 路径，如 "user.name"
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * 检查触发条件是否满足
 * @param condition 条件配置（JSON格式）
 * @param context 上下文数据
 */
function checkCondition(condition: string | null, context: NotificationContext): boolean {
  if (!condition) return true;
  
  try {
    const conditionObj = JSON.parse(condition);
    
    // 检查每个条件字段
    for (const [key, value] of Object.entries(conditionObj)) {
      const contextValue = getNestedValue(context, key);
      
      if (Array.isArray(value)) {
        // 如果条件值是数组，检查是否包含
        if (!value.includes(contextValue)) {
          return false;
        }
      } else if (contextValue !== value) {
        // 精确匹配
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('解析触发条件失败:', error);
    return true; // 解析失败时默认触发
  }
}

/**
 * 创建基于模板的通知
 * @param params 通知创建参数
 */
export async function createNotificationsFromTemplate(
  params: CreateNotificationParams
): Promise<{ success: boolean; count: number; error?: string }> {
  const { triggerEvent, recipientIds, context, relatedType, relatedId } = params;
  
  try {
    // 查找匹配的启用模板
    // @ts-ignore - NotificationTemplate 模型需要先运行 prisma generate
    const templates = await prisma.notificationTemplate?.findMany({
      where: {
        triggerEvent,
        isActive: true,
      },
    }) || [];
    
    if (templates.length === 0) {
      console.log(`⚠️ 未找到事件 "${triggerEvent}" 的启用模板，跳过通知创建`);
      return { success: true, count: 0 };
    }
    
    // 过滤满足条件的模板
    const matchedTemplates = templates.filter((template: any) => 
      checkCondition(template.triggerCondition, context)
    );
    
    if (matchedTemplates.length === 0) {
      console.log(`⚠️ 事件 "${triggerEvent}" 的模板条件不满足，跳过通知创建`);
      return { success: true, count: 0 };
    }
    
    // 为每个收件人和每个匹配的模板创建通知
    let createdCount = 0;
    
    for (const template of matchedTemplates) {
      const title = replaceVariables(template.title, context);
      const content = replaceVariables(template.content, context);
      
      // 批量创建通知
      for (const recipientId of recipientIds) {
        await prisma.notification.create({
          data: {
            userId: recipientId,
            type: template.type,
            title,
            content,
            relatedType: relatedType || template.type,
            relatedId,
            isRead: false,
          },
        });
        createdCount++;
      }
    }
    
    console.log(`✅ 成功创建 ${createdCount} 条通知 (事件: ${triggerEvent})`);
    return { success: true, count: createdCount };
  } catch (error) {
    console.error('创建通知失败:', error);
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 快捷创建培训通知
 */
export async function createTrainingNotification(
  event: 'training_assigned' | 'training_updated' | 'training_completed',
  recipientIds: string[],
  taskData: { id: string; title: string; description?: string },
  assignerName?: string
) {
  return createNotificationsFromTemplate({
    triggerEvent: event,
    recipientIds,
    context: {
      user: assignerName ? { name: assignerName, id: '' } : undefined,
      training: taskData,
      task: { id: taskData.id, title: taskData.title },
    },
    relatedType: 'training_task',
    relatedId: taskData.id,
  });
}

/**
 * 快捷创建作业票通知
 */
export async function createPermitNotification(
  event: 'permit_submitted' | 'permit_approved' | 'permit_rejected' | 'permit_pending_approval',
  recipientIds: string[],
  permitData: {
    id: string;
    code?: string;
    templateName?: string;
    projectName?: string;
    stepName?: string;
    stepNumber?: number;
  },
  operatorName?: string
) {
  return createNotificationsFromTemplate({
    triggerEvent: event,
    recipientIds,
    context: {
      user: operatorName ? { name: operatorName, id: '' } : undefined,
      permit: {
        ...permitData,
        code: permitData.code || '',
      },
    },
    relatedType: 'permit',
    relatedId: permitData.id,
  });
}

/**
 * 快捷创建隐患通知
 */
export async function createHazardNotification(
  event: 'hazard_created' | 'hazard_assigned' | 'hazard_updated' | 'hazard_completed',
  recipientIds: string[],
  hazardData: {
    id: string;
    code: string;
    location?: string;
    status?: string;
    riskLevel?: string;
    description?: string;
  },
  operatorName?: string
) {
  return createNotificationsFromTemplate({
    triggerEvent: event,
    recipientIds,
    context: {
      user: operatorName ? { name: operatorName, id: '' } : undefined,
      hazard: hazardData,
    },
    relatedType: 'hazard',
    relatedId: hazardData.id,
  });
}
