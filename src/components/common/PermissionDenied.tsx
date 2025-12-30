import React from 'react';
import { ShieldX, Lock } from 'lucide-react';

interface PermissionDeniedProps {
  action?: string;
  requiredPermission?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function PermissionDenied({
  action = '此操作',
  requiredPermission,
  size = 'md',
  showIcon = true
}: PermissionDeniedProps) {
  const sizes = {
    sm: {
      container: 'p-4',
      icon: 'w-12 h-12',
      title: 'text-base',
      text: 'text-sm'
    },
    md: {
      container: 'p-6',
      icon: 'w-16 h-16',
      title: 'text-lg',
      text: 'text-base'
    },
    lg: {
      container: 'p-8',
      icon: 'w-20 h-20',
      title: 'text-xl',
      text: 'text-lg'
    }
  };

  const style = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center ${style.container} text-center`}>
      {showIcon && (
        <div className="mb-4 text-red-500">
          <ShieldX className={style.icon} />
        </div>
      )}
      <h3 className={`font-semibold text-gray-900 mb-2 ${style.title}`}>
        权限不足
      </h3>
      <p className={`text-gray-600 mb-4 ${style.text}`}>
        您没有权限执行{action}
      </p>
      {requiredPermission && (
        <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-700">
          <Lock className="w-4 h-4 inline mr-2" />
          需要权限: <span className="font-mono">{requiredPermission}</span>
        </div>
      )}
      <p className="mt-4 text-sm text-gray-500">
        如需访问权限，请联系系统管理员
      </p>
    </div>
  );
}

interface PermissionGuardProps {
  hasPermission: boolean;
  action?: string;
  requiredPermission?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({
  hasPermission,
  action,
  requiredPermission,
  children,
  fallback
}: PermissionGuardProps) {
  if (hasPermission) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <PermissionDenied
      action={action}
      requiredPermission={requiredPermission}
      size="md"
    />
  );
}
