# Docker Desktop 修复指南

## 当前问题

Docker Desktop 返回 500 错误，无法拉取镜像或执行 Docker 命令。

## 快速修复步骤

### 方法 1: 重启 Docker Desktop（最简单）

1. **完全退出 Docker Desktop**
   - 右键点击系统托盘中的 Docker 图标
   - 选择 "Quit Docker Desktop"
   - 等待完全退出（图标消失）

2. **重新启动 Docker Desktop**
   - 从开始菜单启动 Docker Desktop
   - 等待完全启动（系统托盘图标不再闪烁）

3. **验证 Docker 状态**
   ```bash
   docker ps
   ```

### 方法 2: 重置 Docker Desktop

如果重启无效：

1. **打开 Docker Desktop 设置**
   - 右键系统托盘图标 → Settings

2. **重置到出厂设置**
   - 进入 "Troubleshoot" 标签
   - 点击 "Reset to factory defaults"
   - 确认重置

3. **重新启动 Docker Desktop**

### 方法 3: 检查 WSL2（Windows）

Docker Desktop 在 Windows 上依赖 WSL2：

1. **检查 WSL2 状态**
   ```powershell
   wsl --status
   ```

2. **更新 WSL2**
   ```powershell
   wsl --update
   ```

3. **重启 WSL2**
   ```powershell
   wsl --shutdown
   ```

4. **重新启动 Docker Desktop**

### 方法 4: 重新安装 Docker Desktop

如果以上方法都无效：

1. **卸载 Docker Desktop**
   - 控制面板 → 程序和功能 → 卸载 Docker Desktop

2. **清理残留文件**
   ```powershell
   # 删除 Docker 数据（可选，会删除所有容器和镜像）
   Remove-Item -Recurse -Force "$env:USERPROFILE\.docker"
   ```

3. **重新下载并安装**
   - 访问: https://www.docker.com/products/docker-desktop
   - 下载最新版本
   - 安装并重启

## 临时解决方案：使用本地 MinIO

如果 Docker 暂时无法修复，可以使用本地安装的 MinIO：

### Windows

1. **安装 MinIO**
   ```powershell
   .\install-minio-windows.ps1
   ```

2. **启动 MinIO**
   ```cmd
   .\start-minio-local.bat
   ```

### Linux/Mac

1. **安装 MinIO**
   ```bash
   # Linux
   wget https://dl.min.io/server/minio/release/linux-amd64/minio
   chmod +x minio
   sudo mv minio /usr/local/bin/
   
   # Mac
   brew install minio/stable/minio
   ```

2. **启动 MinIO**
   ```bash
   chmod +x start-minio-local.sh
   ./start-minio-local.sh
   ```

## 验证修复

修复后，验证 Docker 是否正常工作：

```bash
# 1. 检查 Docker 状态
docker ps

# 2. 测试拉取镜像
docker pull hello-world

# 3. 运行测试容器
docker run hello-world

# 4. 启动 MinIO
docker-compose -f docker-compose.minio.yml up -d
```

## 常见错误及解决方案

### 错误: "request returned 500 Internal Server Error"

**原因**: Docker 引擎未正常启动

**解决**:
1. 重启 Docker Desktop
2. 检查 WSL2（Windows）
3. 重置 Docker Desktop

### 错误: "unable to get image"

**原因**: 网络问题或 Docker Hub 连接问题

**解决**:
1. 检查网络连接
2. 配置 Docker 镜像加速器（国内用户）
3. 使用代理

### 错误: "API version mismatch"

**原因**: Docker Client 和 Server 版本不兼容

**解决**:
1. 更新 Docker Desktop 到最新版本
2. 确保 Client 和 Server 版本匹配

## 配置 Docker 镜像加速器（可选）

如果网络较慢，可以配置国内镜像源：

1. **打开 Docker Desktop 设置**
2. **进入 "Docker Engine"**
3. **添加镜像加速器配置**:
   ```json
   {
     "registry-mirrors": [
       "https://docker.mirrors.ustc.edu.cn",
       "https://hub-mirror.c.163.com"
     ]
   }
   ```
4. **应用并重启**

## 联系支持

如果问题仍然存在：

1. 查看 Docker Desktop 日志
   - Settings → Troubleshoot → View logs
2. 访问 Docker 社区论坛
3. 提交 GitHub Issue

## 下一步

Docker 修复后：

1. ✅ 启动 MinIO: `docker-compose -f docker-compose.minio.yml up -d`
2. ✅ 验证连接: `node scripts/test-minio.js`
3. ✅ 启动应用: `npm run dev`

