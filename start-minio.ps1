# MinIO 本地启动脚本
# 使用本地 minio.exe 运行 MinIO 服务

# 设置脚本所在目录为工作目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath

# MinIO 配置
$env:MINIO_ROOT_USER = "admin"
$env:MINIO_ROOT_PASSWORD = "change-me-now"

# 数据目录（与 docker-compose 配置保持一致）
$dataPath = ".\data\minio-data"

# 确保数据目录存在
if (-not (Test-Path $dataPath)) {
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
    Write-Host "[INFO] 已创建数据目录: $dataPath" -ForegroundColor Green
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "        MinIO 本地服务启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Root User: $env:MINIO_ROOT_USER" -ForegroundColor Yellow
Write-Host "[INFO] API 端口: 9000" -ForegroundColor Yellow
Write-Host "[INFO] Console 端口: 9001" -ForegroundColor Yellow
Write-Host "[INFO] 数据目录: $dataPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "[INFO] MinIO Console 访问地址: http://localhost:9001" -ForegroundColor Green
Write-Host "[INFO] MinIO API 地址: http://localhost:9000" -ForegroundColor Green
Write-Host ""
Write-Host "按 Ctrl+C 停止服务" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 启动 MinIO
& ".\bin\minio.exe" server $dataPath --console-address ":9001"
