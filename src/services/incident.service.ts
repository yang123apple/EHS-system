/**
 * 事故事件管理服务
 * 负责事故的CRUD操作、工作流集成、日志记录和通知发送
 */

import { prisma } from '@/lib/prisma';
import { SystemLogService } from '@/services/systemLog.service';
import { HazardNotificationService, type NotificationData } from '@/services/hazardNotification.service';
import { minioStorageService } from '@/services/storage/MinioStorageService';
import { createSignature } from '@/services/signatureService';
import { IncidentDispatchEngine, IncidentDispatchAction } from '@/app/incident/_utils/incident-dispatch-engine';
import { INCIDENT_WORKFLOW_CONFIG } from '@/app/incident/_utils/workflow-config';
import type { User } from '@/lib/permissions';

export interface IncidentCreateInput {
  type: 'injury' | 'near_miss' | 'property_damage' | 'environmental';
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  occurredAt: Date;
  location: string;
  description: string;
  reporterId: string;
  departmentId?: string;
  photos?: string[]; // MinIO路径数组
  attachments?: string[]; // MinIO路径数组
}

export interface IncidentUpdateInput {
  description?: string;
  location?: string;
  departmentId?: string;
  directCause?: string;
  indirectCause?: string;
  managementCause?: string;
  rootCause?: string;
  correctiveActions?: Array<{ action: string; deadline?: Date; responsibleId?: string }>;
  preventiveActions?: Array<{ action: string; deadline?: Date; responsibleId?: string }>;
  actionDeadline?: Date;
  actionResponsibleId?: string;
  photos?: string[];
  attachments?: string[];
}

export interface InvestigationSubmitInput {
  directCause: string;
  indirectCause: string;
  managementCause: string;
  rootCause: string;
  correctiveActions: Array<{ action: string; deadline?: Date; responsibleId?: string }>;
  preventiveActions: Array<{ action: string; deadline?: Date; responsibleId?: string }>;
  actionDeadline: Date;
  actionResponsibleId: string;
  investigationReport?: string; // MinIO路径
  photos?: string[];
  attachments?: string[];
  signature?: string; // 数字签名（Base64）
}

export class IncidentService {
  /**
   * 生成事故编号
   */
  private static async generateIncidentCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = 'INC';
    
    // 查询当年最大编号
    const maxCode = await prisma.incident.findFirst({
      where: {
        code: { startsWith: `${prefix}-${year}-` }
      },
      orderBy: { code: 'desc' }
    });
    
    if (maxCode?.code) {
      const lastNum = parseInt(maxCode.code.split('-')[2]) || 0;
      return `${prefix}-${year}-${String(lastNum + 1).padStart(3, '0')}`;
    }
    
    return `${prefix}-${year}-001`;
  }

  /**
   * 上报事故
   */
  static async reportIncident(
    input: IncidentCreateInput,
    operator: User
  ) {
    try {
      // 获取上报人信息
      const reporter = await prisma.user.findUnique({
        where: { id: input.reporterId },
        include: { department: true }
      });

      if (!reporter) {
        throw new Error('上报人不存在');
      }

      // 生成事故编号
      const code = await this.generateIncidentCode();

      // 创建事故记录
      const incident = await prisma.incident.create({
        data: {
          code,
          type: input.type,
          severity: input.severity,
          occurredAt: input.occurredAt,
          location: input.location,
          description: input.description,
          reporterId: input.reporterId,
          reporterName: reporter.name,
          reporterDept: reporter.department?.name || null,
          departmentId: input.departmentId || null,
          departmentName: input.departmentId 
            ? (await prisma.department.findUnique({ where: { id: input.departmentId } }))?.name || null
            : null,
          photos: input.photos ? JSON.stringify(input.photos) : null,
          attachments: input.attachments ? JSON.stringify(input.attachments) : null,
          status: 'reported',
          currentStepIndex: 0,
        },
        include: {
          reporter: true,
          department: true,
        }
      });

      // 记录系统日志
      await SystemLogService.createLog({
        userId: operator.id,
        userName: operator.name,
        userRole: operator.role,
        userDepartment: operator.departmentName,
        userDepartmentId: operator.departmentId,
        action: 'CREATE',
        actionLabel: '上报事故',
        module: 'INCIDENT',
        targetId: code,
        targetType: 'incident',
        targetLabel: `${input.type} - ${input.location}`,
        details: `上报了${this.getTypeLabel(input.type)}事故，严重程度：${this.getSeverityLabel(input.severity)}`,
        afterData: {
          code: incident.code,
          type: incident.type,
          severity: incident.severity,
          location: incident.location,
          status: incident.status,
        },
        userRoleInAction: '上报人',
      });

      // 发送通知（通知管理员和安全负责人）
      await this.sendNotifications(incident.id, 'reported', operator.name);

      return incident;
    } catch (error) {
      console.error('[IncidentService] 上报事故失败:', error);
      throw error;
    }
  }

  /**
   * 更新事故信息
   */
  static async updateIncident(
    incidentId: string,
    input: IncidentUpdateInput,
    operator: User
  ) {
    try {
      const oldIncident = await prisma.incident.findUnique({
        where: { id: incidentId }
      });

      if (!oldIncident) {
        throw new Error('事故不存在');
      }

      // 构建更新数据
      const updateData: any = {};
      if (input.description !== undefined) updateData.description = input.description;
      if (input.location !== undefined) updateData.location = input.location;
      if (input.departmentId !== undefined) {
        updateData.departmentId = input.departmentId;
        if (input.departmentId) {
          const dept = await prisma.department.findUnique({ where: { id: input.departmentId } });
          updateData.departmentName = dept?.name || null;
        } else {
          updateData.departmentName = null;
        }
      }
      if (input.directCause !== undefined) updateData.directCause = input.directCause;
      if (input.indirectCause !== undefined) updateData.indirectCause = input.indirectCause;
      if (input.managementCause !== undefined) updateData.managementCause = input.managementCause;
      if (input.rootCause !== undefined) updateData.rootCause = input.rootCause;
      if (input.correctiveActions !== undefined) {
        updateData.correctiveActions = JSON.stringify(input.correctiveActions);
      }
      if (input.preventiveActions !== undefined) {
        updateData.preventiveActions = JSON.stringify(input.preventiveActions);
      }
      if (input.actionDeadline !== undefined) updateData.actionDeadline = input.actionDeadline;
      if (input.actionResponsibleId !== undefined) {
        updateData.actionResponsibleId = input.actionResponsibleId;
        if (input.actionResponsibleId) {
          const user = await prisma.user.findUnique({ where: { id: input.actionResponsibleId } });
          updateData.actionResponsibleName = user?.name || null;
        }
      }
      if (input.photos !== undefined) updateData.photos = JSON.stringify(input.photos);
      if (input.attachments !== undefined) updateData.attachments = JSON.stringify(input.attachments);

      const updatedIncident = await prisma.incident.update({
        where: { id: incidentId },
        data: updateData,
      });

      // 记录系统日志
      const changes = SystemLogService.compareObjects(oldIncident, updatedIncident);
      await SystemLogService.createLog({
        userId: operator.id,
        userName: operator.name,
        userRole: operator.role,
        userDepartment: operator.departmentName,
        userDepartmentId: operator.departmentId,
        action: 'UPDATE',
        actionLabel: '更新事故信息',
        module: 'INCIDENT',
        targetId: oldIncident.code || incidentId,
        targetType: 'incident',
        targetLabel: `${oldIncident.type} - ${oldIncident.location}`,
        details: '更新了事故信息',
        beforeData: oldIncident,
        afterData: updatedIncident,
        changes,
      });

      return updatedIncident;
    } catch (error) {
      console.error('[IncidentService] 更新事故失败:', error);
      throw error;
    }
  }

  /**
   * 提交调查报告
   */
  static async submitInvestigation(
    incidentId: string,
    input: InvestigationSubmitInput,
    operator: User
  ) {
    try {
      const incident = await prisma.incident.findUnique({
        where: { id: incidentId },
        include: {
          reporter: true,
          department: true,
        }
      });

      if (!incident) {
        throw new Error('事故不存在');
      }

      if (incident.status !== 'reported' && incident.status !== 'investigating') {
        throw new Error('当前状态不允许提交调查报告');
      }

      // 如果提供了签名，验证并记录签名
      if (input.signature) {
        // 准备调查数据快照（用于签名验证）
        const investigationSnapshot = JSON.stringify({
          incidentId: incident.id,
          incidentCode: incident.code,
          directCause: input.directCause,
          indirectCause: input.indirectCause,
          managementCause: input.managementCause,
          rootCause: input.rootCause,
          correctiveActions: input.correctiveActions,
          preventiveActions: input.preventiveActions,
          actionDeadline: input.actionDeadline,
          actionResponsibleId: input.actionResponsibleId,
          submittedAt: new Date().toISOString(),
        });

        // 创建签名记录
        await createSignature(
          {
            incidentId: incident.id,
            signerId: operator.id,
            signerName: operator.name,
            action: 'investigate',
            comment: '提交调查报告',
            stepIndex: incident.currentStepIndex || 1,
            stepName: '调查',
          },
          investigationSnapshot,
          false // 不保存完整快照，仅保存Hash
        );
      }

      // 获取所有用户和部门（用于工作流引擎）
      const [allUsers, departments] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            name: true,
            role: true,
            departmentId: true,
          }
        }),
        prisma.department.findMany({
          select: {
            id: true,
            name: true,
            parentId: true,
          }
        })
      ]);

      // 使用工作流引擎处理状态流转
      const dispatchResult = await IncidentDispatchEngine.dispatch({
        incident: incident as any,
        action: IncidentDispatchAction.SUBMIT_INVESTIGATION,
        operator: {
          id: operator.id,
          name: operator.name,
          role: operator.role,
        },
        workflowSteps: INCIDENT_WORKFLOW_CONFIG,
        allUsers: allUsers as any,
        departments: departments as any,
        currentStepIndex: incident.currentStepIndex || 0,
        additionalData: {
          rootCause: input.rootCause,
          actionResponsibleId: input.actionResponsibleId,
        }
      });

      if (!dispatchResult.success) {
        throw new Error(dispatchResult.error || '工作流流转失败');
      }

      // 获取整改负责人信息
      const responsible = await prisma.user.findUnique({
        where: { id: input.actionResponsibleId }
      });

      // 更新事故状态和调查信息
      const updatedIncident = await prisma.incident.update({
        where: { id: incidentId },
        data: {
          directCause: input.directCause,
          indirectCause: input.indirectCause,
          managementCause: input.managementCause,
          rootCause: input.rootCause,
          correctiveActions: JSON.stringify(input.correctiveActions),
          preventiveActions: JSON.stringify(input.preventiveActions),
          actionDeadline: input.actionDeadline,
          actionResponsibleId: input.actionResponsibleId,
          actionResponsibleName: responsible?.name || null,
          investigationReport: input.investigationReport || null,
          photos: input.photos ? JSON.stringify(input.photos) : incident.photos,
          attachments: input.attachments ? JSON.stringify(input.attachments) : incident.attachments,
          status: dispatchResult.newStatus as any,
          currentStepIndex: dispatchResult.nextStepIndex ?? (incident.currentStepIndex || 0) + 1,
          currentStepId: dispatchResult.currentStep,
          // 更新处理人信息
          currentHandlerId: dispatchResult.handlers.userIds[0] || null,
          currentHandlerName: dispatchResult.handlers.userNames[0] || null,
        }
      });

      // 记录系统日志
      await SystemLogService.createLog({
        userId: operator.id,
        userName: operator.name,
        userRole: operator.role,
        userDepartment: operator.departmentName,
        userDepartmentId: operator.departmentId,
        action: 'SUBMIT',
        actionLabel: dispatchResult.log.action,
        module: 'INCIDENT',
        targetId: incident.code || incidentId,
        targetType: 'incident',
        targetLabel: `${incident.type} - ${incident.location}`,
        details: dispatchResult.log.changes,
        afterData: {
          status: updatedIncident.status,
          hasInvestigation: true,
          rootCause: updatedIncident.rootCause,
          currentStepIndex: updatedIncident.currentStepIndex,
        },
        userRoleInAction: '调查人',
      });

      // 发送通知（通过工作流引擎生成的通知数据）
      if (dispatchResult.notifications?.length > 0) {
        await prisma.notification.createMany({
          data: dispatchResult.notifications
        });
      }

      return updatedIncident;
    } catch (error) {
      console.error('[IncidentService] 提交调查报告失败:', error);
      throw error;
    }
  }

  /**
   * 结案事故
   */
  static async closeIncident(
    incidentId: string,
    closeReason: string,
    operator: User
  ) {
    try {
      const incident = await prisma.incident.findUnique({
        where: { id: incidentId }
      });

      if (!incident) {
        throw new Error('事故不存在');
      }

      if (incident.status === 'closed') {
        throw new Error('事故已结案');
      }

      // 更新事故状态
      const updatedIncident = await prisma.incident.update({
        where: { id: incidentId },
        data: {
          status: 'closed',
          closerId: operator.id,
          closerName: operator.name,
          closeTime: new Date(),
          closeReason,
          currentStepIndex: -1, // 工作流结束
        }
      });

      // 记录系统日志
      await SystemLogService.createLog({
        userId: operator.id,
        userName: operator.name,
        userRole: operator.role,
        userDepartment: operator.departmentName,
        userDepartmentId: operator.departmentId,
        action: 'CLOSE',
        actionLabel: '结案事故',
        module: 'INCIDENT',
        targetId: incident.code || incidentId,
        targetType: 'incident',
        targetLabel: `${incident.type} - ${incident.location}`,
        details: `结案事故，原因：${closeReason}`,
        afterData: {
          status: updatedIncident.status,
          closeTime: updatedIncident.closeTime,
        },
        userRoleInAction: '审批人',
      });

      // 发送通知（通知相关人员）
      await this.sendNotifications(incidentId, 'closed', operator.name);

      return updatedIncident;
    } catch (error) {
      console.error('[IncidentService] 结案事故失败:', error);
      throw error;
    }
  }

  /**
   * 获取事故列表
   */
  static async getIncidents(filters?: {
    status?: string;
    type?: string;
    severity?: string;
    departmentId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.type) where.type = filters.type;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.startDate || filters?.endDate) {
      where.occurredAt = {};
      if (filters.startDate) where.occurredAt.gte = filters.startDate;
      if (filters.endDate) where.occurredAt.lte = filters.endDate;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          reporter: {
            select: { id: true, name: true, department: true }
          },
          department: true,
        }
      }),
      prisma.incident.count({ where })
    ]);

    return {
      data: incidents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  /**
   * 获取单个事故详情
   */
  static async getIncidentById(incidentId: string) {
    return prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        reporter: {
          select: { id: true, name: true, department: true }
        },
        department: true,
        signatures: {
          orderBy: { signedAt: 'desc' }
        }
      }
    });
  }

  /**
   * 发送通知
   */
  private static async sendNotifications(
    incidentId: string,
    action: string,
    operatorName: string
  ) {
    try {
      const incident = await prisma.incident.findUnique({
        where: { id: incidentId },
        include: { department: true }
      });

      if (!incident) return;

      // 生成通知数据（参考 HazardNotificationService 的模式）
      const notifications: NotificationData[] = [];

      // 根据动作类型确定通知对象
      switch (action) {
        case 'reported':
          // 通知管理员和安全负责人
          const admins = await prisma.user.findMany({
            where: { role: 'admin' }
          });
          admins.forEach(admin => {
            notifications.push({
              userId: admin.id,
              type: 'incident_reported',
              title: '新事故上报',
              content: `${operatorName} 上报了${this.getTypeLabel(incident.type)}事故，请及时处理`,
              relatedType: 'incident',
              relatedId: incidentId,
              isRead: false,
            });
          });
          break;

        case 'investigation_submitted':
          // 通知审批人（这里简化处理，实际应根据工作流配置）
          const reviewers = await prisma.user.findMany({
            where: { role: { in: ['admin', 'manager'] } }
          });
          reviewers.forEach(reviewer => {
            notifications.push({
              userId: reviewer.id,
              type: 'incident_investigation_submitted',
              title: '调查报告待审批',
              content: `${operatorName} 提交了事故调查报告，请审批`,
              relatedType: 'incident',
              relatedId: incidentId,
              isRead: false,
            });
          });
          break;

        case 'closed':
          // 通知相关人员
          if (incident.reporterId) {
            notifications.push({
              userId: incident.reporterId,
              type: 'incident_closed',
              title: '事故已结案',
              content: `事故"${incident.description.substring(0, 50)}"已结案`,
              relatedType: 'incident',
              relatedId: incidentId,
              isRead: false,
            });
          }
          break;
      }

      // 批量创建通知（这里需要调用通知服务的创建方法）
      // 注意：实际实现中应该调用 notificationService.createBatch 或类似方法
      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications
        });
      }
    } catch (error) {
      console.error('[IncidentService] 发送通知失败:', error);
      // 通知失败不应影响主流程
    }
  }

  /**
   * 获取事故类型标签
   */
  private static getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      injury: '伤害',
      near_miss: '未遂',
      property_damage: '财产损失',
      environmental: '环境',
    };
    return labels[type] || type;
  }

  /**
   * 获取严重程度标签
   */
  private static getSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      minor: '轻微',
      moderate: '中等',
      serious: '严重',
      critical: '重大',
    };
    return labels[severity] || severity;
  }
}

