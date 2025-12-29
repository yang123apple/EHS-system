// 测试通知系统
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNotifications() {
  try {
    console.log('🧪 开始测试通知系统...\n');

    // 1. 检查是否有用户
    const users = await prisma.user.findMany({ take: 1 });
    if (users.length === 0) {
      console.error('❌ 没有找到用户，无法测试');
      return;
    }

    const testUser = users[0];
    console.log(`✅ 找到测试用户: ${testUser.name} (${testUser.id})\n`);

    // 2. 创建测试通知
    console.log('📝 创建测试通知...');
    const notification = await prisma.notification.create({
      data: {
        userId: testUser.id,
        type: 'test',
        title: '测试通知',
        content: '这是一个测试通知，用于验证通知系统是否正常工作',
        relatedType: 'system',
        relatedId: 'test-001',
        isRead: false,
      },
    });
    console.log(`✅ 创建成功，通知ID: ${notification.id}\n`);

    // 3. 查询通知
    console.log('🔍 查询用户通知...');
    const notifications = await prisma.notification.findMany({
      where: { userId: testUser.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log(`✅ 找到 ${notifications.length} 条通知\n`);

    // 4. 统计未读数量
    const unreadCount = await prisma.notification.count({
      where: {
        userId: testUser.id,
        isRead: false,
      },
    });
    console.log(`✅ 未读通知数量: ${unreadCount}\n`);

    // 5. 标记为已读
    console.log('✔️ 标记通知为已读...');
    await prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });
    console.log('✅ 标记成功\n');

    // 6. 再次统计未读数量
    const newUnreadCount = await prisma.notification.count({
      where: {
        userId: testUser.id,
        isRead: false,
      },
    });
    console.log(`✅ 更新后的未读数量: ${newUnreadCount}\n`);

    console.log('🎉 所有测试通过！通知系统工作正常。\n');
    
    // 清理测试数据
    console.log('🧹 清理测试数据...');
    await prisma.notification.delete({
      where: { id: notification.id },
    });
    console.log('✅ 清理完成\n');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('\n错误详情:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testNotifications();
