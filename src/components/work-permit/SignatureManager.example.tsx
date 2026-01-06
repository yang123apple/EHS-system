/**
 * 手写签名组件使用示例
 * 
 * 这个文件展示了如何在现有代码中使用新的公共 SignatureManager 组件
 */

import { SignatureManager } from '@/components/common';
import { useState } from 'react';

// ========== 示例 1: 在表单中使用 ==========
export function FormSignatureExample() {
  const [signature, setSignature] = useState<string>('');

  return (
    <div>
      <label>签名</label>
      <SignatureManager
        value={signature}
        onChange={(value) => setSignature(value as string)}
        allowMultiple={false}
      />
    </div>
  );
}

// ========== 示例 2: 多人签名 ==========
export function MultiSignatureExample() {
  const [signatures, setSignatures] = useState<string[]>([]);

  return (
    <div>
      <label>多人签名</label>
      <SignatureManager
        value={signatures}
        onChange={(value) => setSignatures(value as string[])}
        allowMultiple={true}
        maxWidth={300}
        maxHeight={200}
      />
    </div>
  );
}

// ========== 示例 3: 只读模式 ==========
export function ReadonlySignatureExample({ signatures }: { signatures: string[] }) {
  return (
    <div>
      <label>签名（只读）</label>
      <SignatureManager
        value={signatures}
        onChange={() => {}}
        readonly={true}
      />
    </div>
  );
}

// ========== 示例 4: 在表格单元格中使用 ==========
export function TableCellSignatureExample({ 
  value, 
  onChange, 
  readonly 
}: { 
  value: string | string[];
  onChange?: (value: string | string[]) => void;
  readonly?: boolean;
}) {
  return (
    <div style={{ width: '200px', height: '100px', padding: '8px' }}>
      <SignatureManager
        value={value}
        onChange={onChange || (() => {})}
        readonly={readonly}
        maxWidth={200}
        maxHeight={100}
        canvasWidth={400}
        canvasHeight={200}
      />
    </div>
  );
}

// ========== 示例 5: 使用 Hook ==========
import { useSignature } from '@/hooks';

export function HookSignatureExample() {
  const { signatures, addSignature, removeSignature, clearSignatures, hasSignatures } = useSignature(true);

  return (
    <div>
      <SignatureManager
        value={signatures}
        onChange={(value) => {
          // 可以在这里处理签名变化
          console.log('签名变化:', value);
        }}
      />
      <div style={{ marginTop: '16px' }}>
        <button onClick={clearSignatures} disabled={!hasSignatures}>
          清空所有签名
        </button>
        <p>当前有 {signatures.length} 个签名</p>
      </div>
    </div>
  );
}






