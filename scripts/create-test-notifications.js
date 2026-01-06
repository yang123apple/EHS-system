// 测试脚本：创建测试通知数据
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestNotifications() {
  try {
    console.log('开始创建测试通知...');
    
    // 创建几条测试通知（假设用户ID为已存在的用户）
    const notifications = await Promise.all([
      prisma.notification.create({
        data: {
          userId: 'admin-id', // 替换为实际的用户ID
          type: 'approval_pending',
          title: '待审批作业票',
          content: '【动火作业】 测试项目 - 等待您审批（第2步：安全部门）',
          relatedType: 'permit',
          relatedId: 'test-permit-id',
          isRead: false,
        }
      }),
      prisma.notification.create({
        data: {
          userId: 'admin-id',
          type: 'approval_passed',
          title: '作业票已通过',
          content: '您提交的【高处作业】已通过安全部门审批',
          relatedType: 'permit',
          relatedId: 'test-permit-id-2',
          isRead: false,
        }
      }),
      prisma.notification.create({
        data: {
          userId: 'admin-id',
          type: 'hazard_assigned',
          title: '隐患已分配',
          content: '新的隐患【车间漏油】已分配给您处理',
          relatedType: 'hazard',
          relatedId: 'test-hazard-id',
          isRead: true,
        }
      }),
    ]);
    
    console.log('✅ 成功创建', notifications.length, '条测试通知');
    notifications.forEach((n, i) => {
      console.log(`${i + 1}. ${n.title} - ${n.isRead ? '已读' : '未读'}`);
    });
    
  } catch (error) {
    console.error('❌ 创建测试通知失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestNotifications();
