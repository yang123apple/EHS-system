import { z } from 'zod';

/**
 * 密码修改验证模式
 * 确保密码强度和一致性
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, {
    message: '请输入当前密码'
  }),
  newPassword: z.string().min(8, {
    message: '新密码至少需要8个字符'
  }),
  confirmPassword: z.string().min(1, {
    message: '请确认新密码'
  })
})
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword']
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: '新密码不能与当前密码相同',
    path: ['newPassword']
  });

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
