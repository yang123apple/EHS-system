# 隐患整改系统 V2 实施总结

## 已完成的准备工作 ✅

### 1. API 路由 ✅
- **文件**: `src/app/api/hazards/workflow/route.ts`
- **功能**: 
  - GET - 获取抄送规则和应急预案规则配置
  - POST - 保存配置
- **数据存储**: `data/hazard-workflow.json`

### 2. 权限配置 ✅
- **文件**: `src/lib/constants.ts`
- **新增权限**: `edit_cc_workflow` (隐患抄送编辑)
- 已正确添加到 hidden_danger 模块权限列表

### 3. 部门选择组件 ✅
- **文件**: `src/components/work-permit/moduls/DepartmentSelectModal.tsx`
- 可直接复用于隐患系统

## 待实施的功能清单

基于现有的 `src/app/hidden-danger/page.tsx`，需要进行以下改进：

### 阶段一：基础数据结构扩展 (30分钟)

#### 1.1 扩展 HazardRecord 类型
```typescript
type HazardRecord = {
  // ... 现有字段
  
  // 🟢 新增字段
  rectifyRequirement?: string;       // 整改要求
  requireEmergencyPlan?: boolean;    // 是否需要应急预案
  emergencyPlanDeadline?: string;    // 应急预案截止日期
  emergencyPlanContent?: string;     // 应急预案内容
  emergencyPlanSubmitTime?: string;  // 应急预案提交时间
  ccDepts?: string[];                // 抄送部门
  ccUsers?: string[];                // 抄送人员
}
```

#### 1.2 新增配置类型
```typescript
type CCRule = {
  id: string;
  name: string;
  riskLevels: string[];
  ccDepts: string[];
  ccUsers: string[];
  enabled: boolean;
};

type EmergencyPlanRule = {
  id: string;
  riskLevels: string[];
  deadlineDays: number;
  enabled: boolean;
};
```

### 阶段二：上报功能增强 (20分钟)

#### 2.1 添加整改要求输入框
在上报隐患弹窗中添加（约第680行附近）：
```tsx
<div>
  <label className="block text-sm font-bold mb-1">建议整改要求 (可选)</label>
  <textarea 
    className="w-full border rounded p-2 h-20" 
    placeholder="请描述建议的整改措施和要求..."
    value={newHazardData.rectifyRequirement || ''}
    onChange={e=>setNewHazardData({...newHazardData, rectifyRequirement: e.target.value})}
  />
</div>
```

#### 2.2 部门选择改为弹窗
替换现有的 select 为按钮触发 DepartmentSelectModal

### 阶段三：一步指派功能 (1小时)

#### 3.1 修改状态管理
```typescript
// 替换现有的 processData
const [assignData, setAssignData] = useState({
  responsibleDept: '',
  responsibleId: '',
  deadline: '',
  rectifyRequirement: '',
  requireEmergencyPlan: false,
  emergencyPlanDays: 7,
  ccDepts: [],
  ccUsers: [],
});
```

#### 3.2 重构指派 UI (约第780行)
完全重写指派部分，整合所有输入项

#### 3.3 实现 handleAssign 函数
```typescript
const handleAssign = async () => {
  // 验证
  if (!assignData.responsibleDept || !assignData.responsibleId || !assignData.deadline) {
    return alert("请完善指派信息");
  }
  
  // 自动匹配抄送规则
  const matchedCCRule = ccRules.find(rule => 
    rule.enabled && rule.riskLevels.includes(selectedHazard.riskLevel)
  );
  
  // 自动匹配应急预案规则
  const matchedPlanRule = emergencyPlanRules.find(rule =>
    rule.enabled && rule.riskLevels.includes(selectedHazard.riskLevel)
  );
  
  // 构建更新数据
  const updates = {
    operatorId: user?.id,
    operatorName: user?.name,
    actionName: '指派责任人',
    status: 'assigned',
    ...assignData,
  };
  
  // 应急预案
  if (matchedPlanRule || assignData.requireEmergencyPlan) {
    const days = matchedPlanRule?.deadlineDays || assignData.emergencyPlanDays;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + days);
    updates.requireEmergencyPlan = true;
    updates.emergencyPlanDeadline = deadline.toISOString().split('T')[0];
  }
  
  // 抄送
  if (matchedCCRule) {
    updates.ccDepts = [...matchedCCRule.ccDepts, ...assignData.ccDepts];
    updates.ccUsers = [...matchedCCRule.ccUsers, ...assignData.ccUsers];
  }
  
  await fetch('/api/hazards', { 
    method: 'PATCH', 
    body: JSON.stringify({ id: selectedHazard.id, ...updates }) 
  });
  
  alert("指派成功！");
  // 重置和刷新...
};
```

### 阶段四：应急预案功能 (30分钟)

#### 4.1 添加预案提交 UI
在详情弹窗中添加（当需要预案且未提交时显示）：
```tsx
{selectedHazard.requireEmergencyPlan && 
 !selectedHazard.emergencyPlanContent && 
 selectedHazard.status === 'assigned' && (
  <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-3">
    <h6 className="font-bold text-yellow-800 text-sm mb-2 flex items-center gap-2">
      <FileText size={16}/>
      需提交应急预案 (截止: {selectedHazard.emergencyPlanDeadline})
    </h6>
    <textarea 
      placeholder="请填写应急预案内容..."
      className="w-full border p-2 h-24 rounded mb-2"
      onChange={e => setProcessData({...processData, planContent: e.target.value})}
    />
    <button 
      onClick={() => handleProcess('submit_plan')} 
      className="w-full bg-yellow-600 text-white py-2 rounded text-sm hover:bg-yellow-700"
    >
      提交应急预案
    </button>
  </div>
)}
```

#### 4.2 添加 submit_plan 处理
在 handleProcess 函数中添加：
```typescript
case 'submit_plan':
  if (!processData.planContent) return alert("请填写应急预案内容");
  updates = {
    ...updates,
    actionName: '提交应急预案',
    emergencyPlanContent: processData.planContent,
    emergencyPlanSubmitTime: new Date().toISOString()
  };
  break;
```

### 阶段五：配置页面 (1.5小时)

#### 5.1 添加状态和 Effects
```typescript
const [ccRules, setCCRules] = useState<CCRule[]>([]);
const [emergencyPlanRules, setEmergencyPlanRules] = useState<EmergencyPlanRule[]>([]);

const fetchWorkflowConfig = async () => {
  const res = await fetch('/api/hazards/workflow');
  if (res.ok) {
    const data = await res.json();
    setCCRules(data.ccRules || []);
    setEmergencyPlanRules(data.emergencyPlanRules || []);
  }
};

useEffect(() => {
  // ... 现有调用
  fetchWorkflowConfig();
}, []);
```

#### 5.2 创建配置页面 UI
在 `viewMode === 'config'` 部分完全重写，添加：
- 抄送流程配置区域
- 应急预案规则配置区域
- 保存按钮

### 阶段六：集成 DepartmentSelectModal (30分钟)

#### 6.1 导入组件
```typescript
import DepartmentSelectModal from '@/components/work-permit/moduls/DepartmentSelectModal';
```

#### 6.2 添加状态
```typescript
const [showDeptModal, setShowDeptModal] = useState(false);
const [deptModalTarget, setDeptModalTarget] = useState<'report' | 'assign' | 'cc' | null>(null);
```

#### 6.3 添加组件
```tsx
{showDeptModal && (
  <DepartmentSelectModal
    isOpen={showDeptModal}
    onClose={() => setShowDeptModal(false)}
    onSelect={(depts) => {
      if (deptModalTarget === 'report') {
        setNewHazardData({...newHazardData, responsibleDept: depts[0]});
      } else if (deptModalTarget === 'assign') {
        setAssignData({...assignData, responsibleDept: depts[0]});
      } else if (deptModalTarget === 'cc') {
        setAssignData({...assignData, ccDepts: [...assignData.ccDepts, ...depts]});
      }
      setShowDeptModal(false);
    }}
    multiple={deptModalTarget === 'cc'}
  />
)}
```

## 实施时间估算

| 阶段 | 任务 | 时间 |
|-----|------|------|
| 1 | 数据结构扩展 | 30分钟 |
| 2 | 上报功能增强 | 20分钟 |
| 3 | 一步指派功能 | 60分钟 |
| 4 | 应急预案功能 | 30分钟 |
| 5 | 配置页面 | 90分钟 |
| 6 | 部门选择集成 | 30分钟 |
| 测试 | 全流程测试 | 60分钟 |
| **总计** | | **约5.5小时** |

## 关键修改点位置

基于现有 `page.tsx` 文件（约450行）：

1. **类型定义**: 第1-60行 - 扩展 HazardRecord 类型
2. **State 声明**: 第70-120行 - 添加新状态
3. **Effects**: 第140-160行 - 添加 fetchWorkflowConfig
4. **上报弹窗**: 第680-750行 - 添加整改要求输入
5. **指派功能**: 第780-850行 - 完全重写
6. **应急预案**: 第850-900行 - 新增UI和逻辑
7. **配置页面**: 需要新增完整的 config 视图

## 测试清单

### 功能测试
- [ ] 上报隐患时可以输入整改要求
- [ ] 使用部门选择弹窗选择责任部门
- [ ] 一步完成指派（部门、人员、日期、要求、预案、抄送）
- [ ] 高风险隐患自动触发应急预案要求
- [ ] 重大风险自动触发抄送规则
- [ ] 可以提交应急预案
- [ ] 配置页面可以编辑抄送规则
- [ ] 配置页面可以编辑应急预案规则
- [ ] 配置可以正确保存和加载

### 权限测试
- [ ] edit_cc_workflow 权限控制抄送配置编辑

### UI测试
- [ ] 所有新增UI元素正常显示
- [ ] 响应式设计正常工作
- [ ] 交互流程顺畅

## 风险点和注意事项

1. **数据兼容性**: 新字段都是可选的，不影响现有数据
2. **API兼容性**: PATCH 接口支持动态字段，无需修改
3. **状态管理**: 注意区分 processData 和 assignData
4. **规则匹配**: 确保规则匹配逻辑正确，避免重复添加
5. **权限检查**: 所有配置编辑功能都要检查权限

## 下一步建议

**推荐实施顺序**：

1. **先做简单的** (阶段2) - 上报功能增强，快速见效
2. **再做核心的** (阶段3-4) - 一步指派和应急预案，核心价值
3. **最后做配置** (阶段5-6) - 配置页面和集成，完善体验

每完成一个阶段后测试，确保稳定后再进行下一阶段。

## 完成标志

当以下条件全部满足时，任务完成：

✅ 所有新字段已添加到类型定义
✅ 上报隐患可输入整改要求
✅ 使用部门选择弹窗
✅ 指派流程为一步完成
✅ 自动匹配抄送规则和应急预案规则
✅ 应急预案提交功能可用
✅ 配置页面完整可用
✅ 所有功能通过测试
✅ 代码无明显错误
✅ 用户体验流畅

---

**当前状态**: 准备工作已完成，可以开始实施 ✅
**建议**: 按阶段逐步实施，每个阶段完成后测试再继续
