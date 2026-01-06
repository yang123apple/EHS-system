'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  permissionDenied: (action?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    const duration = toast.duration || 5000;
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const success = useCallback((message: string, description?: string) => {
    showToast({ type: 'success', message, description });
  }, [showToast]);

  const error = useCallback((message: string, description?: string) => {
    showToast({ type: 'error', message, description, duration: 7000 });
  }, [showToast]);

  const warning = useCallback((message: string, description?: string) => {
    showToast({ type: 'warning', message, description });
  }, [showToast]);

  const info = useCallback((message: string, description?: string) => {
    showToast({ type: 'info', message, description });
  }, [showToast]);

  const permissionDenied = useCallback((action?: string) => {
    const message = action ? `无权限执行: ${action}` : '权限不足';
    const description = '请联系管理员获取相应权限';
    showToast({ type: 'error', message, description, duration: 8000 });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, permissionDenied }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const { id, type, message, description } = toast;

  const styles = {
    success: {
      bg: 'bg-green-50 border-green-200',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      text: 'text-green-800'
    },
    error: {
      bg: 'bg-red-50 border-red-200',
      icon: <XCircle className="w-5 h-5 text-red-600" />,
      text: 'text-red-800'
    },
    warning: {
      bg: 'bg-yellow-50 border-yellow-200',
      icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      text: 'text-yellow-800'
    },
    info: {
      bg: 'bg-blue-50 border-blue-200',
      icon: <Info className="w-5 h-5 text-blue-600" />,
      text: 'text-blue-800'
    }
  };

  const style = styles[type];

  return (
    <div className={`${style.bg} border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-slide-in-right`}>
      <div className="flex-shrink-0 mt-0.5">
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${style.text}`}>{message}</p>
        {description && (
          <p className={`text-sm mt-1 ${style.text} opacity-90`}>{description}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(id)}
        className={`flex-shrink-0 ${style.text} hover:opacity-70 transition-opacity`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
