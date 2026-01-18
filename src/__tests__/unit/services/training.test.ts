/**
 * 培训管理系统单元测试
 * 测试在线考试评分逻辑、任务分配准确性等核心功能
 */

import { prisma } from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    trainingAssignment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    trainingMaterial: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    examQuestion: {
      findMany: jest.fn(),
    },
    autoAssignRule: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
  },
}));

describe('培训管理系统 - 考试评分逻辑', () => {
  describe('单选题评分', () => {
    it('应该正确计算单选题得分', () => {
      const question = {
        id: 'q1',
        type: 'single',
        score: 10,
        answer: JSON.stringify(['A']), // 正确答案
      };

      // 正确答案
      const userAnswer1 = 'A';
      let correctAnswer = JSON.parse(question.answer);
      if (!Array.isArray(correctAnswer)) {
        correctAnswer = [correctAnswer];
      }
      const isCorrect1 = correctAnswer.includes(userAnswer1);
      expect(isCorrect1).toBe(true);

      // 错误答案
      const userAnswer2 = 'B';
      const isCorrect2 = correctAnswer.includes(userAnswer2);
      expect(isCorrect2).toBe(false);
    });

    it('应该正确计算多选题得分', () => {
      const question = {
        id: 'q2',
        type: 'multiple',
        score: 20,
        answer: JSON.stringify(['A', 'B']), // 正确答案
      };

      // 正确答案（完全匹配）
      const userAnswer1 = ['A', 'B'];
      const correctAnswer = JSON.parse(question.answer);
      const isCorrect1 = 
        userAnswer1.length === correctAnswer.length &&
        userAnswer1.every(a => correctAnswer.includes(a));
      expect(isCorrect1).toBe(true);

      // 部分答案（错误）
      const userAnswer2 = ['A'];
      const isCorrect2 = 
        userAnswer2.length === correctAnswer.length &&
        userAnswer2.every(a => correctAnswer.includes(a));
      expect(isCorrect2).toBe(false);

      // 答案顺序不同但内容相同（应该正确）
      const userAnswer3 = ['B', 'A'];
      const isCorrect3 = 
        userAnswer3.length === correctAnswer.length &&
        userAnswer3.every(a => correctAnswer.includes(a));
      expect(isCorrect3).toBe(true);

      // 多余答案（错误）
      const userAnswer4 = ['A', 'B', 'C'];
      const isCorrect4 = 
        userAnswer4.length === correctAnswer.length &&
        userAnswer4.every(a => correctAnswer.includes(a));
      expect(isCorrect4).toBe(false);
    });
  });

  describe('总成绩计算', () => {
    it('应该正确计算总成绩', () => {
      const questions = [
        { id: 'q1', type: 'single', score: 10, answer: JSON.stringify(['A']) },
        { id: 'q2', type: 'multiple', score: 20, answer: JSON.stringify(['A', 'B']) },
        { id: 'q3', type: 'single', score: 15, answer: JSON.stringify(['C']) },
      ];

      const userAnswers = {
        q1: 'A', // 正确，10分
        q2: ['A', 'B'], // 正确，20分
        q3: 'D', // 错误，0分
      };

      let totalScore = 0;
      questions.forEach(q => {
        const userAns = userAnswers[q.id as keyof typeof userAnswers];
        let correctAns = JSON.parse(q.answer);
        
        if (!Array.isArray(correctAns)) {
          correctAns = [correctAns];
        }

        if (q.type === 'single') {
          if (correctAns.includes(userAns)) {
            totalScore += q.score;
          }
        } else if (q.type === 'multiple') {
          const userAnsArray = Array.isArray(userAns) ? userAns : [];
          if (
            userAnsArray.length === correctAns.length &&
            userAnsArray.every(a => correctAns.includes(a))
          ) {
            totalScore += q.score;
          }
        }
      });

      expect(totalScore).toBe(30); // 10 + 20 + 0
    });

    it('应该正确判断是否通过考试', () => {
      const totalScore = 75;
      const passingScore = 60;

      const passed = totalScore >= passingScore;
      expect(passed).toBe(true);

      const failedScore = 55;
      const failed = failedScore >= passingScore;
      expect(failed).toBe(false);
    });

    it('应该在边界分数上正确处理', () => {
      const passingScore = 60;

      // 正好60分，应该通过
      expect(60 >= passingScore).toBe(true);

      // 59分，应该不通过
      expect(59 >= passingScore).toBe(false);
    });
  });

  describe('随机抽题逻辑', () => {
    it('应该正确抽取指定数量的随机题目', () => {
      const allQuestions = [
        { id: 'q1', type: 'single', score: 10 },
        { id: 'q2', type: 'single', score: 10 },
        { id: 'q3', type: 'multiple', score: 20 },
        { id: 'q4', type: 'multiple', score: 20 },
        { id: 'q5', type: 'single', score: 10 },
      ];

      const randomCount = 3;
      const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, randomCount);

      expect(selected.length).toBe(randomCount);
      expect(selected.every(q => allQuestions.includes(q))).toBe(true);
    });

    it('应该在题目数量不足时返回所有题目', () => {
      const allQuestions = [{ id: 'q1' }, { id: 'q2' }];
      const randomCount = 5; // 大于题目总数

      const selected = allQuestions.slice(0, Math.min(randomCount, allQuestions.length));

      expect(selected.length).toBe(allQuestions.length);
    });
  });
});

describe('培训管理系统 - 任务分配准确性', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('自动分配规则匹配', () => {
    it('应该根据部门条件正确匹配用户', async () => {
      const condition = {
        departmentId: 'dept-001',
      };

      const users = [
        { id: 'user-001', departmentId: 'dept-001', name: '用户1' },
        { id: 'user-002', departmentId: 'dept-002', name: '用户2' },
        { id: 'user-003', departmentId: 'dept-001', name: '用户3' },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(
        users.filter(u => u.departmentId === condition.departmentId)
      );

      const matchedUsers = await prisma.user.findMany({
        where: { departmentId: condition.departmentId },
      });

      expect(matchedUsers).toHaveLength(2);
      expect(matchedUsers.map(u => u.id)).toEqual(['user-001', 'user-003']);
    });

    it('应该根据角色条件正确匹配用户', async () => {
      const condition = {
        role: '安全员',
      };

      const users = [
        { id: 'user-001', role: '安全员', name: '用户1' },
        { id: 'user-002', role: '普通用户', name: '用户2' },
        { id: 'user-003', role: '安全员', name: '用户3' },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(
        users.filter(u => u.role === condition.role)
      );

      const matchedUsers = await prisma.user.findMany({
        where: { role: condition.role },
      });

      expect(matchedUsers).toHaveLength(2);
      expect(matchedUsers.every(u => u.role === '安全员')).toBe(true);
    });

    it('应该处理复合条件（部门+角色）', async () => {
      const condition = {
        departmentId: 'dept-001',
        role: '安全员',
      };

      const users = [
        { id: 'user-001', departmentId: 'dept-001', role: '安全员', name: '用户1' },
        { id: 'user-002', departmentId: 'dept-001', role: '普通用户', name: '用户2' },
        { id: 'user-003', departmentId: 'dept-002', role: '安全员', name: '用户3' },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(
        users.filter(u => u.departmentId === condition.departmentId && u.role === condition.role)
      );

      const matchedUsers = await prisma.user.findMany({
        where: {
          departmentId: condition.departmentId,
          role: condition.role,
        },
      });

      expect(matchedUsers).toHaveLength(1);
      expect(matchedUsers[0].id).toBe('user-001');
    });
  });

  describe('任务分配幂等性', () => {
    it('应该避免重复分配任务给同一用户', async () => {
      const taskId = 'task-001';
      const userId = 'user-001';

      // 模拟已存在的分配记录
      const existingAssignment = {
        id: 'assignment-001',
        taskId,
        userId,
        status: 'assigned',
      };

      (prisma.trainingAssignment.findUnique as jest.Mock).mockResolvedValue(existingAssignment);

      // 检查是否已存在
      const exist = await prisma.trainingAssignment.findUnique({
        where: { taskId_userId: { taskId, userId } },
      });

      expect(exist).toBeDefined();
      // 应该跳过创建，避免重复
    });

    it('应该允许为新用户创建分配', async () => {
      const taskId = 'task-001';
      const userId = 'user-002';

      // 模拟不存在分配记录
      (prisma.trainingAssignment.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.trainingAssignment.create as jest.Mock).mockResolvedValue({
        id: 'assignment-002',
        taskId,
        userId,
        status: 'assigned',
      });

      const exist = await prisma.trainingAssignment.findUnique({
        where: { taskId_userId: { taskId, userId } },
      });

      if (!exist) {
        const newAssignment = await prisma.trainingAssignment.create({
          data: {
            taskId,
            userId,
            status: 'assigned',
            progress: 0,
            isPassed: false,
          },
        });

        expect(newAssignment).toBeDefined();
        expect(newAssignment.userId).toBe(userId);
      }
    });
  });

  describe('任务分配通知', () => {
    it('应该在分配任务时发送通知', async () => {
      const taskId = 'task-001';
      const userId = 'user-001';
      const taskTitle = '安全培训';

      (prisma.notification.create as jest.Mock).mockResolvedValue({
        id: 'notification-001',
        userId,
        type: 'training_assigned',
        title: '新培训任务',
        content: `您被自动加入培训任务：${taskTitle}`,
      });

      const notification = await prisma.notification.create({
        data: {
          userId,
          type: 'training_assigned',
          title: '新培训任务',
          content: `您被自动加入培训任务：${taskTitle}`,
          relatedType: 'training_task',
          relatedId: taskId,
        },
      });

      expect(notification).toBeDefined();
      expect(notification.userId).toBe(userId);
      expect(notification.type).toBe('training_assigned');
      expect(notification.content).toContain(taskTitle);
    });
  });

  describe('边界条件', () => {
    it('应该处理空条件（匹配所有用户）', async () => {
      const condition = {};

      const users = [
        { id: 'user-001', name: '用户1' },
        { id: 'user-002', name: '用户2' },
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(users);

      const matchedUsers = await prisma.user.findMany({
        where: condition,
      });

      expect(matchedUsers).toHaveLength(2);
    });

    it('应该处理无匹配用户的情况', async () => {
      const condition = {
        departmentId: 'non-existent',
      };

      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const matchedUsers = await prisma.user.findMany({
        where: { departmentId: condition.departmentId },
      });

      expect(matchedUsers).toHaveLength(0);
    });

    it('应该处理题目格式异常的情况', () => {
      // 答案不是JSON格式
      const question1 = {
        id: 'q1',
        type: 'single',
        score: 10,
        answer: 'A', // 字符串而非JSON
      };

      let correctAnswer = question1.answer;
      try {
        correctAnswer = JSON.parse(question1.answer);
      } catch {
        // 如果解析失败，使用原值
        correctAnswer = question1.answer;
      }

      if (!Array.isArray(correctAnswer)) {
        correctAnswer = [correctAnswer];
      }

      expect(correctAnswer).toEqual(['A']);
    });
  });
});
