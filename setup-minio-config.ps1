# MinIO 配置设置脚本 (PowerShell)
# 自动创建 .env.local 文件并配置 MinIO

Write-Host "========================================"
Write-Host "MinIO 配置设置"
Write-Host "========================================"
Write-Host ""

# 检查 .env.local 是否已存在
if (Test-Path .env.local) {
    Write-Host "⚠️  .env.local 文件已存在"
    $overwrite = Read-Host "是否覆盖现有配置? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "已取消操作"
        exit 0
    }
}

# 读取配置
Write-Host "请输入 MinIO 配置（直接回车使用默认值）:"
Write-Host ""

$endpoint = Read-Host "MinIO 端点 [localhost]"
if ([string]::IsNullOrWhiteSpace($endpoint)) { $endpoint = "localhost" }

$port = Read-Host "MinIO 端口 [9000]"
if ([string]::IsNullOrWhiteSpace($port)) { $port = "9000" }

$useSSL = Read-Host "使用 SSL? (y/N) [N]"
$useSSLValue = if ($useSSL -eq "y" -or $useSSL -eq "Y") { "true" } else { "false" }

$accessKey = Read-Host "访问密钥 (Access Key) [admin]"
if ([string]::IsNullOrWhiteSpace($accessKey)) { $accessKey = "admin" }

$secretKey = Read-Host "密钥 (Secret Key) [change-me-now]"
if ([string]::IsNullOrWhiteSpace($secretKey)) { $secretKey = "change-me-now" }

# 生成配置文件内容
$configContent = @"
# MinIO 对象存储配置
# 自动生成于 $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# MinIO 服务器端点
MINIO_ENDPOINT=$endpoint
MINIO_PORT=$port
MINIO_USE_SSL=$useSSLValue

# MinIO 访问凭证
MINIO_ACCESS_KEY=$accessKey
MINIO_SECRET_KEY=$secretKey

# MinIO Root 用户（用于 Docker Compose）
MINIO_ROOT_USER=$accessKey
MINIO_ROOT_PASSWORD=$secretKey

# 备份配置（可选）
MINIO_PRIMARY_ENDPOINT=http://${endpoint}:${port}
MINIO_PRIMARY_ACCESS_KEY=$accessKey
MINIO_PRIMARY_SECRET_KEY=$secretKey
MINIO_BACKUP_TARGET=./data/minio-backup
"@

# 写入文件
try {
    $configContent | Out-File -FilePath .env.local -Encoding utf8 -NoNewline
    Write-Host ""
    Write-Host "✅ .env.local 文件已创建"
    Write-Host ""
    Write-Host "配置摘要:"
    Write-Host "  端点: ${endpoint}:${port}"
    Write-Host "  SSL: $useSSLValue"
    Write-Host "  访问密钥: $accessKey"
    Write-Host ""
    Write-Host "下一步:"
    Write-Host "  1. 启动 MinIO: docker-compose -f docker-compose.minio.yml up -d"
    Write-Host "  2. 测试连接: node scripts/test-minio.js"
    Write-Host "  3. 启动应用: npm run dev"
} catch {
    Write-Host "❌ 创建配置文件失败: $_" -ForegroundColor Red
    exit 1
}

