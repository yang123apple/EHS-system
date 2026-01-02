# 手写签名组件使用指南

## 概述

`SignatureManager` 是一个公共的手写签名管理组件，提供了统一的签名输入、显示和管理功能。支持单个签名和多人签名两种模式。

## 基本使用

### 1. 单个签名模式

```tsx
import { SignatureManager } from '@/components/common';
import { useState } from 'react';

function MyComponent() {
  const [signature, setSignature] = useState<string>('');

  return (
    <SignatureManager
      value={signature}
      onChange={(value) => setSignature(value as string)}
      allowMultiple={false}
    />
  );
}
```

### 2. 多人签名模式（默认）

```tsx
import { SignatureManager } from '@/components/common';
import { useState } from 'react';

function MyComponent() {
  const [signatures, setSignatures] = useState<string[]>([]);

  return (
    <SignatureManager
      value={signatures}
      onChange={(value) => setSignatures(value as string[])}
      allowMultiple={true}
    />
  );
}
```

### 3. 使用 Hook

```tsx
import { useSignature } from '@/hooks';
import { SignatureManager } from '@/components/common';

function MyComponent() {
  const { signatures, addSignature, removeSignature, clearSignatures } = useSignature(true);

  return (
    <div>
      <SignatureManager
        value={signatures}
        onChange={(value) => {
          // 手动管理签名
          if (Array.isArray(value)) {
            // 处理数组
          } else {
            // 处理单个签名
          }
        }}
      />
      <button onClick={clearSignatures}>清空所有签名</button>
    </div>
  );
}
```

## Props 说明

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | `string \| string[]` | - | 当前签名值（字符串或数组） |
| `onChange` | `(value: string \| string[]) => void` | - | 签名变化回调 |
| `readonly` | `boolean` | `false` | 是否只读模式 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `maxWidth` | `number` | `200` | 最大显示宽度（px） |
| `maxHeight` | `number` | `100` | 最大显示高度（px） |
| `canvasWidth` | `number` | `600` | 签名画布宽度（px） |
| `canvasHeight` | `number` | `300` | 签名画布高度（px） |
| `className` | `string` | `''` | 自定义类名 |
| `allowMultiple` | `boolean` | `true` | 是否支持多人签名 |
| `showRemoveButton` | `boolean` | `true` | 是否显示删除按钮 |

## 功能特性

1. **自动裁剪和缩放**：保存时自动裁剪空白区域并缩放50%
2. **多人签名支持**：支持添加多个签名，每个签名独立管理
3. **数据兼容**：自动兼容旧数据格式（字符串自动转换为数组）
4. **响应式设计**：支持桌面端和移动端
5. **类型安全**：完整的 TypeScript 类型定义

## 在表单中使用

```tsx
import { SignatureManager } from '@/components/common';
import { useForm } from 'react-hook-form';

function MyForm() {
  const { register, handleSubmit, watch, setValue } = useForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>签名</label>
        <SignatureManager
          value={watch('signature')}
          onChange={(value) => setValue('signature', value)}
        />
      </div>
      <button type="submit">提交</button>
    </form>
  );
}
```

## 在表格中使用

```tsx
import { SignatureManager } from '@/components/common';

function SignatureCell({ value, onChange, readonly }) {
  return (
    <div style={{ width: '200px', height: '100px' }}>
      <SignatureManager
        value={value}
        onChange={onChange}
        readonly={readonly}
        maxWidth={200}
        maxHeight={100}
      />
    </div>
  );
}
```

## 数据格式

### 单个签名
```typescript
const signature: string = 'base64字符串...';
```

### 多人签名
```typescript
const signatures: string[] = [
  'base64字符串1...',
  'base64字符串2...',
  'base64字符串3...'
];
```

## 注意事项

1. 签名数据以 base64 格式存储（不包含 data URL 前缀）
2. 保存时会自动裁剪空白区域并缩放50%
3. 多人签名模式下，签名按添加顺序排列
4. 删除签名时，如果删除后数组为空，会返回空字符串或空数组（取决于 `allowMultiple` 设置）





