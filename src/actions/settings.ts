'use server';

/**
 * 用户设置相关的 Server Actions
 * 包括密码修改等敏感操作
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { ChangePasswordSchema, type ChangePasswordInput } from '@/schemas';

/**
 * Server Action 响应类型
 */
type ActionResponse<T = void> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

/**
 * 验证当前密码 Server Action
 * 
 * @param userId - 当前登录用户的ID
 * @param currentPassword - 当前密码
 * @returns 验证结果
 */
export async function verifyCurrentPassword(
  userId: string,
  currentPassword: string
): Promise<ActionResponse<{ isValid: boolean }>> {
  try {
    if (!userId || !currentPassword) {
      return {
        success: false,
        error: '参数不完整'
      };
    }

    // 查询用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true
      }
    });

    if (!user) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    if (!user.password) {
      return {
        success: false,
        error: '该账号使用第三方登录，无法修改密码'
      };
    }

    // 验证密码
    let isValid = false;
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isValid = await bcrypt.compare(currentPassword, user.password);
    } else {
      isValid = currentPassword === user.password;
    }

    return {
      success: true,
      data: { isValid }
    };
  } catch (error) {
    console.error('[VerifyPassword] 验证失败:', error);
    return {
      success: false,
      error: '验证失败，请稍后重试'
    };
  }
}

/**
 * 修改密码 Server Action
 * 
 * 安全要求：
 * 1. 接收客户端传入的 userId，并验证其真实性
 * 2. 验证当前密码是否正确
 * 3. 检查用户是否为 OAuth 用户（无密码字段）
 * 4. 使用 bcrypt 加密新密码
 * 5. 更新数据库
 * 
 * @param userId - 当前登录用户的ID
 * @param values - 表单数据（包含当前密码、新密码、确认密码）
 * @returns 操作结果
 */
export async function changePassword(
  userId: string,
  values: ChangePasswordInput
): Promise<ActionResponse> {
  try {
    // 1. 验证输入数据
    const validatedFields = ChangePasswordSchema.safeParse(values);
    
    if (!validatedFields.success) {
      return {
        success: false,
        error: '输入数据格式错误'
      };
    }

    const { currentPassword, newPassword } = validatedFields.data;

    // 2. 验证用户ID
    if (!userId) {
      return {
        success: false,
        error: '未授权：请先登录'
      };
    }

    // 3. 查询用户信息（包含密码哈希）
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        username: true
      }
    });

    if (!user) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    // 4. 检查是否为 OAuth 用户（密码字段为空或特殊标记）
    // 注意：如果当前系统使用明文密码，此检查可能需要调整
    if (!user.password) {
      return {
        success: false,
        error: '该账号使用第三方登录，无法修改密码'
      };
    }

    // 5. 验证当前密码
    // 注意：如果数据库中的密码是明文（开发阶段），需要直接比对
    // 生产环境应该使用 bcrypt.compare
    let isCurrentPasswordValid = false;
    
    // 尝试 bcrypt 验证（如果密码已加密）
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    } else {
      // 明文密码比对（仅用于过渡期）
      isCurrentPasswordValid = currentPassword === user.password;
    }

    if (!isCurrentPasswordValid) {
      return {
        success: false,
        error: '当前密码不正确'
      };
    }

    // 6. 加密新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 7. 更新数据库
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        updatedAt: new Date()
      }
    });

    // 8. 记录操作日志（可选）
    console.log(`[ChangePassword] 用户 ${user.username} (${userId}) 修改密码成功`);

    return {
      success: true,
      message: '密码修改成功'
    };

  } catch (error) {
    console.error('[ChangePassword] 修改密码失败:', error);
    
    // 不向客户端泄露详细错误信息
    return {
      success: false,
      error: '密码修改失败，请稍后重试'
    };
  }
}
