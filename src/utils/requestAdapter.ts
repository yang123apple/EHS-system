/**
 * Request 适配器工具
 * 
 * 提供类型安全的 NextRequest 到 Request 转换
 * 以及客户端信息提取功能
 */

import type { NextRequest } from 'next/server';

/**
 * 将 NextRequest 适配为标准 Request
 * 
 * NextRequest 继承自 Request，所以可以直接使用
 * 此函数主要用于提供类型安全的转换，避免 as any
 * 
 * @param request NextRequest 对象或 undefined
 * @returns Request 对象或 undefined
 */
export function adaptNextRequest(request?: NextRequest): Request | undefined {
  // NextRequest extends Request，可以安全转换
  return request;
}

/**
 * 从 Request 中提取客户端 IP
 * 
 * @param request Request 对象（包括 NextRequest）
 * @returns IP 地址或 undefined
 */
export function getClientIP(request?: Request): string | undefined {
  if (!request) return undefined;

  const headers = request.headers;
  
  // 优先从 x-forwarded-for 获取（适用于代理/负载均衡场景）
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // 其次从 x-real-ip 获取
  const realIP = headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return undefined;
}

/**
 * 从 Request 中提取 User-Agent
 * 
 * @param request Request 对象
 * @returns User-Agent 字符串或 undefined
 */
export function getUserAgent(request?: Request): string | undefined {
  if (!request) return undefined;
  return request.headers.get('user-agent') || undefined;
}

/**
 * 从 Request 中提取完整的客户端信息
 * 
 * @param request Request 对象
 * @returns 客户端信息对象
 */
export function extractClientInfo(request?: Request): {
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
} | undefined {
  if (!request) return undefined;

  return {
    ip: getClientIP(request),
    userAgent: getUserAgent(request),
    method: request.method,
    url: request.url,
  };
}
