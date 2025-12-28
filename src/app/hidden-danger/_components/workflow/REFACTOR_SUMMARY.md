# 工作流编辑器重构总结

## 重构时间
2025-12-26

## 重构文件
1. `CCRuleEditor.tsx` - 抄送规则编辑器
2. `WorkflowStepEditor.tsx` - 工作流步骤编辑器

---

## 一、CCRuleEditor.tsx 重构要点

### 1. 流式小卡片布局（核心重点）

**改变前：**
- 占据整行的长条卡片
- 垂直堆叠布局

**改变后：**
```tsx
<div className="flex flex-wrap gap-3">
  {rules.map((rule, index) => (
    <div className="group relative w-64 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5 hover:border-slate-300 transition-all">
      {/* 卡片内容 */}
    </div>
  ))}
</div>
```

**特点：**
- 固定宽度 `w-64` 的小方块卡片
- `flex flex-wrap gap-3` 实现流式布局
- 自动换行，充分利用空间
- 响应式设计

### 2. 内容精简

**移除项：**
- ❌ 删除"规则描述"输入框（用户无需手动填写）
- ❌ 删除左侧占位的"选择人员"按钮（重复）

**保留项：**
- ✅ 规则类型选择器
- ✅ 根据类型显示的配置项
- ✅ 仅在需要配置时显示唯一的触发按钮

### 3. 视觉层级优化

**卡片样式：**
```tsx
className="bg-slate-50 border border-slate-200"  // 淡灰色背景
```
- 与外层步骤卡片（`bg-white`）形成明显的父子嵌套感
- 更细的边框 `border-slate-200`

**交互优化：**
```tsx
<button className="opacity-0 group-hover:opacity-100 transition-opacity">
  <Trash2 size={14} />
</button>
```
- 删除按钮仅在鼠标悬停时显示
- 保持界面清爽

### 4. 图标统一规范

**统一尺寸：**
```tsx
<Users size={14} className="text-blue-600" />
<UserCheck size={14} className="text-green-600" />
<MapPin size={14} className="text-orange-600" />
```
- 所有图标统一 `size={14}`
- 根据功能区分颜色（删除用红色、选择用蓝色）

### 5. 数据纯净性

**类型切换时清理配置：**
```tsx
const updateRuleType = (index: number, newType: CCRuleType) => {
  const newRules = [...rules];
  // 切换类型时清理旧配置，避免脏数据
  newRules[index] = {
    ...newRules[index],
    type: newType,
    config: {},      // 重置配置
    description: ''  // 重置描述
  };
  onChange(newRules);
};
```

### 6. 组件提取

**内部子组件：**
```tsx
// 内部组件：人员标签
const UserTag = ({ user }: { user: SimpleUser }) => (
  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs">
    {/* 统一样式 */}
  </div>
);

// 内部组件：部门标签
const DeptTag = ({ deptName }: { deptName: string }) => (
  <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs">
    {/* 统一样式 */}
  </div>
);
```

---

## 二、WorkflowStepEditor.tsx 重构要点

### 1. 分段控件（Segmented Control）

**改变前：**
- 普通按钮组

**改变后：**
```tsx
<div className="inline-flex bg-slate-100 rounded-lg p-1">
  {(['OR', 'AND', 'CONDITIONAL'] as ApprovalMode[]).map(mode => (
    <button
      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
        (step.handlerStrategy.approvalMode || 'OR') === mode
          ? 'bg-white text-slate-800 shadow-sm'  // 选中态
          : 'text-slate-600 hover:text-slate-800'
      }`}
    >
      {/* 按钮文本 */}
    </button>
  ))}
</div>
```

**特点：**
- 背景灰色 `bg-slate-100`
- 选中态为纯白 `bg-white` + 微弱阴影 `shadow-sm`
- 专业的 macOS 风格分段选择器

### 2. 锁定状态重绘

**改变前：**
- 大面积黄色背景

**改变后：**
```tsx
{/* 核心步骤左侧装饰线 */}
{isLocked && (
  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l-lg" />
)}

{/* 锁定提示 */}
<div className="flex items-start gap-2 p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
  <Lock size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
  <div>
    <div className="text-xs font-medium text-amber-800">执行人已锁定</div>
    <div className="text-xs text-amber-600/80 mt-0.5">
      {step.id === 'report' && '此步骤执行人强制为隐患上报人'}
      {step.id === 'rectify' && '此步骤执行人强制为整改责任人'}
    </div>
  </div>
</div>
```

**特点：**
- 左侧 4px 装饰线 `w-1 bg-amber-400`
- 轻量级的 Lock 图标
- 清晰的提示文案

### 3. 交互优化

**操作按钮隐藏：**
```tsx
<div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
  <button title="上移">
    <ArrowUp size={14} />
  </button>
  <button title="下移">
    <ArrowDown size={14} />
  </button>
  <button title="删除步骤">
    <Trash2 size={14} />
  </button>
</div>
```

**特点：**
- 步骤操作按钮（上移、下移、删除）设为 `opacity-0 group-hover:opacity-100`
- 页面静止时绝对清爽
- 悬停时才显示操作项

### 4. 步骤头部合并

**显示格式：**
```tsx
<div className="flex items-center gap-2.5 flex-1 min-w-0">
  {/* 序号 */}
  <span className="flex-shrink-0 w-6 h-6 rounded bg-blue-600 text-white text-xs font-semibold">
    {index + 1}
  </span>
  
  {/* 步骤名称 */}
  <h4 className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">
    {step.name}
  </h4>

  {/* 策略标签 */}
  <span className="flex-shrink-0 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
    {getStrategyLabel(step.handlerStrategy.type)}
  </span>

  {/* 核心标识 */}
  {isCore && (
    <div className="flex-shrink-0 flex items-center gap-1 text-xs text-amber-600">
      <Lock size={12} />
    </div>
  )}
</div>
```

**特点：**
- 紧凑的横向布局
- 半透明小标签显示策略类型
- 核心步骤显示锁定图标

### 5. 数据纯净性

**策略切换时清理配置：**
```tsx
onChange={e => {
  const newStrategy = e.target.value as HandlerStrategy;
  // 切换策略时清理旧配置，避免脏数据
  updateHandlerStrategy(index, {
    type: newStrategy,
    description: step.handlerStrategy.description,
    approvalMode: 'OR',
  });
}}
```

**特点：**
- 切换"处理策略"或"抄送类型"时重置并清理无关的 config 属性
- 确保导出的 JSON 不包含旧类型的残留数据

---

## 三、技术规范

### 1. 图标使用
- 统一使用 `lucide-react`
- 尺寸固定为 `size={14}`
- 颜色根据功能区分

### 2. 代码组织
- 提取重复的标签组件为内部子组件
- 确保样式高度统一
- 流式布局能正确换行

### 3. 样式规范
```tsx
// 父容器（步骤卡片）
bg-white border border-slate-200

// 子容器（抄送规则卡片）
bg-slate-50 border border-slate-200

// 分段控件
bg-slate-100  // 容器背景
bg-white shadow-sm  // 选中态

// 锁定标识
w-1 bg-amber-400  // 左侧装饰线
bg-amber-50/50 border border-amber-200  // 提示框
```

### 4. 交互规范
- 使用 `opacity-0 group-hover:opacity-100` 实现悬停显示
- 所有按钮都有 `transition-` 类实现平滑过渡
- 禁用状态使用 `cursor-not-allowed` 和淡色

---

## 四、重构效果

### 视觉效果
- ✅ 更清爽的界面，减少视觉噪音
- ✅ 更专业的设计风格
- ✅ 更好的层级区分

### 用户体验
- ✅ 流式布局提高空间利用率
- ✅ 悬停显示操作减少干扰
- ✅ 分段控件更符合直觉

### 工程质量
- ✅ 数据纯净，无脏数据残留
- ✅ 代码提取，高度复用
- ✅ 样式统一，易于维护

---

## 五、注意事项

1. **流式布局换行**：确保容器宽度变化时能正确换行
2. **数据清理**：切换类型时必须清理旧配置
3. **图标规范**：严格遵守 `size={14}` 的统一尺寸
4. **悬停交互**：所有隐藏按钮必须在 `group-hover` 时显示

---

## 六、未来优化方向

1. 考虑添加拖拽排序功能
2. 考虑添加规则预览功能
3. 考虑添加配置导入/导出功能
4. 考虑添加规则验证提示

---

**重构完成日期：** 2025-12-26  
**重构工程师：** Cline AI Assistant
