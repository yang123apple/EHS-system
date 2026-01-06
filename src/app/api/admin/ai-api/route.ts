import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SystemLogService } from '@/services/systemLog.service';
import { getUserFromRequest } from '@/middleware/auth';

// 获取AI API配置列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // 获取调用日志
    if (action === 'logs') {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const configId = searchParams.get('configId') || '';
      const status = searchParams.get('status') || '';
      const requestSource = searchParams.get('requestSource') || '';
      
      const skip = (page - 1) * limit;
      const where: any = {};

      if (configId) where.configId = configId;
      if (status) where.status = status;
      if (requestSource) where.requestSource = requestSource;

      const [logs, total] = await Promise.all([
        prisma.aIApiLog.findMany({
          where,
          include: {
            config: {
              select: {
                name: true,
                provider: true,
                model: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.aIApiLog.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          logs,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    }

    // 获取统计数据
    if (action === 'stats') {
      const configId = searchParams.get('configId');
      const groupBy = searchParams.get('groupBy'); // 'user' | 'department'
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const where: any = {};
      if (configId) where.configId = configId;

      // 如果按用户或部门统计
      if (groupBy === 'user' || groupBy === 'department') {
        const logs = await prisma.aIApiLog.findMany({
          where: {
            ...where,
            requestBy: groupBy === 'user' ? { not: null } : undefined,
          },
          select: {
            requestBy: true,
            tokens: true,
            status: true,
            createdAt: true,
          },
        });

        // 获取用户信息
        const userIds = [...new Set(logs.map(l => l.requestBy).filter(Boolean))];
        const users = await prisma.user.findMany({
          where: { id: { in: userIds as string[] } },
          include: { department: true },
        });

        const userMap = new Map(users.map(u => [u.id, u]));

        // 按用户或部门分组统计
        const statsMap = new Map<string, {
          id: string;
          name: string;
          departmentId?: string;
          departmentName?: string;
          totalCalls: number;
          todayCalls: number;
          monthCalls: number;
          totalTokens: number;
          successCalls: number;
        }>();

        logs.forEach(log => {
          if (!log.requestBy) return;
          const user = userMap.get(log.requestBy);
          if (!user) return;

          const key = groupBy === 'user' ? user.id : (user.departmentId || 'unknown');
          const name = groupBy === 'user' ? user.name : (user.department?.name || '未知部门');

          if (!statsMap.has(key)) {
            statsMap.set(key, {
              id: key,
              name,
              departmentId: user.departmentId || undefined,
              departmentName: user.department?.name || undefined,
              totalCalls: 0,
              todayCalls: 0,
              monthCalls: 0,
              totalTokens: 0,
              successCalls: 0,
            });
          }

          const stat = statsMap.get(key)!;
          stat.totalCalls++;
          if (log.createdAt >= today) stat.todayCalls++;
          if (log.createdAt >= thisMonth) stat.monthCalls++;
          if (log.tokens) stat.totalTokens += log.tokens;
          if (log.status === 'success') stat.successCalls++;
        });

        return NextResponse.json({
          success: true,
          data: Array.from(statsMap.values()).sort((a, b) => b.totalCalls - a.totalCalls),
        });
      }

      // 总体统计
      const [
        totalCalls,
        todayCalls,
        monthCalls,
        successCount,
        avgDuration,
        totalTokens,
        rateLimitedCalls,
      ] = await Promise.all([
        prisma.aIApiLog.count({ where }),
        prisma.aIApiLog.count({ where: { ...where, createdAt: { gte: today } } }),
        prisma.aIApiLog.count({ where: { ...where, createdAt: { gte: thisMonth } } }),
        prisma.aIApiLog.count({ where: { ...where, status: 'success' } }),
        prisma.aIApiLog.aggregate({
          where: { ...where, duration: { not: null } },
          _avg: { duration: true },
        }).then(result => Math.round(result._avg.duration || 0)),
        prisma.aIApiLog.aggregate({
          where: { ...where, tokens: { not: null } },
          _sum: { tokens: true },
        }).then(result => result._sum.tokens || 0),
        prisma.aIApiLog.count({ where: { ...where, status: 'rate_limited' } }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          totalCalls,
          todayCalls,
          monthCalls,
          successRate: totalCalls > 0 ? parseFloat(((successCount / totalCalls) * 100).toFixed(2)) : 0,
          avgDuration,
          totalTokens,
          rateLimitedCalls,
        },
      });
    }

    // 获取限流策略列表
    if (action === 'rate-limits') {
      const rateLimits = await prisma.aIApiRateLimit.findMany({
        orderBy: { createdAt: 'desc' },
        // 注意：schema中没有直接关联，需要通过userId查询用户
      });

      // 获取关联的用户和部门信息
      const userIds = rateLimits.filter(r => r.userId).map(r => r.userId!);
      const deptIds = rateLimits.filter(r => r.departmentId).map(r => r.departmentId!);
      
      const [users, departments] = await Promise.all([
        userIds.length > 0 ? prisma.user.findMany({
          where: { id: { in: userIds } },
          include: { department: true },
        }) : [],
        deptIds.length > 0 ? prisma.department.findMany({
          where: { id: { in: deptIds } },
        }) : [],
      ]);

      const userMap = new Map(users.map(u => [u.id, u]));
      const deptMap = new Map(departments.map(d => [d.id, d]));

      const enrichedRateLimits = rateLimits.map(limit => ({
        ...limit,
        userName: limit.userId ? userMap.get(limit.userId)?.name : null,
        departmentName: limit.departmentId ? deptMap.get(limit.departmentId)?.name : null,
      }));

      return NextResponse.json({
        success: true,
        data: enrichedRateLimits,
      });
    }

    // 获取配置列表
    const configs = await prisma.aIApiConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // 隐藏敏感信息
    const sanitizedConfigs = configs.map(config => ({
      ...config,
      apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : '',
    }));

    return NextResponse.json({
      success: true,
      data: sanitizedConfigs,
    });
  } catch (error) {
    console.error('获取AI API配置失败:', error);
    return NextResponse.json(
      { success: false, message: '获取配置失败' },
      { status: 500 }
    );
  }
}

// 创建AI API配置或限流策略
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action; // 'config' | 'rate-limit'

    // 创建限流策略
    if (action === 'rate-limit') {
      const { userId, departmentId, dailyLimit, isActive } = body;

      if (!dailyLimit || dailyLimit <= 0) {
        return NextResponse.json(
          { success: false, message: '每日限制必须大于0' },
          { status: 400 }
        );
      }

      // 检查是否已存在
      const existing = await prisma.aIApiRateLimit.findUnique({
        where: {
          userId_departmentId: {
            userId: userId || null,
            departmentId: departmentId || null,
          },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, message: '该用户/部门的限流策略已存在' },
          { status: 400 }
        );
      }

      const rateLimit = await prisma.aIApiRateLimit.create({
        data: {
          userId: userId || null,
          departmentId: departmentId || null,
          dailyLimit,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      // 记录操作日志
      const user = await getUserFromRequest(request);
      if (user) {
        const userWithDept = await prisma.user.findUnique({
          where: { id: user.id },
          include: { department: true },
        });
        if (userWithDept) {
          await SystemLogService.createLog({
            userId: userWithDept.id,
            userName: userWithDept.name,
            userRole: userWithDept.role,
            userDepartment: userWithDept.department?.name || undefined,
            userDepartmentId: userWithDept.departmentId || undefined,
            action: 'CREATE',
            actionLabel: '创建AI API限流策略',
            module: 'SYSTEM',
            targetType: 'ai_api_rate_limit',
            targetId: rateLimit.id,
            details: `创建了${userId ? '用户' : departmentId ? '部门' : '全局'}限流策略，每日限制${dailyLimit}次`,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: rateLimit,
        message: '创建成功',
      });
    }

    // 创建API配置
    const { 
      name, 
      provider, 
      apiKey, 
      endpoint, 
      model,
      maxTokens,
      temperature,
      isActive,
      rateLimitPerMinute,
      rateLimitPerDay,
    } = body;

    if (!name || !provider || !apiKey || !endpoint) {
      return NextResponse.json(
        { success: false, message: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 检查名称是否已存在
    const existing = await prisma.aIApiConfig.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'API名称已存在' },
        { status: 400 }
      );
    }

    const config = await prisma.aIApiConfig.create({
      data: {
        name,
        provider,
        apiKey,
        endpoint,
        model: model || null,
        maxTokens: maxTokens || 2000,
        temperature: temperature !== undefined ? temperature : 0.7,
        isActive: isActive !== undefined ? isActive : true,
        rateLimitPerMinute: rateLimitPerMinute || 1000,
        rateLimitPerDay: rateLimitPerDay || 50000,
      },
    });

    // 记录操作日志
    const user = await getUserFromRequest(request);
    if (user) {
      const userWithDept = await prisma.user.findUnique({
        where: { id: user.id },
        include: { department: true },
      });
      if (userWithDept) {
        await SystemLogService.createLog({
          userId: userWithDept.id,
          userName: userWithDept.name,
          userRole: userWithDept.role,
          userDepartment: userWithDept.department?.name || undefined,
          userDepartmentId: userWithDept.departmentId || undefined,
          action: 'CREATE',
          actionLabel: '创建AI API配置',
          module: 'SYSTEM',
          targetType: 'ai_api_config',
          targetId: config.id,
          targetLabel: config.name,
          details: `创建了AI API配置：${config.name} (${config.provider})`,
        });
      }
    }

    // 隐藏敏感信息
    const sanitizedConfig = {
      ...config,
      apiKey: '***' + config.apiKey.slice(-4),
    };

    return NextResponse.json({
      success: true,
      data: sanitizedConfig,
      message: '创建成功',
    });
  } catch (error) {
    console.error('创建失败:', error);
    return NextResponse.json(
      { success: false, message: '创建失败' },
      { status: 500 }
    );
  }
}


// 更新AI API配置或限流策略
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, action, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少ID' },
        { status: 400 }
      );
    }

    // 更新限流策略
    if (action === 'rate-limit') {
      const oldLimit = await prisma.aIApiRateLimit.findUnique({
        where: { id },
      });

      if (!oldLimit) {
        return NextResponse.json(
          { success: false, message: '记录不存在' },
          { status: 404 }
        );
      }

      const rateLimit = await prisma.aIApiRateLimit.update({
        where: { id },
        data,
      });

      // 记录操作日志
      const user = await getUserFromRequest(request);
      if (user) {
        const userWithDept = await prisma.user.findUnique({
          where: { id: user.id },
          include: { department: true },
        });
        if (userWithDept) {
          await SystemLogService.createLog({
            userId: userWithDept.id,
            userName: userWithDept.name,
            userRole: userWithDept.role,
            userDepartment: userWithDept.department?.name || undefined,
            userDepartmentId: userWithDept.departmentId || undefined,
            action: 'UPDATE',
            actionLabel: '更新AI API限流策略',
            module: 'SYSTEM',
            targetType: 'ai_api_rate_limit',
            targetId: rateLimit.id,
            details: `更新了限流策略，每日限制从${oldLimit.dailyLimit}次改为${rateLimit.dailyLimit}次`,
            beforeData: oldLimit,
            afterData: rateLimit,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: rateLimit,
        message: '更新成功',
      });
    }

    // 更新API配置
    // 如果更新名称，检查冲突
    if (data.name) {
      const existing = await prisma.aIApiConfig.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, message: 'API名称已存在' },
          { status: 400 }
        );
      }
    }

    // 如果apiKey为masked值，则不更新
    if (data.apiKey && data.apiKey.startsWith('***')) {
      delete data.apiKey;
    }

    const oldConfig = await prisma.aIApiConfig.findUnique({
      where: { id },
    });

    const config = await prisma.aIApiConfig.update({
      where: { id },
      data,
    });

    // 记录操作日志
    const user = await getUserFromRequest(request);
    if (user && oldConfig) {
      const userWithDept = await prisma.user.findUnique({
        where: { id: user.id },
        include: { department: true },
      });
      if (userWithDept) {
        await SystemLogService.createLog({
          userId: userWithDept.id,
          userName: userWithDept.name,
          userRole: userWithDept.role,
          userDepartment: userWithDept.department?.name || undefined,
          userDepartmentId: userWithDept.departmentId || undefined,
          action: 'UPDATE',
          actionLabel: '更新AI API配置',
          module: 'SYSTEM',
          targetType: 'ai_api_config',
          targetId: config.id,
          targetLabel: config.name,
          details: `更新了AI API配置：${config.name}`,
          beforeData: { ...oldConfig, apiKey: '***' },
          afterData: { ...config, apiKey: '***' },
        });
      }
    }

    const sanitizedConfig = {
      ...config,
      apiKey: '***' + config.apiKey.slice(-4),
    };

    return NextResponse.json({
      success: true,
      data: sanitizedConfig,
      message: '更新成功',
    });
  } catch (error) {
    console.error('更新失败:', error);
    return NextResponse.json(
      { success: false, message: '更新失败' },
      { status: 500 }
    );
  }
}

// 删除AI API配置或限流策略
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action'); // 'config' | 'rate-limit'

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少ID' },
        { status: 400 }
      );
    }

    // 删除限流策略
    if (action === 'rate-limit') {
      const oldLimit = await prisma.aIApiRateLimit.findUnique({
        where: { id },
      });

      if (!oldLimit) {
        return NextResponse.json(
          { success: false, message: '记录不存在' },
          { status: 404 }
        );
      }

      await prisma.aIApiRateLimit.delete({
        where: { id },
      });

      // 记录操作日志
      const user = await getUserFromRequest(request);
      if (user) {
        const userWithDept = await prisma.user.findUnique({
          where: { id: user.id },
          include: { department: true },
        });
        if (userWithDept) {
          await SystemLogService.createLog({
            userId: userWithDept.id,
            userName: userWithDept.name,
            userRole: userWithDept.role,
            userDepartment: userWithDept.department?.name || undefined,
            userDepartmentId: userWithDept.departmentId || undefined,
            action: 'DELETE',
            actionLabel: '删除AI API限流策略',
            module: 'SYSTEM',
            targetType: 'ai_api_rate_limit',
            targetId: id,
            details: `删除了限流策略（每日限制${oldLimit.dailyLimit}次）`,
            beforeData: oldLimit,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: '删除成功',
      });
    }

    // 删除API配置
    const oldConfig = await prisma.aIApiConfig.findUnique({
      where: { id },
    });

    if (!oldConfig) {
      return NextResponse.json(
        { success: false, message: '配置不存在' },
        { status: 404 }
      );
    }

    await prisma.aIApiConfig.delete({
      where: { id },
    });

    // 记录操作日志
    const user = await getUserFromRequest(request);
    if (user) {
      const userWithDept = await prisma.user.findUnique({
        where: { id: user.id },
        include: { department: true },
      });
      if (userWithDept) {
        await SystemLogService.createLog({
          userId: userWithDept.id,
          userName: userWithDept.name,
          userRole: userWithDept.role,
          userDepartment: userWithDept.department?.name || undefined,
          userDepartmentId: userWithDept.departmentId || undefined,
          action: 'DELETE',
          actionLabel: '删除AI API配置',
          module: 'SYSTEM',
          targetType: 'ai_api_config',
          targetId: id,
          targetLabel: oldConfig.name,
          details: `删除了AI API配置：${oldConfig.name}`,
          beforeData: { ...oldConfig, apiKey: '***' },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除失败:', error);
    return NextResponse.json(
      { success: false, message: '删除失败' },
      { status: 500 }
    );
  }
}
