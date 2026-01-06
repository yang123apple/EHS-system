import React, { useState, useEffect } from 'react';
import { Eye, TestTube2, CheckCircle, XCircle } from 'lucide-react';

type Field = 'userId' | 'deptId' | 'jobTitle' | 'documentId' | 'all' | 'jobLevel';
type Operator = 'equals' | 'contains' | 'regex' | 'in' | 'startsWith' | 'levelGte' | 'levelLte';

interface CondItem {
  id: string;
  field: Field;
  operator: Operator;
  value: string;
}

interface Props {
  value?: any;
  onChange?: (val: any) => void;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function AutoAssignBuilder({ value, onChange }: Props) {
  const [conj, setConj] = useState<'AND'|'OR'>('AND');
  const [conds, setConds] = useState<CondItem[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<{ pass: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (!value) return;
    try {
      if (value.conjunction && Array.isArray(value.conditions)) {
        setConj(value.conjunction);
        setConds(value.conditions.map((c: any) => ({ id: uid(), field: c.field, operator: c.operator, value: String(c.value) })));
      } else if (typeof value === 'object' && Object.keys(value).length > 0) {
        const keys = Object.keys(value);
        setConds(keys.map(k => ({ id: uid(), field: k as Field, operator: 'equals' as Operator, value: String((value as any)[k]) })));
        setConj('AND');
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const out = { conjunction: conj, conditions: conds.map(c => ({ field: c.field, operator: c.operator, value: c.value })) };
    onChange && onChange(out);
  }, [conds, conj]);

  const addCond = () => setConds(prev => [...prev, { id: uid(), field: 'jobTitle', operator: 'equals', value: '' }]);
  const removeCond = (id: string) => setConds(prev => prev.filter(c => c.id !== id));
  const updateCond = (id: string, patch: Partial<CondItem>) => setConds(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  const testCondition = (c: CondItem) => {
    if (!testInput) return setTestResult({ pass: false, msg: '请先输入测试值' });
    try {
      let pass = false;
      const val = testInput;
      switch (c.operator) {
        case 'equals': pass = val === c.value; break;
        case 'contains': pass = val.includes(c.value); break;
        case 'startsWith': pass = val.startsWith(c.value); break;
        case 'in': pass = c.value.split(',').map(v => v.trim()).includes(val); break;
        case 'regex': pass = new RegExp(c.value).test(val); break;
        case 'levelGte': pass = parseInt(val) >= parseInt(c.value); break;
        case 'levelLte': pass = parseInt(val) <= parseInt(c.value); break;
        default: pass = false;
      }
      setTestResult({ pass, msg: pass ? '✓ 匹配成功' : '✗ 不匹配' });
    } catch (e: any) {
      setTestResult({ pass: false, msg: `错误: ${e.message}` });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">逻辑关系</label>
        <select value={conj} onChange={e => setConj(e.target.value as any)} className="px-2 py-1 border rounded">
          <option value="AND">AND（并且）</option>
          <option value="OR">OR（或）</option>
        </select>
        <button onClick={() => setShowPreview(!showPreview)} className="ml-auto flex items-center gap-1 px-3 py-1 bg-slate-100 rounded text-sm">
          <Eye size={14} />
          {showPreview ? '隐藏预览' : '查看预览'}
        </button>
      </div>

      {showPreview && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs font-mono">
          <pre>{JSON.stringify({ conjunction: conj, conditions: conds.map(c => ({ field: c.field, operator: c.operator, value: c.value })) }, null, 2)}</pre>
        </div>
      )}

      <div className="space-y-2">
        {conds.map(c => (
          <div key={c.id} className="border border-slate-200 rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <select value={c.field} onChange={e => updateCond(c.id, { field: e.target.value as Field })} className="px-2 py-1 border rounded text-sm">
                <option value="userId">指定用户</option>
                <option value="deptId">指定部门</option>
                <option value="jobTitle">岗位</option>
                <option value="jobLevel">职位层级</option>
                <option value="documentId">文档</option>
                <option value="all">全体</option>
              </select>

              <select value={c.operator} onChange={e => updateCond(c.id, { operator: e.target.value as Operator })} className="px-2 py-1 border rounded text-sm">
                <option value="equals">等于</option>
                <option value="contains">包含</option>
                <option value="startsWith">前缀匹配</option>
                <option value="in">属于(逗号分隔)</option>
                <option value="regex">正则表达式</option>
                {c.field === 'jobLevel' && <option value="levelGte">≥ (大于等于)</option>}
                {c.field === 'jobLevel' && <option value="levelLte">≤ (小于等于)</option>}
              </select>

              <input type="text" value={c.value} onChange={e => updateCond(c.id, { value: e.target.value })} className="px-2 py-1 border rounded flex-1 text-sm" placeholder="值，例如：操作工 或 dept_cuid" />

              <button onClick={() => removeCond(c.id)} className="px-2 py-1 bg-red-50 text-red-600 rounded text-sm">删除</button>
            </div>

            {/* 正则测试面板 */}
            {c.operator === 'regex' && (
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded">
                <TestTube2 size={14} className="text-slate-500" />
                <input type="text" value={testInput} onChange={e => setTestInput(e.target.value)} placeholder="输入测试字符串" className="px-2 py-1 border rounded flex-1 text-xs" />
                <button onClick={() => testCondition(c)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">测试</button>
                {testResult && (
                  <span className={`text-xs flex items-center gap-1 ${testResult.pass ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.pass ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {testResult.msg}
                  </span>
                )}
              </div>
            )}

            {/* 条件说明 */}
            <div className="text-xs text-slate-500">
              {c.field === 'jobLevel' && '职位层级匹配：数字越大职位越高，例如 1=普通员工，5=部门经理'}
              {c.operator === 'regex' && '正则表达式：使用 JavaScript 正则语法，例如 ^操作.*$ 匹配以"操作"开头的岗位'}
              {c.operator === 'in' && '多值匹配：使用逗号分隔多个值，例如"操作工,技术员,班长"'}
            </div>
          </div>
        ))}
      </div>

      <div>
        <button onClick={addCond} className="px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">添加条件</button>
      </div>
    </div>
  );
}
