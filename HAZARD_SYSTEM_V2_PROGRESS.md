# 隐患整改系统 V2 实施进度

## 📋 项目概述
优化隐患整改系统，实现一步指派、自动抄送、应急预案管理等高级功能。

## ✅ 已完成阶段

### 阶段1：数据结构扩展 (已完成 ✓)
**实施时间：** 30分钟  
**完成日期：** 2025-12-24

**完成内容：**
1. ✅ 扩展 `HazardRecord` 类型定义
   - `rectifyRequirement` - 整改要求
   - `requireEmergencyPlan` - 是否要求应急预案
   - `emergencyPlanDeadline` - 应急预案截止日期
   - `emergencyPlanContent` - 应急预案内容
   - `emergencyPlanSubmitTime` - 应急预案提交时间
   - `ccDepts` - 抄送部门数组
   - `ccUsers` - 抄送人员数组

2. ✅ 新增规则类型定义
   - `CCRule` - 抄送规则类型
   - `EmergencyPlanRule` - 应急预案规则类型

**文件修改：**
- `src/app/hidden-danger/page.tsx` - 类型定义扩展

---

### 阶段2：上报功能增强 (已完成 ✓)
**实施时间：** 20分钟  
**完成日期：** 2025-12-24

**完成内容：**
1. ✅ 上报表单新增"建议整改要求"输入框
   - 提供输入提示和说明
   - 可选字段，不影响现有流程
   - 保存到 `rectifyRequirement` 字段

2. ✅ UI优化
   - 友好的提示文字
   - 清晰的字段说明

**文件修改：**
- `src/app/hidden-danger/page.tsx` - 上报模态框UI

---

### 阶段3：一步指派功能 (已完成 ✓)
**实施时间：** 60分钟  
**完成日期：** 2025-12-24

**完成内容：**
1. ✅ 工作流规则管理
   - `fetchWorkflowRules()` - 从API获取抄送和应急预案规则
   - `autoMatchCCRules()` - 根据风险等级自动匹配抄送规则
   - `checkEmergencyPlanRequired()` - 检查是否需要应急预案

2. ✅ 指派表单UI重构
   - 责任部门和责任人选择（保留原有逻辑）
   - 整改截止日期选择
   - 整改要求输入框（支持引用上报人建议）
   - 应急预案要求自动判断和显示
   - 抄送信息自动匹配和显示

3. ✅ 指派逻辑增强
   - 自动匹配抄送规则并填充 `ccDepts` 和 `ccUsers`
   - 根据风险等级和截止日期自动判断应急预案要求
   - 将整改要求、应急预案信息一并保存
   - 保持向后兼容性

4. ✅ TypeScript类型修复
   - 修复了所有类型错误
   - 添加必要的类型注解

**文件修改：**
- `src/app/hidden-danger/page.tsx` - 指派功能完整实现

**核心功能代码：**
```typescript
// 自动匹配抄送规则
const autoMatchCCRules = (riskLevel: string) => {
    const matchedRules = ccRules.filter(rule => 
        rule.enabled && rule.riskLevels.includes(riskLevel as any)
    );
    // 返回去重后的部门和人员列表
};

// 检查应急预案要求
const checkEmergencyPlanRequired = (riskLevel: string, deadline: string) => {
    // 匹配规则并计算应急预案截止日期
    // 返回 { required, deadline }
};

// 指派时传递新字段
updates = {
    ...基础字段,
    rectifyRequirement: processData.rectifyRequirement,
    requireEmergencyPlan: processData.requireEmergencyPlan,
    emergencyPlanDeadline: processData.emergencyPlanDeadline,
    ccDepts: ccInfo.ccDepts,
    ccUsers: ccInfo.ccUsers
};
```

---

## ⏳ 待实施阶段

### 阶段4：应急预案功能 (待开始)
**预计时间：** 30分钟

**待实施内容：**
1. ⏳ 应急预案提交入口
   - 在 assigned/rectifying 状态下显示应急预案提交表单
   - 检查是否已过期

2. ⏳ 应急预案管理
   - 提交应急预案内容
   - 记录提交时间
   - 显示应急预案状态

---

### 阶段5：配置页面 (待开始)
**预计时间：** 90分钟

**待实施内容：**
1. ⏳ 配置页面框架
   - 创建配置选项卡切换UI
   - 基础信息配置、抄送规则、应急预案规则

2. ⏳ 抄送规则配置
   - 规则列表显示
   - 添加/编辑/删除规则
   - 启用/禁用规则

3. ⏳ 应急预案规则配置
   - 规则列表显示
   - 添加/编辑/删除规则
   - 天数设置

---

### 阶段6：DepartmentSelectModal集成 (待开始)
**预计时间：** 30分钟

**待实施内容：**
1. ⏳ 复用 DepartmentSelectModal 组件
2. ⏳ 替换现有部门选择下拉框
3. ⏳ 保持功能一致性

---

## 📊 整体进度
- ✅ 阶段1：数据结构扩展（100%）
- ✅ 阶段2：上报功能增强（100%）
- ✅ 阶段3：一步指派功能（100%）
- ⏳ 阶段4：应急预案功能（0%）
- ⏳ 阶段5：配置页面（0%）
- ⏳ 阶段6：DepartmentSelectModal集成（0%）

**总体完成度：** 50% (3/6 阶段)

---

## 🔑 关键成果

### 已实现功能
1. ✅ **一步指派** - 指派时可同时设置责任人、截止日期、整改要求、应急预案要求和抄送信息
2. ✅ **自动规则匹配** - 根据风险等级自动匹配抄送规则和应急预案要求
3. ✅ **智能提示** - 上报时可填写建议整改要求，指派时自动引用
4. ✅ **向后兼容** - 新字段均为可选，不影响现有流程

### 技术亮点
- 类型安全的TypeScript实现
- 组件化的UI设计
- 清晰的状态管理
- 自动化规则引擎

---

## 📝 下一步计划
1. 实施阶段4：应急预案提交功能
2. 实施阶段5：配置页面（抄送规则和应急预案规则管理）
3. 实施阶段6：集成 DepartmentSelectModal
4. 完整测试和优化

---

## 📂 相关文档
- `HAZARD_SYSTEM_V2_PLAN.md` - 完整设计规划
- `HAZARD_SYSTEM_V2_IMPLEMENTATION.md` - 详细实施指南
- `src/lib/constants.ts` - 权限配置
- `src/app/api/hazards/workflow/route.ts` - 工作流API

---

**最后更新：** 2025-12-24 20:38
**状态：** 进行中
