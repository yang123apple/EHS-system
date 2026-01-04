import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandling, withAuth } from '@/middleware/auth';

// 开始考试 - 获取题目（支持随机抽题）
export const GET = withErrorHandling(
  withAuth(async (req: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }, user) => {
    const { assignmentId } = await params;

    try {
      // 获取 assignment 信息
      const assignment = await prisma.trainingAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          task: {
            include: {
              material: {
                include: {
                  questions: true
                }
              }
            }
          },
          user: {
            select: { id: true }
          }
        }
      });

      if (!assignment) {
        return NextResponse.json({ error: '任务分配不存在' }, { status: 404 });
      }

      // 权限检查：只能查看自己的任务
      if (assignment.userId !== user.id) {
        return NextResponse.json({ error: '无权访问此任务' }, { status: 403 });
      }

      // 检查是否已通过考试
      if (assignment.isPassed) {
        return NextResponse.json({ 
          error: '您已通过考试，不能再次参加',
          isPassed: true 
        }, { status: 403 });
      }

      const material = assignment.task.material;

      // 检查是否需要考试
      if (!material.isExamRequired) {
        return NextResponse.json({ error: '该学习内容不需要考试' }, { status: 400 });
      }

      // 检查是否有题目
      if (!material.questions || material.questions.length === 0) {
        return NextResponse.json({ error: '该学习内容暂无考试题目' }, { status: 400 });
      }

      let questions = material.questions;

      // 根据考试模式处理题目
      if (material.examMode === 'random' && material.randomQuestionCount) {
        const questionCount = Math.min(material.randomQuestionCount, material.questions.length);
        
        // Fisher-Yates 洗牌算法
        const shuffled = [...material.questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // 截取前 N 道题
        questions = shuffled.slice(0, questionCount);
      }

      // 解析题目数据（options 和 answer 从 JSON 字符串转为对象）
      const parsedQuestions = questions.map(q => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        answer: typeof q.answer === 'string' ? JSON.parse(q.answer) : q.answer,
        score: q.score
      }));

      return NextResponse.json({
        assignment: {
          id: assignment.id,
          taskId: assignment.taskId,
          status: assignment.status,
          isPassed: assignment.isPassed
        },
        material: {
          id: material.id,
          title: material.title,
          passingScore: material.passingScore,
          examMode: material.examMode,
          randomQuestionCount: material.randomQuestionCount
        },
        questions: parsedQuestions,
        totalQuestions: parsedQuestions.length,
        totalScore: parsedQuestions.reduce((sum, q) => sum + q.score, 0)
      });
    } catch (error: any) {
      console.error('[Start Exam API] 错误:', error);
      return NextResponse.json({ 
        error: '获取考试题目失败: ' + (error.message || '未知错误') 
      }, { status: 500 });
    }
  })
);

