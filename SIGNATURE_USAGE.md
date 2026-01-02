# 手写签名功能使用指南

## 概述

手写签名功能已封装为公共组件 `SignatureManager`，可以在任何模块中轻松使用。

## 快速开始

### 1. 导入组件

```tsx
import { SignatureManager } from '@/components/common';
```

### 2. 基本使用

#### 单个签名
```tsx
const [signature, setSignature] = useState<string>('');

<SignatureManager
  value={signature}
  onChange={(value) => setSignature(value as string)}
  allowMultiple={false}
/>
```

#### 多人签名（默认）
```tsx
const [signatures, setSignatures] = useState<string[]>([]);

<SignatureManager
  value={signatures}
  onChange={(value) => setSignatures(value as string[])}
  allowMultiple={true}
/>
```

## 完整示例

```tsx
'use client';

import { useState } from 'react';
import { SignatureManager } from '@/components/common';

export default function MySignatureForm() {
  const [signatures, setSignatures] = useState<string[]>([]);

  const handleSubmit = () => {
    console.log('提交的签名:', signatures);
    // 发送到服务器...
  };

  return (
    <div>
      <h2>手写签名</h2>
      <SignatureManager
        value={signatures}
        onChange={(value) => setSignatures(value as string[])}
        allowMultiple={true}
        maxWidth={300}
        maxHeight={200}
      />
      <button onClick={handleSubmit}>提交</button>
    </div>
  );
}
```

## 使用 Hook（可选）

```tsx
import { useSignature } from '@/hooks';
import { SignatureManager } from '@/components/common';

export default function SignatureWithHook() {
  const { signatures, clearSignatures, hasSignatures } = useSignature(true);

  return (
    <div>
      <SignatureManager
        value={signatures}
        onChange={(value) => {
          // Hook 会自动管理状态
        }}
      />
      {hasSignatures && (
        <button onClick={clearSignatures}>清空签名</button>
      )}
    </div>
  );
}
```

## Props 说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `string \| string[]` | - | 当前签名值 |
| `onChange` | `(value: string \| string[]) => void` | - | 签名变化回调 |
| `readonly` | `boolean` | `false` | 只读模式 |
| `disabled` | `boolean` | `false` | 禁用状态 |
| `maxWidth` | `number` | `200` | 最大显示宽度（px） |
| `maxHeight` | `number` | `100` | 最大显示高度（px） |
| `canvasWidth` | `number` | `600` | 签名画布宽度（px） |
| `canvasHeight` | `number` | `300` | 签名画布高度（px） |
| `allowMultiple` | `boolean` | `true` | 是否支持多人签名 |
| `showRemoveButton` | `boolean` | `true` | 是否显示删除按钮 |

## 功能特性

1. ✅ **自动裁剪和缩放**：保存时自动裁剪空白区域并缩放50%
2. ✅ **多人签名支持**：支持添加多个签名
3. ✅ **数据兼容**：自动兼容旧数据格式
4. ✅ **响应式设计**：支持桌面端和移动端
5. ✅ **类型安全**：完整的 TypeScript 类型定义

## 文件结构

```
src/
├── components/
│   ├── common/
│   │   ├── SignatureManager.tsx      # 公共签名管理器组件
│   │   ├── README.md                  # 使用文档
│   │   └── SignatureManager.example.md # 详细示例
│   └── work-permit/
│       ├── HandwrittenSignature.tsx   # 签名输入组件（内部使用）
│       ├── MultiSignatureDisplay.tsx  # 签名显示组件（内部使用）
│       └── SignatureImage.tsx         # 签名图片组件（内部使用）
├── hooks/
│   └── useSignature.ts               # 签名管理 Hook
└── utils/
    └── signatureCrop.ts               # 签名裁剪和缩放工具
```

## 在其他模块中使用

### 示例：在审批模块中使用

```tsx
import { SignatureManager } from '@/components/common';

function ApprovalForm() {
  const [approvalSignatures, setApprovalSignatures] = useState<string[]>([]);

  return (
    <div>
      <h3>审批签名</h3>
      <SignatureManager
        value={approvalSignatures}
        onChange={setApprovalSignatures}
        allowMultiple={true}
      />
    </div>
  );
}
```

### 示例：在合同模块中使用

```tsx
import { SignatureManager } from '@/components/common';

function ContractForm() {
  const [contractSignature, setContractSignature] = useState<string>('');

  return (
    <div>
      <h3>合同签署</h3>
      <SignatureManager
        value={contractSignature}
        onChange={setContractSignature}
        allowMultiple={false}
      />
    </div>
  );
}
```

## 注意事项

1. 签名数据以 base64 格式存储（不包含 data URL 前缀）
2. 保存时会自动裁剪空白区域并缩放50%
3. 多人签名模式下，签名按添加顺序排列
4. 删除签名时，如果删除后数组为空，会返回空字符串或空数组

## 更多信息

- 详细 API 文档：`src/components/common/SignatureManager.example.md`
- 组件源码：`src/components/common/SignatureManager.tsx`
- Hook 源码：`src/hooks/useSignature.ts`





