// src/app/(dashboard)/hidden-danger/_components/modals/HazardDetailModal/ActionForms/VerifyForm.tsx
import { useState, useEffect } from 'react';
import { HazardRecord, SimpleUser, HazardWorkflowConfig } from '@/types/hidden-danger';
import { CheckCircle, Ban, Wand2, Loader2, Info } from 'lucide-react';
import { matchHandler } from '@/app/hidden-danger/_utils/handler-matcher';
import { apiFetch } from '@/lib/apiClient';

interface VerifyFormProps {
  hazard: HazardRecord;
  allUsers: SimpleUser[];
  onProcess: (action: string, hazard: HazardRecord, data?: any) => void;
}

export function VerifyForm({ hazard, allUsers, onProcess }: VerifyFormProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [workflowConfig, setWorkflowConfig] = useState<HazardWorkflowConfig | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<string>('');
  const [suggestedVerifier, setSuggestedVerifier] = useState<string>('');

  // 加载工作流配置
  useEffect(() => {
    loadWorkflowConfig();
  }, []);

  const loadWorkflowConfig = async () => {
    try {
      const response = await apiFetch('/api/hazards/workflow');
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setWorkflowConfig(result.data);
        }
      }
    } catch (error) {
      console.error('加载工作流配置失败:', error);
    }
  };

  // 智能匹配验收人（用于提示）
  const handleAutoMatch = async () => {
    if (!workflowConfig) {
      alert('工作流配置未加载，无法使用智能匹配');
      return;
    }

    setIsMatching(true);
    setMatchResult('');
    setSuggestedVerifier('');

    try {
      // 查找"整改验收"步骤
      const verifyStep = workflowConfig.steps.find(s => 
        s.id === 'rectify_verify' || s.name.includes('验收')
      );

      if (!verifyStep) {
        setMatchResult('❌ 未找到验收步骤配置');
        setIsMatching(false);
        return;
      }

      // 执行智能匹配
      const result = await matchHandler({
        hazard,
        step: verifyStep,
        allUsers,
        departments: [],
      });

      if (result.success && result.userIds && result.userIds.length > 0) {
        // 直接使用返回的用户ID查找用户，避免通过用户名查找可能失败的问题
        const matchedUser = allUsers.find(u => u.id === result.userIds[0]);
        if (matchedUser) {
          setSuggestedVerifier(matchedUser.name);
          setMatchResult(`✅ ${result.matchedBy}: ${result.userNames?.join(', ')}`);
        } else {
          // 如果通过ID找不到，尝试通过用户名查找（向后兼容）
          const matchedUserByName = allUsers.find(u => u.name === result.userNames[0]);
          if (matchedUserByName) {
            setSuggestedVerifier(matchedUserByName.name);
            setMatchResult(`✅ ${result.matchedBy}: ${result.userNames?.join(', ')}`);
          } else {
            setMatchResult(`❌ 未找到匹配的用户`);
          }
        }
      } else {
        setMatchResult(`❌ ${result.error || '未找到匹配的验收人'}`);
      }
    } catch (error) {
      console.error('智能匹配失败:', error);
      setMatchResult('❌ 匹配过程出错');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
      <h5 className="font-bold text-sm text-purple-800">验收确认</h5>
      
      <div className="bg-white p-3 rounded border text-xs text-slate-600 space-y-1">
        <div className="font-bold text-slate-800">整改人描述：</div>
        <p>{hazard.rectifyDesc || '未填写描述'}</p>
      </div>

      {/* 智能匹配验收人建议 */}
      {workflowConfig && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-800">
              <Wand2 size={16} />
              智能匹配验收人
            </div>
            <button
              onClick={handleAutoMatch}
              disabled={isMatching}
              className={`px-4 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 ${
                isMatching
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isMatching ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  匹配中...
                </>
              ) : (
                <>
                  <Wand2 size={14} />
                  查看建议
                </>
              )}
            </button>
          </div>
          {matchResult && (
            <div className="text-xs mt-2 space-y-1">
              <div className="text-slate-700 bg-white rounded px-2 py-1.5 border">
                {matchResult}
              </div>
              {suggestedVerifier && (
                <div className="flex items-start gap-1.5 text-blue-700 bg-blue-100 rounded px-2 py-1.5">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <span>建议由 <strong>{suggestedVerifier}</strong> 进行验收</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button 
          onClick={() => onProcess('verify_pass', hazard)}
          className="w-full bg-green-600 text-white py-2 rounded text-sm font-bold shadow hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle size={16}/> 验收通过
        </button>

        <div className="border-t pt-2 mt-2">
          <input 
            className="w-full border p-2 text-xs mb-2 rounded" 
            placeholder="若需驳回，请填写原因..." 
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <button 
            onClick={() => onProcess('verify_reject', hazard, { rejectReason })}
            disabled={!rejectReason.trim()}
            className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 ${
              !rejectReason.trim()
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
            }`}
          >
            <Ban size={14}/> 驳回重整
          </button>
        </div>
      </div>
    </div>
  );
}
