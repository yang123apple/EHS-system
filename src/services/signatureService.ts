/**
 * 电子签名服务：符合审计要求的电子签名方案
 * 
 * 核心功能：
 * 1. 记录签字时刻的数据快照 Hash，防止签字后内容被篡改
 * 2. 提供签名验证功能，确保数据完整性
 * 3. 记录完整的审计信息（签字人、时间、操作、客户端环境等）
 */

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

export interface SignatureInput {
  permitId: string;
  signerId: string;
  signerName: string;
  action: 'pass' | 'reject' | 'issue' | 'site_confirm';
  comment?: string;
  stepIndex: number;
  stepName?: string;
  clientInfo?: {
    ip?: string;
    userAgent?: string;
    device?: string;
    browser?: string;
    os?: string;
  };
}

export interface SignatureVerificationResult {
  isValid: boolean;
  reason?: string;
  currentHash?: string;
  recordedHash?: string;
}

/**
 * 计算数据快照的 Hash 值（SHA-256）
 * 
 * @param dataJson - 表单数据 JSON 字符串
 * @returns Hash 值（十六进制字符串）
 */
export function calculateDataHash(dataJson: string): string {
  return createHash('sha256').update(dataJson, 'utf8').digest('hex');
}

/**
 * 创建电子签名记录
 * 
 * @param input - 签名输入参数
 * @param dataJson - 签字时刻的表单数据（用于计算 Hash）
 * @param saveSnapshot - 是否保存完整数据快照（默认 false，仅保存 Hash）
 * @returns 创建的签名记录
 */
export async function createSignature(
  input: SignatureInput,
  dataJson: string,
  saveSnapshot: boolean = false
) {
  // 计算数据快照 Hash
  const dataSnapshotHash = calculateDataHash(dataJson);
  
  // 准备签名记录数据
  const signatureData = {
    permitId: input.permitId,
    signerId: input.signerId,
    signerName: input.signerName,
    action: input.action,
    comment: input.comment || null,
    stepIndex: input.stepIndex,
    stepName: input.stepName || null,
    dataSnapshotHash,
    dataSnapshot: saveSnapshot ? dataJson : null,
    clientInfo: input.clientInfo ? JSON.stringify(input.clientInfo) : null,
  };
  
  // 创建签名记录
  const signature = await prisma.signatureRecord.create({
    data: signatureData,
  });
  
  console.log(`✅ [电子签名] 已创建签名记录: ${signature.id}, Hash: ${dataSnapshotHash.substring(0, 16)}...`);
  
  return signature;
}

/**
 * 验证签名后数据是否被篡改
 * 
 * @param permitId - 作业票ID
 * @param currentDataJson - 当前表单数据 JSON 字符串
 * @param signatureId - 签名记录ID（可选，如果不提供则验证所有签名）
 * @returns 验证结果
 */
export async function verifySignature(
  permitId: string,
  currentDataJson: string,
  signatureId?: string
): Promise<SignatureVerificationResult> {
  try {
    // 计算当前数据的 Hash
    const currentHash = calculateDataHash(currentDataJson);
    
    // 查询签名记录
    const whereClause: any = { permitId };
    if (signatureId) {
      whereClause.id = signatureId;
    }
    
    const signatures = await prisma.signatureRecord.findMany({
      where: whereClause,
      orderBy: { signedAt: 'desc' },
    });
    
    if (signatures.length === 0) {
      return {
        isValid: false,
        reason: '未找到签名记录',
      };
    }
    
    // 检查每个签名记录
    for (const signature of signatures) {
      if (signature.dataSnapshotHash !== currentHash) {
        return {
          isValid: false,
          reason: `签名后数据已被篡改。签名时间: ${signature.signedAt.toISOString()}, 签字人: ${signature.signerName}`,
          currentHash,
          recordedHash: signature.dataSnapshotHash,
        };
      }
    }
    
    return {
      isValid: true,
      currentHash,
    };
  } catch (error) {
    console.error('[电子签名] 验证失败:', error);
    return {
      isValid: false,
      reason: error instanceof Error ? error.message : '验证过程出错',
    };
  }
}

/**
 * 获取作业票的所有签名记录
 * 
 * @param permitId - 作业票ID
 * @returns 签名记录列表
 */
export async function getSignaturesByPermitId(permitId: string) {
  return await prisma.signatureRecord.findMany({
    where: { permitId },
    orderBy: { signedAt: 'asc' },
  });
}

/**
 * 获取某个步骤的所有签名记录
 * 
 * @param permitId - 作业票ID
 * @param stepIndex - 步骤索引
 * @returns 签名记录列表
 */
export async function getSignaturesByStep(
  permitId: string,
  stepIndex: number
) {
  return await prisma.signatureRecord.findMany({
    where: {
      permitId,
      stepIndex,
    },
    orderBy: { signedAt: 'asc' },
  });
}

/**
 * 检查某个步骤是否已有签名
 * 
 * @param permitId - 作业票ID
 * @param stepIndex - 步骤索引
 * @param signerId - 签字人ID（可选，如果提供则检查特定签字人）
 * @returns 是否已有签名
 */
export async function hasSignature(
  permitId: string,
  stepIndex: number,
  signerId?: string
): Promise<boolean> {
  const whereClause: any = {
    permitId,
    stepIndex,
  };
  
  if (signerId) {
    whereClause.signerId = signerId;
  }
  
  const count = await prisma.signatureRecord.count({
    where: whereClause,
  });
  
  return count > 0;
}

/**
 * 从请求中提取客户端环境信息
 * 
 * @param request - Next.js Request 对象
 * @returns 客户端环境信息
 */
export function extractClientInfo(request: Request): {
  ip?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  os?: string;
} {
  const userAgent = request.headers.get('user-agent') || undefined;
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIp || undefined;
  
  // 简单的 User-Agent 解析（生产环境建议使用专门的库）
  let device: string | undefined;
  let browser: string | undefined;
  let os: string | undefined;
  
  if (userAgent) {
    // 设备类型
    if (/mobile|android|iphone|ipad/i.test(userAgent)) {
      device = 'mobile';
    } else {
      device = 'desktop';
    }
    
    // 浏览器
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) {
      browser = 'Chrome';
    } else if (/firefox/i.test(userAgent)) {
      browser = 'Firefox';
    } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
      browser = 'Safari';
    } else if (/edge/i.test(userAgent)) {
      browser = 'Edge';
    }
    
    // 操作系统
    if (/windows/i.test(userAgent)) {
      os = 'Windows';
    } else if (/mac/i.test(userAgent)) {
      os = 'macOS';
    } else if (/linux/i.test(userAgent)) {
      os = 'Linux';
    } else if (/android/i.test(userAgent)) {
      os = 'Android';
    } else if (/ios|iphone|ipad/i.test(userAgent)) {
      os = 'iOS';
    }
  }
  
  return {
    ip,
    userAgent,
    device,
    browser,
    os,
  };
}

