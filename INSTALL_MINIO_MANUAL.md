# MinIO 手动安装指南

由于 Docker 网络问题无法拉取镜像，建议使用本地安装的 MinIO。

## Windows 安装步骤

### 方法 1: 直接下载（推荐）

1. **下载 MinIO**
   - 访问: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
   - 或使用命令行:
     ```powershell
     Invoke-WebRequest -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile "bin\minio.exe"
     ```

2. **创建目录**
   ```cmd
   mkdir bin
   ```
   将下载的 `minio.exe` 放到 `bin` 文件夹

3. **启动 MinIO**
   ```cmd
   .\start-minio-local.bat
   ```

### 方法 2: 使用 Chocolatey

```powershell
choco install minio -y
```

然后直接运行:
```cmd
start-minio-local.bat
```

## 启动 MinIO

运行启动脚本:
```cmd
.\start-minio-local.bat
```

MinIO 将启动在:
- **API 端点**: http://localhost:9000
- **Console**: http://localhost:9001
- **用户名**: admin
- **密码**: change-me-now

## 验证安装

1. **检查服务**
   - 打开浏览器访问: http://localhost:9001
   - 使用 admin/change-me-now 登录

2. **测试 API**
   ```bash
   curl http://localhost:9000/minio/health/live
   ```

3. **测试 Node.js 连接**
   ```bash
   node scripts/test-minio.js
   ```

## 配置说明

MinIO 的配置在 `.env.local` 文件中，已经配置好了：
- `MINIO_ENDPOINT=localhost`
- `MINIO_PORT=9000`
- `MINIO_ACCESS_KEY=admin`
- `MINIO_SECRET_KEY=change-me-now`

## 下一步

MinIO 启动后：

1. ✅ 启动应用: `npm run dev`
2. ✅ 查看控制台输出，确认 MinIO 初始化成功
3. ✅ 访问: http://localhost:3000/api/storage/status

## 故障排查

### 问题: 端口被占用

**解决**: 修改 `start-minio-local.bat` 中的端口号

### 问题: 无法访问 Console

**检查**:
1. MinIO 是否正在运行
2. 防火墙是否阻止端口 9001
3. 浏览器控制台是否有错误

### 问题: 连接失败

**检查**:
1. `.env.local` 配置是否正确
2. MinIO 是否正在运行
3. 端口是否正确

