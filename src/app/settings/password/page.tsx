/**
 * 密码修改页面
 * 
 * 路径: /settings/password
 * 功能: 允许用户修改登录密码
 */

import { ChangePasswordForm } from '@/components/auth/change-password-form';

export default function ChangePasswordPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* 页面头部 */}
        <div className="mb-8">
          <nav className="text-sm text-gray-600 mb-4">
            <a href="/settings" className="hover:text-blue-600">设置</a>
            <span className="mx-2">/</span>
            <span className="text-gray-900 font-medium">修改密码</span>
          </nav>
          
          <h1 className="text-3xl font-bold text-gray-900">账户安全</h1>
          <p className="mt-2 text-gray-600">
            定期修改密码可以提高账户安全性
          </p>
        </div>

        {/* 密码修改表单 */}
        <ChangePasswordForm />

        {/* 安全提示 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            🔒 密码安全建议
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• 使用至少 12 个字符的强密码</li>
            <li>• 包含大小写字母、数字和特殊字符</li>
            <li>• 不要使用生日、姓名等容易被猜到的信息</li>
            <li>• 定期更换密码（建议每 3-6 个月）</li>
            <li>• 不要在多个网站使用相同的密码</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
