'use client';

/**
 * 密码修改表单组件
 * 
 * 功能：
 * - 使用 React Hook Form 管理表单状态
 * - 使用 Zod 进行客户端验证
 * - 调用 Server Action 进行密码修改
 * - 显示加载状态和错误提示
 */

import React, { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordSchema, type ChangePasswordInput } from '@/schemas';
import { changePassword, verifyCurrentPassword } from '@/actions/settings';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Lock, CheckCircle, XCircle } from 'lucide-react';

/**
 * 密码输入框组件
 */
interface PasswordInputProps {
  id: string;
  label: string;
  placeholder?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  status?: 'idle' | 'verifying' | 'valid' | 'invalid';
  statusMessage?: string;
}

function PasswordInput({
  id,
  label,
  placeholder,
  error,
  value,
  onChange,
  disabled = false,
  status = 'idle',
  statusMessage
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Lock className="h-5 w-5 text-gray-400" />
        </div>
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`
            block w-full pl-10 pr-20 py-2 border rounded-md shadow-sm
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error || status === 'invalid' ? 'border-red-500' : 
              status === 'valid' ? 'border-green-500' : 'border-gray-300'}
          `}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1">
          {/* 验证状态图标 */}
          {status === 'verifying' && (
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
          )}
          {status === 'valid' && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          {status === 'invalid' && (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
          {/* 密码可见性切换 */}
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={disabled}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            )}
          </button>
        </div>
      </div>
      {(error || statusMessage) && (
        <p className={`text-sm ${status === 'valid' ? 'text-green-600' : 'text-red-600'}`}>
          {error || statusMessage}
        </p>
      )}
    </div>
  );
}

/**
 * 密码修改表单主组件
 */
export function ChangePasswordForm() {
  const { user } = useAuth(); // 获取当前登录用户
  const [isPending, startTransition] = useTransition();
  const { success, error: showErrorToast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  
  // 当前密码验证状态
  const [currentPasswordStatus, setCurrentPasswordStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [currentPasswordError, setCurrentPasswordError] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  // 监听表单字段值
  const currentPassword = watch('currentPassword');
  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');

  // 实时验证当前密码
  useEffect(() => {
    if (!currentPassword || currentPassword.length === 0) {
      setCurrentPasswordStatus('idle');
      setCurrentPasswordError('');
      return;
    }

    // 防抖：延迟 500ms 后再验证
    const timer = setTimeout(async () => {
      if (!user?.id) return;
      
      setCurrentPasswordStatus('verifying');
      setCurrentPasswordError('');

      try {
        const result = await verifyCurrentPassword(user.id, currentPassword);
        
        if (result.success && result.data) {
          if (result.data.isValid) {
            setCurrentPasswordStatus('valid');
            setCurrentPasswordError('');
          } else {
            setCurrentPasswordStatus('invalid');
            setCurrentPasswordError('当前密码不正确');
          }
        } else {
          setCurrentPasswordStatus('invalid');
          setCurrentPasswordError(result.error || '验证失败');
        }
      } catch (error) {
        setCurrentPasswordStatus('invalid');
        setCurrentPasswordError('验证失败，请稍后重试');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [currentPassword, user?.id]);
  /**
   * 表单提交处理
   */
  const onSubmit = (data: ChangePasswordInput) => {
    setServerError(null);

    // 检查用户是否登录
    if (!user?.id) {
      showErrorToast('未登录', '请先登录后再修改密码');
      return;
    }

    // 检查当前密码是否已验证通过
    if (currentPasswordStatus !== 'valid') {
      showErrorToast('验证失败', '请先输入正确的当前密码');
      return;
    }

    startTransition(async () => {
      try {
        // 传递 userId 给 Server Action
        const result = await changePassword(user.id, data);

        if (result.success) {
          success('密码修改成功', '请使用新密码重新登录');
          reset(); // 清空表单
          setCurrentPasswordStatus('idle'); // 重置验证状态
        } else {
          // 显示服务端错误
          if (result.error) {
            setServerError(result.error);
            showErrorToast('密码修改失败', result.error);
          }
        }
      } catch (err) {
        console.error('[ChangePasswordForm] 提交失败:', err);
        setServerError('网络错误，请稍后重试');
        showErrorToast('网络错误', '请检查网络连接后重试');
      }
    });
  };

  return (
    <div className="max-w-md w-full mx-auto">
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">修改密码</h2>
          <p className="mt-1 text-sm text-gray-600">
            请输入当前密码和新密码，新密码至少需要8个字符
          </p>
        </div>

        {/* 服务端错误提示 */}
        {serverError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{serverError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* 当前密码 */}
          <PasswordInput
            id="currentPassword"
            label="当前密码"
            placeholder="请输入当前密码"
            value={currentPassword}
            onChange={(value) => setValue('currentPassword', value)}
            error={errors.currentPassword?.message}
            disabled={isPending}
            status={currentPasswordStatus}
            statusMessage={currentPasswordError}
          />

          {/* 新密码 */}
          <PasswordInput
            id="newPassword"
            label="新密码"
            placeholder="至少8个字符"
            value={newPassword}
            onChange={(value) => setValue('newPassword', value)}
            error={errors.newPassword?.message}
            disabled={isPending}
          />

          {/* 确认新密码 */}
          <PasswordInput
            id="confirmPassword"
            label="确认新密码"
            placeholder="再次输入新密码"
            value={confirmPassword}
            onChange={(value) => setValue('confirmPassword', value)}
            error={errors.confirmPassword?.message}
            disabled={isPending}
          />

          {/* 提交按钮 */}
          <div className="pt-4 space-y-3">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full"
            >
              {isPending ? '提交中...' : '修改密码'}
            </Button>

            {/* 密码强度提示 */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>密码要求：</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>至少8个字符</li>
                <li>不能与当前密码相同</li>
                <li>建议包含大小写字母、数字和特殊字符</li>
              </ul>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
