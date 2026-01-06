/**
 * 密码修改功能集成示例
 * 
 * ⚠️ 注意：本文件仅用于参考，不应直接运行
 * 
 * 本文件包含 10 个独立的集成示例，每个示例展示不同的使用场景。
 * 请根据需要复制相应的代码到您的项目中，而不是直接导入此文件。
 * 
 * TypeScript 错误是预期的，因为这些是独立的示例片段。
 */

/* eslint-disable */
// @ts-nocheck

// ============================================
// 示例 1: 在设置页面中使用
// ============================================

// app/settings/page.tsx
import { ChangePasswordForm } from '@/components/auth/change-password-form';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">账户设置</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 侧边栏 */}
        <aside className="md:col-span-1">
          <nav className="space-y-2">
            <a href="#profile" className="block p-2 hover:bg-gray-100 rounded">个人资料</a>
            <a href="#password" className="block p-2 bg-blue-50 rounded">修改密码</a>
            <a href="#notifications" className="block p-2 hover:bg-gray-100 rounded">通知设置</a>
          </nav>
        </aside>
        
        {/* 主内容区 */}
        <main className="md:col-span-2">
          <section id="password">
            <h2 className="text-xl font-semibold mb-4">修改密码</h2>
            <ChangePasswordForm />
          </section>
        </main>
      </div>
    </div>
  );
}

// ============================================
// 示例 2: 在模态框中使用
// ============================================

// components/modals/ChangePasswordModal.tsx
'use client';

import { useState } from 'react';
import { ChangePasswordForm } from '@/components/auth/change-password-form';
import { X } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* 模态框内容 */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* 表单 */}
        <div className="p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

// 使用示例
export function UserMenu() {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsPasswordModalOpen(true)}>
        修改密码
      </button>
      
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
}

// ============================================
// 示例 3: 在标签页中使用
// ============================================

// app/profile/page.tsx
'use client';

import { useState } from 'react';
import { ChangePasswordForm } from '@/components/auth/change-password-form';

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'security'>('profile');

  return (
    <div className="container mx-auto py-8">
      {/* 标签导航 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-1 border-b-2 ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            个人资料
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`py-2 px-1 border-b-2 ${
              activeTab === 'password'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            修改密码
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2 px-1 border-b-2 ${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            安全设置
          </button>
        </nav>
      </div>

      {/* 标签内容 */}
      <div className="max-w-2xl">
        {activeTab === 'profile' && <ProfileForm />}
        {activeTab === 'password' && <ChangePasswordForm />}
        {activeTab === 'security' && <SecuritySettings />}
      </div>
    </div>
  );
}

// ============================================
// 示例 4: 自定义成功后的回调
// ============================================

// components/CustomChangePasswordForm.tsx
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordSchema, type ChangePasswordInput } from '@/schemas';
import { changePassword } from '@/actions/settings';
import { useRouter } from 'next/navigation';

export function CustomChangePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  const { handleSubmit, /* ... */ } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  const onSubmit = (data: ChangePasswordInput) => {
    startTransition(async () => {
      const result = await changePassword(data);

      if (result.success) {
        // 自定义成功后的逻辑
        alert('密码修改成功！即将跳转到登录页面...');
        
        // 清除本地存储
        localStorage.removeItem('ehs_user');
        
        // 跳转到登录页
        router.push('/login');
      } else {
        alert(result.error || '密码修改失败');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 表单内容 */}
    </form>
  );
}

// ============================================
// 示例 5: 与现有 Toast 系统集成
// ============================================

// components/IntegratedChangePasswordForm.tsx
'use client';

import { useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChangePasswordSchema, type ChangePasswordInput } from '@/schemas';
import { changePassword } from '@/actions/settings';
import { useToast } from '@/components/common/Toast';

export function IntegratedChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const { success, error } = useToast(); // 使用项目现有的 Toast
  
  const { handleSubmit, reset, /* ... */ } = useForm<ChangePasswordInput>({
    resolver: zodResolver(ChangePasswordSchema),
  });

  const onSubmit = (data: ChangePasswordInput) => {
    startTransition(async () => {
      try {
        const result = await changePassword(data);

        if (result.success) {
          success('密码修改成功', '请使用新密码重新登录');
          reset(); // 清空表单
          
          // 3秒后自动跳转到登录页
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
        } else {
          error('密码修改失败', result.error || '请稍后重试');
        }
      } catch (err) {
        error('网络错误', '请检查网络连接后重试');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 表单内容 */}
    </form>
  );
}

// ============================================
// 示例 6: 添加密码强度指示器
// ============================================

// components/PasswordStrengthMeter.tsx
'use client';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const getStrength = (pwd: string): number => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const strength = getStrength(password);
  const labels = ['', '弱', '一般', '良好', '强', '非常强'];
  const colors = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded ${
              level <= strength ? colors[strength] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-600">
        密码强度: <span className="font-medium">{labels[strength]}</span>
      </p>
    </div>
  );
}

// 在表单中使用
import { PasswordStrengthMeter } from '@/components/PasswordStrengthMeter';

export function EnhancedChangePasswordForm() {
  const newPassword = watch('newPassword');

  return (
    <form>
      <input type="password" {...register('newPassword')} />
      <PasswordStrengthMeter password={newPassword} />
      {/* ... */}
    </form>
  );
}

// ============================================
// 示例 7: 添加"忘记密码"链接
// ============================================

// components/ChangePasswordWithForgot.tsx
export function ChangePasswordWithForgot() {
  return (
    <div className="space-y-4">
      <ChangePasswordForm />
      
      <div className="text-center text-sm text-gray-600">
        <a href="/forgot-password" className="text-blue-600 hover:underline">
          忘记当前密码？
        </a>
      </div>
    </div>
  );
}

// ============================================
// 示例 8: 首次登录强制修改密码
// ============================================

// app/first-login/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChangePasswordForm } from '@/components/auth/change-password-form';

export default function FirstLoginPage() {
  const router = useRouter();

  useEffect(() => {
    // 检查用户是否需要修改密码
    const user = JSON.parse(localStorage.getItem('ehs_user') || '{}');
    if (!user.requirePasswordChange) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ 首次登录需要修改密码，以确保账户安全。
          </p>
        </div>
        
        <ChangePasswordForm />
      </div>
    </div>
  );
}

// ============================================
// 示例 9: 管理员重置用户密码后的流程
// ============================================

// app/reset-password/[token]/page.tsx
export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-xl font-bold mb-4">设置新密码</h1>
          <p className="text-sm text-gray-600 mb-6">
            您的密码已被管理员重置，请设置新密码。
          </p>
          
          {/* 简化版表单（不需要当前密码） */}
          <NewPasswordForm token={params.token} />
        </div>
      </div>
    </div>
  );
}

// ============================================
// 示例 10: 完整的用户设置页面
// ============================================

// app/user/settings/page.tsx
export default function CompleteSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8">用户设置</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 侧边导航 */}
          <aside className="lg:col-span-1">
            <nav className="space-y-1">
              <a href="#profile" className="block px-3 py-2 rounded hover:bg-gray-100">
                👤 个人资料
              </a>
              <a href="#password" className="block px-3 py-2 rounded bg-blue-50 text-blue-700">
                🔐 修改密码
              </a>
              <a href="#notifications" className="block px-3 py-2 rounded hover:bg-gray-100">
                🔔 通知设置
              </a>
              <a href="#privacy" className="block px-3 py-2 rounded hover:bg-gray-100">
                🛡️ 隐私设置
              </a>
            </nav>
          </aside>
          
          {/* 主内容 */}
          <main className="lg:col-span-3">
            <section id="password" className="bg-white rounded-lg shadow p-6">
              <ChangePasswordForm />
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================================
// 导出备注
// ============================================

/*
 * 这些示例展示了密码修改功能的多种集成方式。
 * 您可以根据项目需求选择合适的方式，或者组合使用。
 * 
 * 核心组件：
 * - ChangePasswordForm: 开箱即用的完整表单组件
 * - changePassword: Server Action（处理密码修改逻辑）
 * - ChangePasswordSchema: Zod 验证模式
 * 
 * 自定义建议：
 * 1. 根据设计系统调整样式
 * 2. 集成现有的 Toast/通知系统
 * 3. 添加额外的业务逻辑（如日志记录）
 * 4. 实现密码历史检查
 * 5. 添加密码强度指示器
 */
