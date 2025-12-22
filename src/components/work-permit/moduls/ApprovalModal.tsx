import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, MapPin, AlertTriangle } from 'lucide-react';
import { PermitRecord } from '@/types/work-permit';
import { PermitService } from '@/services/workPermitService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record: PermitRecord;
  user: any;
  onSuccess: () => void;
}

const REJECT_REASONS = [
  '防护措施不足',
  '作业人员资质过期/不符',
  '现场环境与描述不符',
  '缺少必要附件/照片',
  '信息填写错误',
  '其他原因',
];

export default function ApprovalModal({ isOpen, onClose, record, user, onSuccess }: Props) {
  // 默认为 'pass' (通过/现场确认)
  const [actionType, setActionType] = useState<'pass' | 'reject'>('pass');
  const [opinion, setOpinion] = useState('');
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [loading, setLoading] = useState(false);

  // 1. 解析当前步骤配置
  const workflowConfig = record.template.workflowConfig ? JSON.parse(record.template.workflowConfig) : [];
  
  // 兼容查找 step 或 stepIndex
  const currentStepConfig = workflowConfig.find((s: any) => {
      const stepNum = s.step ?? s.stepIndex;
      return String(stepNum) === String(record.currentStep);
  });

  // 2. 判断是否强制现场确认
  const isFieldConfirmRequired = currentStepConfig?.enableFieldConfirm === true;

  // 3. 提交处理逻辑
  const handleSubmit = async () => {
    setLoading(true);
    try {
      // === 驳回逻辑 ===
      if (actionType === 'reject') {
        if (rejectReason === '其他原因' && !opinion.trim()) {
          alert("选择'其他原因'时，请务必填写具体的驳回意见！");
          setLoading(false);
          return;
        }
        const finalOpinion = `【驳回：${rejectReason}】${opinion}`;
        
        await PermitService.approve({
          recordId: record.id,
          action: 'reject',
          opinion: finalOpinion,
          userName: user?.name || 'Unknown',
        });
      } 
      // === 通过 / 现场确认逻辑 ===
      else {
        // 如果需要现场确认，必须弹窗二次确认（或者校验定位）
        if (isFieldConfirmRequired) {
             if (!confirm('您确认已到达现场并完成核验工作吗？')) {
                 setLoading(false);
                 return;
             }
        }

        const prefix = isFieldConfirmRequired ? '【现场确认】' : '';
        const defaultText = isFieldConfirmRequired ? '已完成现场核验，符合安全作业条件。' : '同意';
        const finalOpinion = opinion.trim() ? `${prefix}${opinion}` : `${prefix}${defaultText}`;

        await PermitService.approve({
          recordId: record.id,
          action: 'pass',
          opinion: finalOpinion,
          userName: user?.name || 'Unknown',
        });
      }
      
      onSuccess();
    } catch (e) {
      console.error(e);
      alert('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">审批处理</h3>
          <div className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
             {record.template.name}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 1. 意向切换 (Tabs) - 解决按钮冗余问题 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">审批结果</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {/* 左侧按钮：通过 或 现场确认 */}
              <button
                onClick={() => setActionType('pass')}
                className={`flex-1 py-2.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  actionType === 'pass'
                    ? isFieldConfirmRequired 
                        ? 'bg-orange-500 text-white shadow-md' // 现场确认样式
                        : 'bg-green-600 text-white shadow-md'  // 普通通过样式
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                {isFieldConfirmRequired ? <MapPin size={16} /> : <CheckCircle size={16} />}
                {isFieldConfirmRequired ? '现场确认 (通过)' : '通过'}
              </button>

              {/* 右侧按钮：驳回 */}
              <button
                onClick={() => setActionType('reject')}
                className={`flex-1 py-2.5 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                  actionType === 'reject'
                    ? 'bg-red-600 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
              >
                <XCircle size={16} />
                驳回
              </button>
            </div>
            
            {/* 提示文案 */}
            {isFieldConfirmRequired && actionType === 'pass' && (
                <div className="mt-2 text-xs text-orange-600 flex items-center gap-1 bg-orange-50 p-2 rounded border border-orange-100">
                    <AlertTriangle size={12}/>
                    <span>当前步骤要求：必须进行现场核验后方可提交。</span>
                </div>
            )}
          </div>

          {/* 2. 驳回原因 (仅驳回时显示) */}
          {actionType === 'reject' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="block text-xs font-bold text-red-600 mb-1">驳回原因分类</label>
              <select
                className="w-full border border-red-200 bg-red-50 rounded p-2 text-sm outline-none focus:border-red-400"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              >
                {REJECT_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          {/* 3. 审批意见 */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">
              审批意见 {actionType === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className={`w-full border rounded-lg p-3 h-24 focus:ring-2 outline-none resize-none text-sm transition-colors ${
                 actionType === 'reject' ? 'focus:ring-red-200 focus:border-red-400' : 'focus:ring-blue-200 focus:border-blue-400'
              }`}
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              placeholder={
                actionType === 'reject'
                  ? '请详细说明驳回理由...'
                  : isFieldConfirmRequired
                  ? '请输入现场核验情况说明...'
                  : '请输入审批意见 (可选)'
              }
            />
          </div>
        </div>

        {/* 底部按钮区域 (统一为一个提交按钮) */}
        <div className="bg-slate-50 px-6 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            取消
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-8 py-2.5 text-white rounded-lg text-sm font-bold shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                actionType === 'reject' 
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                    : isFieldConfirmRequired
                        ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200'
                        : 'bg-green-600 hover:bg-green-700 shadow-green-200'
            }`}
          >
            {loading ? (
                <span className="animate-spin">⏳</span>
            ) : actionType === 'reject' ? (
                <XCircle size={18}/>
            ) : isFieldConfirmRequired ? (
                <MapPin size={18}/>
            ) : (
                <CheckCircle size={18}/>
            )}
            {loading ? '提交中...' : '确认提交'}
          </button>
        </div>
      </div>
    </div>
  );
}