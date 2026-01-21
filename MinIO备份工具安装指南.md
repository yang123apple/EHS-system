# MinIO 备份工具安装指南

## 问题说明

MinIO 同步备份脚本需要 MinIO Client (mc) 工具才能运行。该脚本会自动检测您的系统环境并提供相应的安装指导。

## 自动安装（推荐 - macOS）

如果您使用 macOS 并安装了 Homebrew，脚本会自动尝试安装 MinIO Client：

```bash
# 脚本会自动执行
brew install minio/stable/mc
```

## 手动安装

### macOS

**方法 1：使用 Homebrew（推荐）**
```bash
brew install minio/stable/mc
```

**方法 2：手动下载**
```bash
# Apple Silicon (M1/M2/M3)
curl -O https://dl.min.io/client/mc/release/darwin-arm64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Intel 芯片
curl -O https://dl.min.io/client/mc/release/darwin-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

### Linux

```bash
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/
```

### Windows

1. 下载：https://dl.min.io/client/mc/release/windows-amd64/mc.exe
2. 将 mc.exe 放到一个目录（如 C:\MinIO）
3. 将该目录添加到系统 PATH 环境变量

## 验证安装

安装完成后，运行以下命令验证：

```bash
mc --version
```

应该看到类似输出：
```
mc version RELEASE.2024-01-xx...
```

## 使用 Docker 替代方案（不推荐用于定时备份）

如果不想安装 mc，也可以使用 Docker：

```bash
# 启动 MinIO Client 容器（仅用于测试）
docker run -it --rm minio/mc --help
```

但是对于定时备份任务，**强烈推荐直接安装 mc**，因为：
- 更快的启动速度
- 更低的资源占用
- 更简单的配置

## 故障排查

### 检查 Homebrew 是否安装（macOS）

```bash
brew --version
```

如果未安装，执行：
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 检查 PATH 环境变量

```bash
echo $PATH
```

确保 `/usr/local/bin` 在 PATH 中。

### 检查 mc 命令位置

```bash
which mc
```

应该输出：`/usr/local/bin/mc` 或类似路径

## 配置 MinIO 连接

安装 mc 后，脚本会自动配置连接。您也可以手动配置：

```bash
mc alias set minio-primary http://localhost:9000 admin your-password
mc admin info minio-primary
```

## 运行备份

安装完成后，可以手动测试备份：

```bash
# 增量备份
bash scripts/sync-minio.sh incremental

# 全量备份
bash scripts/sync-minio.sh full
```

## 常见问题

### Q: 为什么不直接使用 Node.js 代码备份？

A: MinIO Client (mc) 的优势：
- **性能**：C++ 实现，比 Node.js 快 10-100 倍
- **内存**：流式传输，不会将整个文件加载到内存
- **增量**：自动检测文件变化，只传输变化部分
- **断点续传**：支持大文件传输中断后继续
- **解耦**：独立进程，不阻塞 Node.js Event Loop

### Q: 自动安装失败怎么办？

A: 按照上面的手动安装步骤操作，或查看脚本输出的详细安装指南。

### Q: 我可以禁用 MinIO 备份吗？

A: 可以，在备份调度服务中注释相关代码即可。但建议保留数据备份功能。

## 更多信息

- MinIO Client 官方文档：https://min.io/docs/minio/linux/reference/minio-mc.html
- Homebrew 官网：https://brew.sh/
