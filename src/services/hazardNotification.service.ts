/**
 * 隐患通知服务
 * 负责在隐患流程中生成通知数据（不直接操作数据库）
 * 注意：此服务可在客户端和服务端使用，不包含 Prisma 操作
 */

import { HazardRecord } from '@/types/hidden-danger';

/**
 * 通知类型
 */
export enum HazardNotificationType {
  ASSIGNED = 'hazard_assigned',              // 隐患被指派
  CC = 'hazard_cc',                          // 隐患抄送
  SUBMITTED = 'hazard_submitted',            // 隐患已提交
  RECTIFIED = 'hazard_rectified',            // 隐患已整改
  VERIFIED = 'hazard_verified',              // 隐患已验收
  REJECTED = 'hazard_rejected',              // 隐患被驳回
  EXTENSION_REQUESTED = 'hazard_extension',  // 延期申请
  CLOSED = 'hazard_closed',                  // 隐患已闭环
}

/**
 * 通知数据类型
 */
export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedType: string;
  relatedId: string;
  isRead: boolean;
}

/**
 * 隐患通知服务
 * 注意：此服务只生成通知数据，不执行数据库操作
 */
export class HazardNotificationService {
  /**
   * 生成处理人通知数据
   */
  static generateHandlerNotifications(params: {
    hazard: HazardRecord;
    handlerIds: string[];
    handlerNames: string[];
    action: string;
    operatorName: string;
  }): NotificationData[] {
    const { hazard, handlerIds, handlerNames, action, operatorName } = params;

    if (!handlerIds || handlerIds.length === 0) {
      console.log('⚠️ 没有处理人需要通知');
      return [];
    }

    // 根据动作类型确定通知类型和内容
    let notificationType: string;
    let title: string;
    let content: string;

    const hazardDesc = hazard.desc || '未知隐患';
    
    switch (action) {
      case '提交上报':
        notificationType = HazardNotificationType.SUBMITTED;
        title = '隐患待处理';
        content = `${operatorName} 上报了隐患"${hazardDesc}"，请及时处理`;
        break;
      case '指派整改':
        notificationType = HazardNotificationType.ASSIGNED;
        title = '隐患待整改';
        content = `${operatorName} 指派您整改隐患"${hazardDesc}"，请在 ${hazard.deadline || '规定时间内'} 完成`;
        break;
      case '提交整改':
        notificationType = HazardNotificationType.RECTIFIED;
        title = '隐患待验收';
        content = `${operatorName} 已完成隐患"${hazardDesc}"的整改，请验收`;
        break;
      case '验收闭环':
        notificationType = HazardNotificationType.VERIFIED;
        title = '隐患已验收';
        content = `${operatorName} 已验收隐患"${hazardDesc}"`;
        break;
      case '驳回':
        notificationType = HazardNotificationType.REJECTED;
        title = '隐患被驳回';
        content = `${operatorName} 驳回了隐患"${hazardDesc}"，请重新处理`;
        break;
      case '延期申请':
        notificationType = HazardNotificationType.EXTENSION_REQUESTED;
        title = '隐患延期申请';
        content = `${operatorName} 申请延期处理隐患"${hazardDesc}"`;
        break;
      default:
        console.log('⚠️ 未知的动作类型:', action);
        return [];
    }

    // 生成通知数据
    const notifications = handlerIds.map((userId, index) => ({
      userId,
      type: notificationType,
      title,
      content: `${content}（处理人：${handlerNames[index] || '未知'}）`,
      relatedType: 'hazard' as const,
      relatedId: hazard.id,
      isRead: false,
    }));

    console.log(`📋 生成处理人通知数据: ${title} → ${handlerNames.join('、')}`);
    return notifications;
  }

  /**
   * 生成抄送人通知数据
   */
  static generateCCNotifications(params: {
    hazard: HazardRecord;
    ccUserIds: string[];
    ccUserNames: string[];
    action: string;
    operatorName: string;
  }): NotificationData[] {
    const { hazard, ccUserIds, ccUserNames, action, operatorName } = params;

    if (!ccUserIds || ccUserIds.length === 0) {
      console.log('⚠️ 没有抄送人需要通知');
      return [];
    }

    const hazardDesc = hazard.desc || '未知隐患';
    const title = '隐患抄送通知';
    const content = `${operatorName} ${action}了隐患"${hazardDesc}"，抄送给您知悉`;

    // 生成通知数据
    const notifications = ccUserIds.map((userId, index) => ({
      userId,
      type: HazardNotificationType.CC,
      title,
      content: `${content}（抄送给：${ccUserNames[index] || '未知'}）`,
      relatedType: 'hazard' as const,
      relatedId: hazard.id,
      isRead: false,
    }));

    console.log(`📋 生成抄送通知数据: ${title} → ${ccUserNames.join('、')}`);
    return notifications;
  }

  /**
   * 生成隐患闭环通知数据（通知上报人）
   */
  static generateClosedNotification(params: {
    hazard: HazardRecord;
    reporterId: string;
    reporterName: string;
    operatorName: string;
  }): NotificationData[] {
    const { hazard, reporterId, reporterName, operatorName } = params;

    if (!reporterId) {
      console.log('⚠️ 没有上报人信息');
      return [];
    }

    const hazardDesc = hazard.desc || '未知隐患';
    
    const notification = {
      userId: reporterId,
      type: HazardNotificationType.CLOSED,
      title: '隐患已闭环',
      content: `您上报的隐患"${hazardDesc}"已由 ${operatorName} 验收闭环`,
      relatedType: 'hazard' as const,
      relatedId: hazard.id,
      isRead: false,
    };

    console.log(`📋 生成闭环通知数据 → ${reporterName}`);
    return [notification];
  }

  /**
   * 生成自定义通知数据（用于特殊场景）
   */
  static generateCustomNotifications(params: {
    userIds: string[];
    type: string;
    title: string;
    content: string;
    relatedId?: string;
  }): NotificationData[] {
    const { userIds, type, title, content, relatedId } = params;

    if (!userIds || userIds.length === 0) {
      return [];
    }

    const notifications = userIds.map(userId => ({
      userId,
      type,
      title,
      content,
      relatedType: 'hazard' as const,
      relatedId: relatedId || '',
      isRead: false,
    }));

    console.log(`📋 生成自定义通知数据: ${title} → ${userIds.length}人`);
    return notifications;
  }
}
