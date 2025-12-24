# 隐患整改系统 V2 优化方案

## 概述
本文档详细说明隐患整改系统的优化改进方案，包括新增功能和改进点。

## 主要改进点

### 1. 系统设置按钮修复 ✅
**问题**: 系统设置按钮无效
**解决方案**: 
- 在 `src/app/hidden-danger/page.tsx` 中已有 `config` 视图模式
- 需确保点击"设置"按钮能正确切换到配置页面
- 配置页面应包含：隐患类型管理、区域管理、抄送流程配置、应急预案规则配置

### 2. 部门选择弹窗复用 🟢 NEW
**改进**: 复用 `DepartmentSelectModal` 组件
**位置**: 
- 上报隐患时选择建议责任部门
- 指派隐患时选择责任部门
- 抄送设置时选择抄送部门

**实现步骤**:
```typescript
import DepartmentSelectModal from '@/components/work-permit/moduls/DepartmentSelectModal';

// 使用示例
<DepartmentSelectModal
  isOpen={showDeptModal}
  onClose={() => setShowDeptModal(false)}
  onSelect={(depts) => {
    // 处理选择的部门
    setAssignData({...assignData, responsibleDept: depts[0]});
    setShowDeptModal(false);
  }}
  multiple={false}
/>
```

### 3. 新建隐患时输入整改要求 🟢 NEW
**字段添加**: `rectifyRequirement?: string`

**数据结构**:
```typescript
type HazardRecord = {
  // ... 现有字段
  rectifyRequirement?: string; // 🟢 新增：建议整改要求
}
```

**UI 改进**: 在上报隐患弹窗中添加文本区域
```tsx
<div>
  <label className="block text-sm font-bold mb-1">建议整改要求 (可选)</label>
  <textarea 
    className="w-full border rounded p-2 h-20" 
    placeholder="请描述建议的整改措施和要求..."
    onChange={e=>setNewHazardData({...newHazardData, rectifyRequirement: e.target.value})}
  />
</div>
```

### 4. 一步完成指派功能 🟢 NEW
**核心改进**: 合并指派流程，一次性完成所有设置

**新的指派数据结构**:
```typescript
const [assignData, setAssignData] = useState({
  responsibleDept: '',      // 责任部门
  responsibleId: '',        // 责任人ID
  deadline: '',             // 截止日期
  rectifyRequirement: '',   // 整改要求
  requireEmergencyPlan: false,  // 是否需要应急预案
  emergencyPlanDays: 7,     // 预案提交天数
  ccDepts: [],              // 抄送部门
  ccUsers: [],              // 抄送人员
});
```

**指派UI优化**:
```tsx
{selectedHazard.status === 'reported' && hasPerm('assign') && (
  <div className="space-y-3 p-3 bg-white rounded border shadow-sm">
    <h5 className="font-bold text-sm">一键指派任务</h5>
    
    {/* 责任部门 - 使用部门选择弹窗 */}
    <button onClick={() => {setShowDeptModal(true); setDeptModalTarget('assign')}}>
      {assignData.responsibleDept || '选择责任部门'}
    </button>
    
    {/* 责任人 */}
    <select className="w-full border rounded p-2">
      {allUsers.filter(u => u.department === assignData.responsibleDept)
        .map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
    
    {/* 截止日期 */}
    <input type="date" className="w-full border rounded p-2" />
    
    {/* 整改要求 */}
    <textarea placeholder="整改要求..." className="w-full border rounded p-2 h-20" />
    
    {/* 应急预案设置 */}
    <div className="border-t pt-2">
      <label className="flex items-center gap-2">
        <input type="checkbox" />
        <span className="text-sm">要求提交应急预案</span>
      </label>
      {assignData.requireEmergencyPlan && (
        <input type="number" placeholder="天数" className="w-full mt-2 border rounded p-2" />
      )}
    </div>
    
    {/* 抄送设置 */}
    <div className="border-t pt-2">
      <label className="text-sm font-bold mb-1 block">抄送设置</label>
      <button onClick={() => {setShowDeptModal(true); setDeptModalTarget('cc')}}>
        添加抄送部门
      </button>
      {/* 显示已选抄送 */}
    </div>
    
    <button onClick={handleAssign} className="w-full bg-orange-500 text-white py-2 rounded">
      确认指派
    </button>
  </div>
)}
```

### 5. 高风险/重大风险应急预案要求 🟢 NEW
**自动规则匹配**:
```typescript
// 应急预案规则类型
type EmergencyPlanRule = {
  id: string;
  riskLevels: string[];    // 适用的风险等级 ['high', 'major']
  deadlineDays: number;    // 提交预案的天数
  enabled: boolean;
};

// 指派时自动检查
const handleAssign = async () => {
  // ... 其他逻辑
  
  // 🟢 自动匹配应急预案规则
  const matchedPlanRule = emergencyPlanRules.find(rule =>
    rule.enabled && rule.riskLevels.includes(selectedHazard.riskLevel)
  );
  
  if (matchedPlanRule || assignData.requireEmergencyPlan) {
    const planDays = matchedPlanRule?.deadlineDays || assignData.emergencyPlanDays;
    const planDeadline = new Date();
    planDeadline.setDate(planDeadline.getDate() + planDays);
    
    updates.requireEmergencyPlan = true;
    updates.emergencyPlanDeadline = planDeadline.toISOString().split('T')[0];
  }
};
```

**预案提交UI**:
```tsx
{selectedHazard.requireEmergencyPlan && !selectedHazard.emergencyPlanContent && (
  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
    <h6 className="font-bold text-yellow-800 text-sm mb-2">
      需提交应急预案 (截止: {selectedHazard.emergencyPlanDeadline})
    </h6>
    <textarea 
      placeholder="请填写应急预案内容..."
      className="w-full border p-2 h-24 rounded mb-2"
      onChange={e => setProcessData({...processData, planContent: e.target.value})}
    />
    <button onClick={() => handleProcess('submit_plan')} 
      className="w-full bg-yellow-600 text-white py-2 rounded">
      提交应急预案
    </button>
  </div>
)}
```

### 6. 隐患抄送功能 🟢 NEW
**数据结构**:
```typescript
type HazardRecord = {
  // ... 现有字段
  ccDepts?: string[];  // 抄送部门ID列表
  ccUsers?: string[];  // 抄送人员ID列表
}
```

**抄送规则配置**:
```typescript
type CCRule = {
  id: string;
  name: string;             // 规则名称
  riskLevels: string[];     // 触发风险等级
  ccDepts: string[];        // 抄送部门
  ccUsers: string[];        // 抄送人员
  enabled: boolean;
};
```

**自动匹配抄送规则**:
```typescript
const handleAssign = async () => {
  // ... 其他逻辑
  
  // 🟢 自动匹配抄送规则
  const matchedCCRule = ccRules.find(rule => 
    rule.enabled && rule.riskLevels.includes(selectedHazard.riskLevel)
  );
  
  if (matchedCCRule) {
    updates.ccDepts = [...matchedCCRule.ccDepts, ...assignData.ccDepts];
    updates.ccUsers = [...matchedCCRule.ccUsers, ...assignData.ccUsers];
  }
};
```

### 7. 权限管理 - 隐患抄送编辑 🟢 NEW
**新增权限**: `cc_edit`

**在权限配置中添加**:
```typescript
// src/lib/constants.ts
export const PERMISSION_CONFIG = {
  hidden_danger: {
    // ... 现有权限
    cc_edit: '隐患抄送编辑',  // 🟢 新增
  }
};
```

**权限检查**:
```tsx
{hasPerm('cc_edit') && (
  <div className="抄送配置UI">
    {/* 只有具有此权限的用户才能编辑抄送设置 */}
  </div>
)}
```

### 8. 设置页面 - 流程配置 🟢 NEW
**参考作业管理系统的流程设置**

**配置页面结构**:
```tsx
{viewMode === 'config' && (
  <div className="space-y-6">
    {/* 隐患类型管理 */}
    <ConfigSection title="隐患类型管理">
      {/* 现有功能 */}
    </ConfigSection>
    
    {/* 区域管理 */}
    <ConfigSection title="区域管理">
      {/* 现有功能 */}
    </ConfigSection>
    
    {/* 🟢 NEW: 抄送流程配置 */}
    <ConfigSection title="抄送流程配置">
      <div className="space-y-4">
        {ccRules.map(rule => (
          <div key={rule.id} className="border p-4 rounded">
            <div className="flex justify-between mb-2">
              <input 
                placeholder="规则名称"
                value={rule.name}
                className="font-bold"
              />
              <label>
                <input type="checkbox" checked={rule.enabled} />
                启用
              </label>
            </div>
            
            {/* 触发条件 */}
            <div className="mb-2">
              <label className="text-sm">触发风险等级:</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high', 'major'].map(level => (
                  <label key={level}>
                    <input 
                      type="checkbox"
                      checked={rule.riskLevels.includes(level)}
                    />
                    {level}
                  </label>
                ))}
              </div>
            </div>
            
            {/* 抄送部门 */}
            <button onClick={() => {/* 打开部门选择 */}}>
              选择抄送部门
            </button>
            
            {/* 抄送人员 */}
            <button onClick={() => {/* 打开人员选择 */}}>
              选择抄送人员
            </button>
          </div>
        ))}
        
        <button onClick={()=> {/* 添加新规则 */}}>
          + 添加抄送规则
        </button>
      </div>
    </ConfigSection>
    
    {/* 🟢 NEW: 应急预案规则配置 */}
    <ConfigSection title="应急预案规则">
      <div className="space-y-4">
        {emergencyPlanRules.map(rule => (
          <div key={rule.id} className="border p-4 rounded">
            <label>
              <input type="checkbox" checked={rule.enabled} />
              启用
            </label>
            
            {/* 适用风险等级 */}
            <div className="flex gap-2 mt-2">
              {['high', 'major'].map(level => (
                <label key={level}>
                  <input 
                    type="checkbox"
                    checked={rule.riskLevels.includes(level)}
                  />
                  {level === 'high' ? '高风险' : '重大风险'}
                </label>
              ))}
            </div>
            
            {/* 提交天数 */}
            <div className="mt-2">
              <label>要求在</label>
              <input 
                type="number"
                value={rule.deadlineDays}
                className="w-20 mx-2 border rounded px-2"
              />
              <label>天内提交应急预案</label>
            </div>
          </div>
        ))}
        
        <button onClick={()=> {/* 添加新规则 */}}>
          + 添加预案规则
        </button>
      </div>
    </ConfigSection>
    
    {/* 保存按钮 */}
    <button 
      onClick={saveWorkflowConfig}
      className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold"
    >
      保存配置
    </button>
  </div>
)}
```

## 数据流程图

```
上报隐患
  ↓
[待指派] → 一键指派 (选择部门、人员、截止日期、整改要求、应急预案、抄送)
  ↓         ↓
  |    匹配抄送规则 → 自动添加抄送部门/人员
  |    匹配预案规则 → 自动要求提交应急预案
  ↓
[待整改] → (需要应急预案?) → 提交应急预案
  ↓
开始整改 → [整改中]
  ↓
提交整改结果 (照片 + 描述) → [待验收]
  ↓
验收 → [已闭环]
```

## API 接口

### 现有接口
- `GET /api/hazards` - 获取隐患列表
- `POST /api/hazards` - 创建隐患
- `PATCH /api/hazards` - 更新隐患
- `DELETE /api/hazards` - 删除隐患
- `GET /api/hazards/config` - 获取配置
- `POST /api/hazards/config` - 保存配置

### 新增接口 ✅
- `GET /api/hazards/workflow` - 获取抄送流程配置
- `POST /api/hazards/workflow` - 保存抄送流程配置

## 实施步骤

### 第一阶段: 数据结构和API (已完成 ✅)
1. ✅ 创建 workflow API 路由
2. ✅ 定义数据类型

### 第二阶段: 基础功能增强
1. 在 HazardRecord 类型中添加新字段
2. 修改上报隐患表单，添加整改要求输入
3. 集成 DepartmentSelectModal 组件

### 第三阶段: 一步指派功能
1. 重构指派流程UI
2. 实现自动规则匹配
3. 添加应急预案提交功能

### 第四阶段: 配置页面
1. 创建抄送规则配置UI
2. 创建应急预案规则配置UI
3. 实现配置保存

### 第五阶段: 权限和测试
1. 添加 cc_edit 权限
2. 完整测试所有流程
3. 优化UI和用户体验

## 建议的实现方式

由于 page.tsx 文件较大，建议采用以下方式之一：

### 方案A: 渐进式改进 (推荐)
直接在现有 `page.tsx` 上进行修改，逐步添加新功能。

### 方案B: 完全重写
创建 `page_v2.tsx`，完整实现所有新功能后替换。

**推荐使用方案A**，因为：
- 保持代码连续性
- 降低引入bug风险
- 可以逐个功能测试
- 更容易代码审查

## 下一步行动

建议按照以下顺序进行改进：

1. **立即可做**: 
   - 添加整改要求字段到上报表单
   - 集成部门选择弹窗

2. **核心功能**:
   - 重构指派流程为一步完成
   - 实现自动规则匹配

3. **配置功能**:
   - 完善设置页面
   - 添加流程配置界面

4. **测试和优化**:
   - 端到端测试
   - UI优化
   - 性能优化
