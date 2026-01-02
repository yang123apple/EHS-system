# 数据保护 API 文档

## 概述

提供完整的备份管理 API，包括列表查询、状态获取、手动备份、文件验证和下载功能。

**基础路径**: `/api/data-protection`

---

## API 端点

### 1. 获取备份列表

**端点**: `GET /api/data-protection`

**描述**: 返回所有 ZIP 备份文件的列表

**请求示例**:
```bash
curl http://localhost:3000/api/data-protection
```

**响应示例**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "filename": "full_backup_2026-01-02_12-21-42.zip",
      "filepath": "/path/to/data/backups/full_backup_2026-01-02_12-21-42.zip",
      "sizeBytes": 18123456,
      "sizeMB": 17.29,
      "createdAt": "2026-01-02T12:21:42.000Z",
      "age": "2 小时前"
    },
    {
      "filename": "full_backup_2026-01-01_10-00-00.zip",
      "sizeBytes": 17856234,
      "sizeMB": 17.02,
      "createdAt": "2026-01-01T10:00:00.000Z",
      "age": "1 天前"
    }
  ]
}
```

---

### 2. 获取备份状态

**端点**: `GET /api/data-protection?action=status`

**描述**: 获取备份统计信息和数据库状态

**请求示例**:
```bash
curl "http://localhost:3000/api/data-protection?action=status"
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "backupCount": 5,
    "totalSizeMB": 86.45,
    "latestBackup": {
      "filename": "full_backup_2026-01-02_12-21-42.zip",
      "sizeMB": 17.29,
      "createdAt": "2026-01-02T12:21:42.000Z",
      "age": "2 小时前"
    },
    "oldestBackup": {
      "filename": "full_backup_2025-12-20_02-00-00.zip",
      "sizeMB": 15.82,
      "createdAt": "2025-12-20T02:00:00.000Z",
      "age": "13 天前"
    },
    "databaseStatus": {
      "departments": 15,
      "users": 42,
      "hazards": 123,
      "trainings": 8
    }
  }
}
```

---

### 3. 手动触发备份

**端点**: `POST /api/data-protection`

**描述**: 立即执行全量备份

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/data-protection \
  -H "Content-Type: application/json"
```

**响应示例**:
```json
{
  "success": true,
  "message": "全量备份成功",
  "backupFile": "full_backup_2026-01-02_14-30-00.zip",
  "timestamp": "2026-01-02T14:30:00.000Z"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "备份失败: 磁盘空间不足"
}
```

---

### 4. 验证备份文件

**端点**: `POST /api/data-protection/verify`

**描述**: 验证指定备份文件的有效性

**请求体**:
```json
{
  "filename": "full_backup_2026-01-02_12-21-42.zip"
}
```

**请求示例**:
```bash
curl -X POST http://localhost:3000/api/data-protection/verify \
  -H "Content-Type: application/json" \
  -d '{"filename":"full_backup_2026-01-02_12-21-42.zip"}'
```

**响应示例（有效文件）**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "备份文件有效",
    "details": {
      "exists": true,
      "sizeBytes": 18123456,
      "sizeMB": 17.29,
      "createdAt": "2026-01-02T12:21:42.000Z"
    }
  }
}
```

**响应示例（无效文件）**:
```json
{
  "success": true,
  "data": {
    "valid": false,
    "message": "备份文件不存在",
    "details": {
      "exists": false,
      "sizeBytes": 0,
      "sizeMB": 0
    }
  }
}
```

---

### 5. 下载备份文件

**端点**: `GET /api/data-protection/download?filename={filename}`

**描述**: 下载指定的备份文件

**查询参数**:
- `filename` (必需): 备份文件名，如 `full_backup_2026-01-02_12-21-42.zip`

**请求示例**:
```bash
# 使用浏览器访问
http://localhost:3000/api/data-protection/download?filename=full_backup_2026-01-02_12-21-42.zip

# 使用 curl 下载
curl -O "http://localhost:3000/api/data-protection/download?filename=full_backup_2026-01-02_12-21-42.zip"

# 使用 wget 下载
wget "http://localhost:3000/api/data-protection/download?filename=full_backup_2026-01-02_12-21-42.zip"
```

**响应头**:
```
Content-Type: application/zip
Content-Disposition: attachment; filename="full_backup_2026-01-02_12-21-42.zip"
Content-Length: 18123456
X-File-Size: 18123456
X-File-Modified: 2026-01-02T12:21:42.000Z
X-Content-Type-Options: nosniff
X-Download-Options: noopen
```

**错误响应**:
```json
{
  "success": false,
  "error": "备份文件不存在"
}
```

**安全特性**:
- ✅ 路径遍历攻击防护
- ✅ 文件名格式验证
- ✅ 目录限制（仅 `data/backups/`）
- ✅ 文件类型限制（仅 `.zip`）
- ✅ 符号链接攻击防护

---

## 安全措施

### 路径遍历防护

API 实现了多层安全检查：

1. **文件名验证**: 不允许包含 `..`, `/`, `\` 等路径字符
2. **格式检查**: 必须以 `full_backup_` 开头且以 `.zip` 结尾
3. **路径规范化**: 使用 `fs.realpathSync()` 检查真实路径
4. **目录限制**: 确保文件路径在 `data/backups/` 目录内

**被拦截的攻击示例**:
```bash
# 尝试访问系统文件
GET /api/data-protection/download?filename=../../../etc/passwd
# 响应: 400 Bad Request - "无效的文件名"

# 尝试访问其他目录
GET /api/data-protection/download?filename=full_backup_../../secret.txt
# 响应: 400 Bad Request - "无效的文件名"
```

---

## 错误代码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误（无效的文件名、缺少参数等） |
| 403 | 禁止访问（路径遍历尝试、权限不足） |
| 404 | 文件不存在 |
| 500 | 服务器内部错误 |

---

## 使用示例

### JavaScript/Fetch API

```javascript
// 1. 获取备份列表
const response = await fetch('/api/data-protection');
const { data: backups } = await response.json();

// 2. 执行手动备份
const backupResponse = await fetch('/api/data-protection', {
  method: 'POST',
});
const result = await backupResponse.json();

// 3. 验证备份
const verifyResponse = await fetch('/api/data-protection/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: 'full_backup_2026-01-02_12-21-42.zip' }),
});
const verification = await verifyResponse.json();

// 4. 下载备份
window.location.href = '/api/data-protection/download?filename=full_backup_2026-01-02_12-21-42.zip';
```

### React 组件示例

```typescript
import { useState, useEffect } from 'react';

function BackupManager() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);

  // 加载备份列表
  const loadBackups = async () => {
    const response = await fetch('/api/data-protection');
    const { data } = await response.json();
    setBackups(data);
  };

  // 执行备份
  const handleBackup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data-protection', {
        method: 'POST',
      });
      const result = await response.json();
      
      if (result.success) {
        alert('备份成功: ' + result.backupFile);
        loadBackups(); // 重新加载列表
      }
    } finally {
      setLoading(false);
    }
  };

  // 下载备份
  const handleDownload = (filename) => {
    window.location.href = `/api/data-protection/download?filename=${encodeURIComponent(filename)}`;
  };

  useEffect(() => {
    loadBackups();
  }, []);

  return (
    <div>
      <button onClick={handleBackup} disabled={loading}>
        {loading ? '备份中...' : '立即备份'}
      </button>
      
      <ul>
        {backups.map(backup => (
          <li key={backup.filename}>
            {backup.filename} ({backup.sizeMB} MB)
            <button onClick={() => handleDownload(backup.filename)}>
              下载
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 测试

### 运行自动化测试

```bash
# 确保开发服务器正在运行
npm run dev

# 在另一个终端运行测试
npm run test:backup-api

# 测试手动备份功能（会创建新备份）
npm run test:backup-api -- --with-backup
```

### 测试输出示例

```
🧪 测试数据保护 API
========================================

📋 测试 1: GET /api/data-protection
----------------------------------------
状态: 200
成功: true
备份数量: 2

备份文件:
  1. full_backup_2026-01-02_12-21-42.zip
     大小: 17.29 MB
     时间: 2 小时前

📊 测试 2: GET /api/data-protection?action=status
----------------------------------------
状态: 200
成功: true

统计信息:
  - 备份数量: 2
  - 总大小: 34.31 MB
  - 最新备份: full_backup_2026-01-02_12-21-42.zip

🔍 测试 3: POST /api/data-protection/verify
----------------------------------------
状态: 200
成功: true

验证结果:
  - 有效: ✅
  - 消息: 备份文件有效
  - 文件存在: 是
  - 文件大小: 17.29 MB

📦 测试 4: GET /api/data-protection/download
----------------------------------------
下载 URL: http://localhost:3000/api/data-protection/download?filename=full_backup_2026-01-02_12-21-42.zip
状态: 200
Content-Type: application/zip
Content-Length: 18123456
✅ 文件可以下载

🔐 测试 5: 安全性测试（路径遍历攻击）
----------------------------------------
尝试: ../../../etc/passwd
状态: 400
被拦截: ✅

✅ 所有测试完成！
```

---

## 性能考虑

### 下载性能
- 使用文件流而非一次性加载到内存
- 适合大文件下载（推荐 < 500 MB）
- 支持断点续传（取决于客户端）

### 备份性能
- 全量备份通常耗时 3-10 秒
- 建议在低峰期执行
- 自动备份默认每天凌晨 2 点执行

---

## 常见问题

### Q: 如何在前端显示下载进度？

使用 `XMLHttpRequest` 或 `fetch` 的 `ReadableStream`:

```javascript
async function downloadWithProgress(filename) {
  const response = await fetch(`/api/data-protection/download?filename=${filename}`);
  const reader = response.body.getReader();
  const contentLength = +response.headers.get('Content-Length');
  
  let receivedLength = 0;
  const chunks = [];
  
  while(true) {
    const {done, value} = await reader.read();
    if (done) break;
    
    chunks.push(value);
    receivedLength += value.length;
    
    const progress = (receivedLength / contentLength) * 100;
    console.log(`下载进度: ${progress.toFixed(2)}%`);
  }
  
  const blob = new Blob(chunks);
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}
```

### Q: 如何限制下载权限？

在 API 中添加身份验证：

```typescript
// download/route.ts
import { getServerSession } from 'next-auth';

export async function GET(request: NextRequest) {
  // 检查用户权限
  const session = await getServerSession();
  
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: '权限不足' },
      { status: 403 }
    );
  }
  
  // ... 其余代码
}
```

### Q: 下载速度慢怎么办？

可以使用 CDN 或对象存储：

```typescript
// 将备份上传到 S3/OSS
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function uploadToS3(filePath: string) {
  const s3 = new S3Client({ region: 'us-east-1' });
  const fileStream = fs.createReadStream(filePath);
  
  await s3.send(new PutObjectCommand({
    Bucket: 'my-backups',
    Key: path.basename(filePath),
    Body: fileStream,
  }));
}
```

---

**版本**: v2.0  
**更新日期**: 2026-01-02  
**维护者**: EHS 系统开发团队
