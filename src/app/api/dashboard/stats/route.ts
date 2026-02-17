import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/middleware/auth';
import { ACTIVE_WORK_PERMIT_STATUSES } from '@/constants/workPermit';

/**
 * GET /api/dashboard/stats - 获取 Dashboard 实时统计数据
 *
 * 根据用户权限返回相应的统计数据：
 * - 进行中作业数量（使用正向状态白名单，避免遗漏新增状态）
 * - 待审批单据数量
 * - 本月隐患数量
 * - 在线人员数量（优化查询，使用索引）
 */
export const GET = withAuth(async (request: NextRequest, context, user) => {
  try {
    // 获取时间范围
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // ✅ 时区说明：Prisma 统一使用 UTC 时间，oneHourAgo 会被正确转换为数据库格式
    // 如果未来迁移到其他数据库（如 PostgreSQL with timezone），需要确保时区配置一致
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 解析用户权限
    let userPermissions: Record<string, any> = {};
    if (user.role !== 'admin') {
      try {
        userPermissions = typeof user.permissions === 'string'
          ? JSON.parse(user.permissions)
          : user.permissions || {};
      } catch (e) {
        console.error('[Dashboard Stats] 解析用户权限失败:', e);
      }
    }

    const hasWorkPermitAccess = user.role === 'admin' || userPermissions.work_permit !== undefined;
    const hasHazardAccess = user.role === 'admin' || userPermissions.hidden_danger !== undefined;

    // 并行获取统计数据
    const statsPromises = [];

    // 1. 进行中作业数量 - 使用正向状态白名单（更安全）
    if (hasWorkPermitAccess) {
      // ✅ 修复：使用统一的常量定义，避免新增状态被遗漏
      statsPromises.push(
        prisma.workPermitRecord.count({
          where: {
            status: {
              in: [...ACTIVE_WORK_PERMIT_STATUSES]
            }
          }
        }).catch((error) => {
          console.error('[Dashboard Stats] 查询进行中作业失败:', error);
          return 0;
        })
      );
    } else {
      statsPromises.push(Promise.resolve(0));
    }

    // 2. 待审批单据数量
    // ⚠️ 简化处理：统计所有 pending 状态的作业许可
    // 🔄 TODO：未来优化 - 应查询当前用户在审批流程中的待审批单据
    if (hasWorkPermitAccess) {
      statsPromises.push(
        prisma.workPermitRecord.count({
          where: {
            status: 'pending'
          }
        }).catch((error) => {
          console.error('[Dashboard Stats] 查询待审批单据失败:', error);
          return 0;
        })
      );
    } else {
      statsPromises.push(Promise.resolve(0));
    }

    // 3. 本月隐患数量 - 优化查询性能
    if (hasHazardAccess) {
      if (user.role === 'admin') {
        // 管理员：直接统计所有隐患
        statsPromises.push(
          prisma.hazardRecord.count({
            where: {
              reportTime: {
                gte: monthStart
              }
            }
          }).catch((error) => {
            console.error('[Dashboard Stats] 查询本月隐患失败:', error);
            return 0;
          })
        );
      } else {
        // 非管理员：优化查询 - 分两步执行效率更高
        // ✅ 性能优化：先查询可见的隐患ID（利用 userId 索引），再统计本月数量（利用 reportTime 索引）
        statsPromises.push(
          (async () => {
            try {
              // 第一步：查询用户可见的所有隐患ID（快速，有索引）
              const visibleHazards = await prisma.hazardVisibility.findMany({
                where: {
                  userId: user.id
                },
                select: {
                  hazardId: true
                }
              });

              if (visibleHazards.length === 0) {
                // 降级方案：查询用户上报或负责的隐患
                return await prisma.hazardRecord.count({
                  where: {
                    reportTime: { gte: monthStart },
                    OR: [
                      { reporterId: user.id },
                      { responsibleId: user.id }
                    ]
                  }
                }).catch(() => 0);
              }

              const visibleHazardIds = visibleHazards.map(v => v.hazardId);

              // 第二步：统计本月的可见隐患（利用 IN + reportTime 索引）
              return await prisma.hazardRecord.count({
                where: {
                  id: { in: visibleHazardIds },
                  reportTime: { gte: monthStart }
                }
              });

            } catch (error) {
              console.error('[Dashboard Stats] 查询用户可见隐患失败:', error);
              // 降级方案：查询用户上报或负责的隐患
              return await prisma.hazardRecord.count({
                where: {
                  reportTime: { gte: monthStart },
                  OR: [
                    { reporterId: user.id },
                    { responsibleId: user.id }
                  ]
                }
              }).catch(() => 0);
            }
          })()
        );
      }
    } else {
      statsPromises.push(Promise.resolve(0));
    }

    // 4. 在线人员数量 - 优化查询，利用索引
    // ✅ 性能优化：使用 groupBy 或 distinct 减少数据传输
    statsPromises.push(
      (async () => {
        try {
          // SQLite 不支持 distinct count，使用 groupBy
          const activeUsers = await prisma.systemLog.groupBy({
            by: ['userId'],
            where: {
              createdAt: { gte: oneHourAgo },
              userId: { not: null }
            }
          });

          return activeUsers.length;
        } catch (error) {
          console.error('[Dashboard Stats] 查询在线人员失败:', error);
          return 0;
        }
      })()
    );

    // 等待所有统计完成
    const [
      ongoingWorks,
      pendingApprovals,
      monthlyHazards,
      onlineUsers
    ] = await Promise.all(statsPromises);

    // 返回统计数据
    return NextResponse.json({
      success: true,
      data: {
        ongoingWorks,
        pendingApprovals,
        monthlyHazards,
        onlineUsers
      }
    });

  } catch (error) {
    console.error('[Dashboard Stats API] 获取统计数据失败:', error);
    return NextResponse.json({
      success: false,
      message: '获取统计数据失败',
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
});
