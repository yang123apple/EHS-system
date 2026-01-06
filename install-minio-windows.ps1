# MinIO Windows 安装脚本
# 使用 Chocolatey 或直接下载

Write-Host "========================================"
Write-Host "MinIO Windows 安装"
Write-Host "========================================"
Write-Host ""

# 检查 Chocolatey
$useChoco = $false
if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "检测到 Chocolatey，使用 Chocolatey 安装..."
    $useChoco = $true
} else {
    Write-Host "未检测到 Chocolatey，将直接下载..."
    Write-Host ""
    Write-Host "提示: 安装 Chocolatey 可以简化安装过程"
    Write-Host "  安装命令: Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
    Write-Host ""
}

if ($useChoco) {
    Write-Host "使用 Chocolatey 安装 MinIO..."
    choco install minio -y
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ MinIO 安装成功"
        exit 0
    } else {
        Write-Host "❌ Chocolatey 安装失败，尝试直接下载..."
        $useChoco = $false
    }
}

if (-not $useChoco) {
    Write-Host "直接下载 MinIO..."
    
    $minioUrl = "https://dl.min.io/server/minio/release/windows-amd64/minio.exe"
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $minioDir = Join-Path $scriptDir "bin"
    
    # 创建 bin 目录
    if (-not (Test-Path $minioDir)) {
        New-Item -ItemType Directory -Path $minioDir | Out-Null
    }
    
    $minioPath = Join-Path $minioDir "minio.exe"
    
    try {
        Write-Host "正在下载 MinIO..."
        Invoke-WebRequest -Uri $minioUrl -OutFile $minioPath -UseBasicParsing
        Write-Host "✅ MinIO 下载成功: $minioPath"
        Write-Host ""
        Write-Host "提示: 将以下路径添加到系统 PATH，或使用完整路径运行:"
        Write-Host "  $minioPath"
    } catch {
        Write-Host "❌ 下载失败: $_"
        Write-Host ""
        Write-Host "请手动下载:"
        Write-Host "  1. 访问: $minioUrl"
        Write-Host "  2. 下载 minio.exe"
        Write-Host "  3. 放到项目目录的 bin 文件夹"
        exit 1
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "安装完成"
Write-Host "========================================"
Write-Host ""
Write-Host "下一步:"
Write-Host "  1. 运行: .\start-minio-local.bat"
Write-Host "  2. 或使用 Docker（如果 Docker 修复后）"
Write-Host ""
