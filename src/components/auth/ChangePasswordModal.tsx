'use client';

/**
 * 密码修改弹窗组件
 */

import React, { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordSchema, type ChangePasswordInput } from '@/schemas';
import { changePassword, verifyCurrentPassword } from '@/actions/settings';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Lock, CheckCircle, XCircle, X, Loader2, Save } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
            block w-full pl-10 pr-20 py-2 border rounded-md shadow-sm text-sm
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

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const { success, error: showErrorToast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  
  // 当前密码验证状态
  const [currentPasswordStatus, setCurrentPasswordStatus] = useState<'idle' | 'verifying' | 'valid' | 'invalid'>('idle');
  const [currentPasswordError, setCurrentPasswordError] = useState<string>('');

  const {
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

  // 关闭弹窗时重置表单
  useEffect(() => {
    if (!isOpen) {
      reset();
      setCurrentPasswordStatus('idle');
      setCurrentPasswordError('');
      setServerError(null);
    }
  }, [isOpen, reset]);

  const onSubmit = (data: ChangePasswordInput) => {
    setServerError(null);

    if (!user?.id) {
      showErrorToast('未登录', '请先登录后再修改密码');
      return;
    }

    if (currentPasswordStatus !== 'valid') {
      showErrorToast('验证失败', '请先输入正确的当前密码');
      return;
    }

    startTransition(async () => {
      try {
        const result = await changePassword(user.id, data);

        if (result.success) {
          success('密码修改成功', '请使用新密码重新登录');
          reset();
          setCurrentPasswordStatus('idle');
          onClose();
        } else {
          if (result.error) {
            setServerError(result.error);
            showErrorToast('密码修改失败', result.error);
          }
        }
      } catch (err) {
        console.error('[ChangePasswordModal] 提交失败:', err);
        setServerError('网络错误，请稍后重试');
        showErrorToast('网络错误', '请检查网络连接后重试');
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">修改密码</h2>
            <p className="mt-1 text-sm text-gray-600">
              请输入当前密码和新密码，新密码至少需要8个字符
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
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

            {/* 密码要求提示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-gray-600 font-medium mb-2">密码要求：</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• 至少8个字符</li>
                <li>• 不能与当前密码相同</li>
                <li>• 建议包含大小写字母、数字和特殊字符</li>
              </ul>
            </div>

            {/* 按钮组 */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isPending || currentPasswordStatus !== 'valid'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    提交中...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    确认修改
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
