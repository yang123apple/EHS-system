# 公共组件库

## SignatureManager - 手写签名管理器

### 简介

`SignatureManager` 是一个统一的手写签名管理组件，提供了完整的签名输入、显示和管理功能。支持单个签名和多人签名两种模式。

### 快速开始

```tsx
import { SignatureManager } from '@/components/common';

function MyComponent() {
  const [signature, setSignature] = useState<string>('');

  return (
    <SignatureManager
      value={signature}
      onChange={(value) => setSignature(value as string)}
    />
  );
}
```

### 主要特性

- ✅ **自动裁剪和缩放**：保存时自动裁剪空白区域并缩放50%
- ✅ **多人签名支持**：支持添加多个签名，每个签名独立管理
- ✅ **数据兼容**：自动兼容旧数据格式（字符串自动转换为数组）
- ✅ **响应式设计**：支持桌面端和移动端
- ✅ **类型安全**：完整的 TypeScript 类型定义
- ✅ **易于集成**：简单的 API，易于在其他模块中使用

### API 文档

详细的使用文档请参考：[SignatureManager.example.md](./SignatureManager.example.md)

### 在其他模块中使用

#### 1. 导入组件

```tsx
import { SignatureManager } from '@/components/common';
// 或
import { SignatureManager, type SignatureValue } from '@/components/common';
```

#### 2. 使用 Hook（可选）

```tsx
import { useSignature } from '@/hooks';

const { signatures, addSignature, removeSignature, clearSignatures } = useSignature(true);
```

#### 3. 基本使用

```tsx
<SignatureManager
  value={signatures}
  onChange={(value) => setSignatures(value)}
  allowMultiple={true}
/>
```

### 迁移指南

如果你正在使用现有的 `HandwrittenSignature` 和 `MultiSignatureDisplay` 组件，可以逐步迁移到 `SignatureManager`：

**旧代码：**
```tsx
import HandwrittenSignature from '@/components/work-permit/HandwrittenSignature';
import MultiSignatureDisplay from '@/components/work-permit/MultiSignatureDisplay';
```

**新代码：**
```tsx
import { SignatureManager } from '@/components/common';
```

`SignatureManager` 内部已经集成了 `HandwrittenSignature` 和 `MultiSignatureDisplay` 的功能，使用更加简单。

### 注意事项

1. 签名数据以 base64 格式存储（不包含 data URL 前缀）
2. 保存时会自动裁剪空白区域并缩放50%
3. 多人签名模式下，签名按添加顺序排列
4. 删除签名时，如果删除后数组为空，会返回空字符串或空数组（取决于 `allowMultiple` 设置）





