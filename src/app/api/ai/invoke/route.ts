import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// AI API调用端点（供其他子系统使用）
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { 
      configName,  // AI配置名称
      requestBy,   // 调用者ID
      requestSource, // 调用来源：hazard, training, work_permit, custom
      prompt,      // 提示词
      systemPrompt, // 系统提示词
      options,     // 其他选项
    } = body;

    if (!configName || !prompt) {
      return NextResponse.json(
        { success: false, message: '缺少必填参数' },
        { status: 400 }
      );
    }

    // 获取AI配置
    const config = await prisma.aIApiConfig.findUnique({
      where: { name: configName },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, message: 'AI配置不存在' },
        { status: 404 }
      );
    }

    if (!config.isActive) {
      return NextResponse.json(
        { success: false, message: 'AI配置已禁用' },
        { status: 403 }
      );
    }

    // 检查限流（每分钟）
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCalls = await prisma.aIApiLog.count({
      where: {
        configId: config.id,
        createdAt: { gte: oneMinuteAgo },
      },
    });

    if (recentCalls >= config.rateLimitPerMinute) {
      // 记录限流日志
      await prisma.aIApiLog.create({
        data: {
          configId: config.id,
          requestBy,
          requestSource,
          requestPayload: JSON.stringify({ prompt, systemPrompt, options }),
          status: 'rate_limited',
          errorMessage: '超过每分钟调用限制',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        },
      });

      return NextResponse.json(
        { success: false, message: '调用频率过高，请稍后再试' },
        { status: 429 }
      );
    }

    // 检查限流（每天）
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCalls = await prisma.aIApiLog.count({
      where: {
        configId: config.id,
        createdAt: { gte: todayStart },
      },
    });

    if (todayCalls >= config.rateLimitPerDay) {
      await prisma.aIApiLog.create({
        data: {
          configId: config.id,
          requestBy,
          requestSource,
          requestPayload: JSON.stringify({ prompt, systemPrompt, options }),
          status: 'rate_limited',
          errorMessage: '超过每天调用限制',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        },
      });

      return NextResponse.json(
        { success: false, message: '今日调用次数已达上限' },
        { status: 429 }
      );
    }

    // 调用AI API
    let aiResponse;
    let tokens = 0;

    try {
      // 根据不同provider调用不同的API
      if (config.provider === 'openai' || config.provider === 'azure') {
        const messages = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const apiResponse = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model || 'gpt-3.5-turbo',
            messages,
            max_tokens: options?.maxTokens || config.maxTokens,
            temperature: options?.temperature !== undefined ? options.temperature : config.temperature,
            ...options,
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`AI API返回错误: ${apiResponse.status} ${apiResponse.statusText}`);
        }

        const result = await apiResponse.json();
        aiResponse = result.choices?.[0]?.message?.content || '';
        tokens = result.usage?.total_tokens || 0;
      } else {
        // 自定义provider - 简单的POST请求
        const apiResponse = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            prompt,
            systemPrompt,
            ...options,
          }),
        });

        if (!apiResponse.ok) {
          throw new Error(`AI API返回错误: ${apiResponse.status}`);
        }

        const result = await apiResponse.json();
        aiResponse = result.response || result.text || result.content || '';
        tokens = result.tokens || 0;
      }

      const duration = Date.now() - startTime;

      // 记录成功日志
      await prisma.aIApiLog.create({
        data: {
          configId: config.id,
          requestBy,
          requestSource,
          requestPayload: JSON.stringify({ prompt, systemPrompt, options }),
          responsePayload: JSON.stringify({ response: aiResponse }),
          tokens,
          duration,
          status: 'success',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          response: aiResponse,
          tokens,
          duration,
        },
      });

    } catch (aiError: any) {
      const duration = Date.now() - startTime;

      // 记录错误日志
      await prisma.aIApiLog.create({
        data: {
          configId: config.id,
          requestBy,
          requestSource,
          requestPayload: JSON.stringify({ prompt, systemPrompt, options }),
          duration,
          status: 'error',
          errorMessage: aiError.message || '未知错误',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        },
      });

      return NextResponse.json(
        { success: false, message: 'AI调用失败: ' + aiError.message },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('AI API调用失败:', error);
    return NextResponse.json(
      { success: false, message: '调用失败: ' + error.message },
      { status: 500 }
    );
  }
}
