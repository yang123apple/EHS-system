# MinIO 增量同步备份脚本 (PowerShell 版本)
# Windows 环境下的 MinIO 备份脚本

param(
    [Parameter(Position=0)]
    [ValidateSet("full", "incremental")]
    [string]$Mode = "incremental",
    
    [Parameter(Position=1)]
    [string]$BackupTarget = "$PSScriptRoot\..\data\minio-backup"
)

$ErrorActionPreference = "Stop"

# 配置
$MINIO_ENDPOINT = $env:MINIO_ENDPOINT ?? "localhost"
$MINIO_PORT = $env:MINIO_PORT ?? "9000"
$MINIO_ACCESS_KEY = $env:MINIO_ACCESS_KEY ?? $env:MINIO_ROOT_USER ?? "admin"
$MINIO_SECRET_KEY = $env:MINIO_SECRET_KEY ?? $env:MINIO_ROOT_PASSWORD ?? "change-me-now"
$MINIO_ALIAS = "minio-primary"

# 日志
$LogDir = Join-Path $PSScriptRoot "..\logs"
$LogFile = Join-Path $LogDir "minio-sync-$(Get-Date -Format 'yyyyMMdd').log"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $LogFile -Value $logMessage
    Write-Host $logMessage
}

function Write-LogSuccess {
    param([string]$Message)
    Write-Log $Message "SUCCESS"
    Write-Host $Message -ForegroundColor Green
}

function Write-LogError {
    param([string]$Message)
    Write-Log $Message "ERROR"
    Write-Host $Message -ForegroundColor Red
}

# 检查 mc 命令
function Test-McCommand {
    if (Get-Command mc -ErrorAction SilentlyContinue) {
        $script:MC_CMD = "mc"
        return $true
    }
    
    # 检查 Docker 容器
    $mcContainer = docker ps --filter "name=ehs-mc" --format "{{.Names}}" 2>$null
    if ($mcContainer) {
        $script:MC_CMD = "docker exec ehs-mc mc"
        Write-Log "使用 Docker 容器中的 mc 命令"
        return $true
    }
    
    Write-LogError "mc 命令未找到。请安装 MinIO Client 或启动 Docker 容器"
    return $false
}

# 配置 MinIO 别名
function Set-McAlias {
    Write-Log "配置 MinIO 别名: $MINIO_ALIAS"
    
    if ($MC_CMD -eq "mc") {
        $endpoint = "http://${MINIO_ENDPOINT}:${MINIO_PORT}"
        & mc alias set $MINIO_ALIAS $endpoint $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "配置 MinIO 别名失败"
            return $false
        }
    } else {
        Write-Log "使用 Docker 容器环境变量配置"
        $script:MINIO_ALIAS = "minio"
    }
    
    Write-LogSuccess "MinIO 别名配置完成"
    return $true
}

# 测试连接
function Test-MinIOConnection {
    Write-Log "测试 MinIO 连接..."
    
    if ($MC_CMD -eq "mc") {
        & mc admin info $MINIO_ALIAS 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "无法连接到 MinIO 服务器"
            return $false
        }
    } else {
        docker exec ehs-mc mc admin info minio 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "无法连接到 MinIO 服务器"
            return $false
        }
        $script:MINIO_ALIAS = "minio"
    }
    
    Write-LogSuccess "MinIO 连接测试成功"
    return $true
}

# 执行同步
function Start-Sync {
    param([string]$SyncMode)
    
    Write-Log "=========================================="
    Write-Log "开始${SyncMode}同步备份"
    Write-Log "=========================================="
    Write-Log "源: $MINIO_ALIAS"
    Write-Log "目标: $BackupTarget"
    Write-Log ""
    
    New-Item -ItemType Directory -Force -Path $BackupTarget | Out-Null
    
    $buckets = @("ehs-private", "ehs-public")
    
    foreach ($bucket in $buckets) {
        Write-Log "同步 Bucket: $bucket"
        
        $bucketBackupDir = Join-Path $BackupTarget $bucket
        New-Item -ItemType Directory -Force -Path $bucketBackupDir | Out-Null
        
        if ($MC_CMD -eq "mc") {
            & mc mirror --overwrite "$MINIO_ALIAS/$bucket" $bucketBackupDir 2>&1 | Tee-Object -FilePath $LogFile -Append
        } else {
            docker exec ehs-mc mc mirror --overwrite "minio/$bucket" "/backup/$bucket" 2>&1 | Tee-Object -FilePath $LogFile -Append
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-LogSuccess "Bucket $bucket 同步完成"
        } else {
            Write-LogError "Bucket $bucket 同步失败"
            return $false
        }
    }
    
    Write-LogSuccess "${SyncMode}同步完成"
    return $true
}

# 主函数
function Main {
    Write-Log "=========================================="
    Write-Log "MinIO 同步备份脚本"
    Write-Log "=========================================="
    Write-Log "模式: $Mode"
    Write-Log "目标: $BackupTarget"
    Write-Log ""
    
    if (-not (Test-McCommand)) {
        exit 1
    }
    
    if ($MC_CMD -eq "mc") {
        if (-not (Set-McAlias)) {
            exit 1
        }
    }
    
    if (-not (Test-MinIOConnection)) {
        exit 1
    }
    
    $startTime = Get-Date
    
    if ($Mode -eq "full") {
        $success = Start-Sync "全量"
    } else {
        $success = Start-Sync "增量"
    }
    
    $endTime = Get-Date
    $duration = ($endTime - $startTime).TotalSeconds
    
    if ($success) {
        Write-LogSuccess "同步完成，耗时: $([math]::Round($duration, 2)) 秒"
    } else {
        Write-LogError "同步失败，耗时: $([math]::Round($duration, 2)) 秒"
        exit 1
    }
}

Main

