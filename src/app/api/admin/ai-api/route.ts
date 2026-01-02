import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const where: any = {};
      if (configId) where.configId = configId;

      const [
        totalCalls,
        todayCalls,
        monthCalls,
        successRate,
        avgDuration,
        totalTokens,
        rateLimitedCalls,
      ] = await Promise.all([
        prisma.aIApiLog.count({ where }),
        prisma.aIApiLog.count({ where: { ...where, createdAt: { gte: today } } }),
        prisma.aIApiLog.count({ where: { ...where, createdAt: { gte: thisMonth } } }),
        prisma.aIApiLog.count({ where: { ...where, status: 'success' } })
          .then(success => totalCalls > 0 ? (success / totalCalls * 100).toFixed(2) : '0'),
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
          successRate: parseFloat(successRate),
          avgDuration,
          totalTokens,
          rateLimitedCalls,
        },
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

// 创建AI API配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
    console.error('创建AI API配置失败:', error);
    return NextResponse.json(
      { success: false, message: '创建配置失败' },
      { status: 500 }
    );
  }
}

// 更新AI API配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少配置ID' },
        { status: 400 }
      );
    }

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

    const config = await prisma.aIApiConfig.update({
      where: { id },
      data,
    });

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
    console.error('更新AI API配置失败:', error);
    return NextResponse.json(
      { success: false, message: '更新配置失败' },
      { status: 500 }
    );
  }
}

// 删除AI API配置
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少配置ID' },
        { status: 400 }
      );
    }

    // 删除配置及关联的日志
    await prisma.aIApiConfig.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    console.error('删除AI API配置失败:', error);
    return NextResponse.json(
      { success: false, message: '删除配置失败' },
      { status: 500 }
    );
  }
}
