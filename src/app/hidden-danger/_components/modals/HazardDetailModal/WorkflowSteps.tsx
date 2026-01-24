/**
 * 工作流步骤显示组件
 * 从数据库读取每个步骤的执行人和抄送人信息
 */

import { useState, useEffect } from 'react';
import { CheckCircle, Circle, User, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/apiClient';

interface WorkflowStep {
  stepIndex: number;
  stepId: string;
  stepName: string;
  success: boolean;
  handlers: {
    userIds: string[];
    userNames: string[];
    matchedBy?: string;
  };
  ccUsers: {
    userIds: string[];
    userNames: string[];
  };
  approvalMode?: 'OR' | 'AND';
  error?: string;
}

interface WorkflowStepsProps {
  hazardId: string;
  currentStepIndex?: number;
}

export function WorkflowSteps({ hazardId, currentStepIndex }: WorkflowStepsProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSteps = async () => {
      // 检查hazardId是否有效
      if (!hazardId || hazardId.trim() === '') {
        setError('隐患ID不能为空');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await apiFetch(`/api/hazards/${hazardId}/workflow-steps`);
        
        if (response.ok) {
          const data = await response.json();
          // 检查API返回的success字段
          if (data.success !== false) {
            setSteps(data.steps || []);
          } else {
            // API返回了错误信息
            setError(data.error || '加载步骤信息失败');
          }
        } else {
          // 尝试读取错误信息
          try {
            const errorData = await response.json();
            setError(errorData.error || '加载步骤信息失败');
          } catch {
            setError('加载步骤信息失败');
          }
        }
      } catch (err) {
        console.error('加载工作流步骤失败:', err);
        setError('加载步骤信息失败');
      } finally {
        setLoading(false);
      }
    };

    loadSteps();
  }, [hazardId, currentStepIndex]); // 当 currentStepIndex 变化时也重新加载（表示工作流状态已更新）

  if (loading) {
    return <div className="text-slate-400 text-sm py-4">加载中...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm py-4">{error}</div>;
  }

  if (!steps || steps.length === 0) {
    return <div className="text-slate-400 text-sm py-4">暂无流程步骤信息</div>;
  }

  return (
    <div className="space-y-4 lg:space-y-6 relative before:absolute before:inset-0 before:ml-4 lg:before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
      {steps.map((step, index) => {
        const isCurrentStep = step.stepIndex === currentStepIndex;
        const isCompleted = currentStepIndex !== undefined && step.stepIndex < currentStepIndex;
        const isPending = currentStepIndex !== undefined && step.stepIndex > currentStepIndex;

        return (
          <div key={step.stepIndex} className="relative flex items-start gap-3 lg:gap-4 group">
            <div className="absolute left-0 w-8 lg:w-10 flex justify-center">
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 text-green-500 z-10" />
              ) : isCurrentStep ? (
                <div className="w-3 h-3 lg:w-4 lg:h-4 rounded-full bg-blue-500 ring-2 lg:ring-4 ring-blue-50 z-10 animate-pulse" />
              ) : (
                <Circle className="w-2.5 h-2.5 lg:w-3 lg:h-3 text-slate-300 z-10 mt-1" />
              )}
            </div>

            <div className={`ml-8 lg:ml-10 flex-1 bg-white border rounded-lg p-2.5 lg:p-3 shadow-sm transition-colors ${
              isCurrentStep ? 'border-blue-300 bg-blue-50/50' : 'border-slate-100'
            }`}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 mb-2">
                <span className={`text-xs lg:text-sm font-bold ${
                  isCurrentStep ? 'text-blue-800' : isCompleted ? 'text-green-700' : 'text-slate-800'
                }`}>
                  {step.stepName}
                  {isCurrentStep && <span className="ml-2 text-[10px] text-blue-600">(当前步骤)</span>}
                </span>
                {step.approvalMode && (
                  <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full shrink-0">
                    {step.approvalMode === 'AND' ? '会签' : '或签'}
                  </span>
                )}
              </div>

              {step.success ? (
                <div className="space-y-2">
                  {step.handlers.userNames.length > 0 && (
                    <div className="flex items-center gap-1.5 text-blue-600 text-xs">
                      <User size={12} className="shrink-0" />
                      <span className="font-medium">执行人：</span>
                      <span>{step.handlers.userNames.join('、')}</span>
                    </div>
                  )}
                  {step.handlers.matchedBy && (
                    <div className="text-slate-400 text-[10px] ml-5">
                      策略：{step.handlers.matchedBy}
                    </div>
                  )}
                  {step.ccUsers.userNames.length > 0 && (
                    <div className="pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1 text-purple-600 text-xs mb-1">
                        <Mail size={10} className="shrink-0" />
                        <span className="font-medium">抄送：</span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-5">
                        {step.ccUsers.userNames.map((ccUser, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[10px] rounded">
                            {ccUser}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-500 text-xs">
                  {step.error || '无法匹配处理人'}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
