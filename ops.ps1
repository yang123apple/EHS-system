# =============================================================================
# EHS 系统备份与恢复脚本 (Windows PowerShell)
# =============================================================================
# 功能：数据库备份、MinIO文件备份、数据恢复
# 作者：DevOps Team
# 版本：1.0.0
# =============================================================================

# 设置错误处理
$ErrorActionPreference = "Stop"

# =============================================================================
# 配置区域（从环境变量或默认值读取）
# =============================================================================

# 脚本目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# 加载 .env 文件（如果存在）
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# 数据库配置
$DB_PATH = if ($env:DB_PATH) { $env:DB_PATH } else { "prisma\dev.db" }
$DB_DIR = Split-Path -Parent $DB_PATH
$DB_NAME = Split-Path -Leaf $DB_PATH

# MinIO 配置
$MINIO_ENDPOINT = if ($env:MINIO_ENDPOINT) { $env:MINIO_ENDPOINT } else { "localhost" }
$MINIO_PORT = if ($env:MINIO_PORT) { $env:MINIO_PORT } else { "9000" }
$MINIO_ACCESS_KEY = if ($env:MINIO_ACCESS_KEY) { $env:MINIO_ACCESS_KEY } 
                    elseif ($env:MINIO_ROOT_USER) { $env:MINIO_ROOT_USER } 
                    else { "admin" }
$MINIO_SECRET_KEY = if ($env:MINIO_SECRET_KEY) { $env:MINIO_SECRET_KEY }
                    elseif ($env:MINIO_ROOT_PASSWORD) { $env:MINIO_ROOT_PASSWORD }
                    else { "change-me-now" }
$MINIO_ALIAS = "ehs-minio"
$MINIO_BUCKETS = @("ehs-private", "ehs-public")

# 备份配置
$BACKUP_ROOT = if ($env:BACKUP_ROOT) { $env:BACKUP_ROOT } else { "data\backups" }
$BACKUP_DB_DIR = Join-Path $BACKUP_ROOT "database"
$BACKUP_MINIO_DIR = Join-Path $BACKUP_ROOT "minio"
$RETENTION_DAYS = if ($env:RETENTION_DAYS) { [int]$env:RETENTION_DAYS } else { 30 }

# 日志配置
$LOG_FILE = if ($env:LOG_FILE) { $env:LOG_FILE } else { "ops.log" }

# =============================================================================
# 工具函数
# =============================================================================

function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Add-Content -Path $LOG_FILE -Value $logMessage
}

function Write-Info {
    param([string]$Message)
    Write-Log "INFO" $Message
    Write-Host "ℹ $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Log "SUCCESS" $Message
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Log "WARNING" $Message
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Log "ERROR" $Message
    Write-Host "✗ $Message" -ForegroundColor Red
}

# 检查命令是否存在
function Test-Command {
    param([string]$CommandName, [string]$InstallHint)
    
    $command = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $command) {
        Write-Error "命令 '$CommandName' 未找到，请先安装"
        if ($InstallHint) {
            Write-Host "  $InstallHint" -ForegroundColor Yellow
        }
        exit 1
    }
}

# 检查依赖
function Test-Dependencies {
    Write-Info "检查依赖..."
    
    # 检查 sqlite3
    $sqlite3 = Get-Command sqlite3 -ErrorAction SilentlyContinue
    if (-not $sqlite3) {
        Write-Error "sqlite3 未找到，请先安装"
        Write-Host "  安装方法: choco install sqlite  # 使用 Chocolatey" -ForegroundColor Yellow
        Write-Host "   或访问: https://www.sqlite.org/download.html" -ForegroundColor Yellow
        exit 1
    }
    
    # 检查 mc (MinIO Client)
    $mc = Get-Command mc -ErrorAction SilentlyContinue
    if (-not $mc) {
        Write-Error "mc (MinIO Client) 未找到，请先安装"
        Write-Host "  安装方法: choco install minio-client  # 使用 Chocolatey" -ForegroundColor Yellow
        Write-Host "   或访问: https://min.io/download#/windows" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Success "所有依赖已就绪"
}

# 创建备份目录
function Initialize-BackupDirs {
    New-Item -ItemType Directory -Force -Path $BACKUP_DB_DIR | Out-Null
    New-Item -ItemType Directory -Force -Path $BACKUP_MINIO_DIR | Out-Null
    Write-Info "备份目录已就绪: $BACKUP_ROOT"
}

# =============================================================================
# MinIO 配置函数
# =============================================================================

function Set-MinIOAlias {
    Write-Info "配置 MinIO Client alias..."
    
    # 检查 alias 是否已存在
    $existingAlias = mc alias list 2>&1 | Select-String "^$MINIO_ALIAS"
    if ($existingAlias) {
        Write-Info "MinIO alias '$MINIO_ALIAS' 已存在，跳过配置"
        return
    }
    
    # 构建 MinIO 端点 URL
    $minioUrl = "http://${MINIO_ENDPOINT}:${MINIO_PORT}"
    
    # 配置 alias
    try {
        $result = mc alias set $MINIO_ALIAS $minioUrl $MINIO_ACCESS_KEY $MINIO_SECRET_KEY 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "MinIO alias 配置成功"
        } else {
            throw "配置失败"
        }
    } catch {
        Write-Error "MinIO alias 配置失败，请检查服务是否运行"
        Write-Error "启动命令: docker-compose -f docker-compose.minio.yml up -d"
        exit 1
    }
}

# 测试 MinIO 连接
function Test-MinIOConnection {
    Write-Info "测试 MinIO 连接..."
    try {
        $null = mc admin info $MINIO_ALIAS 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "MinIO 连接正常"
            return $true
        } else {
            Write-Error "MinIO 连接失败，请检查服务状态"
            return $false
        }
    } catch {
        Write-Error "MinIO 连接失败: $_"
        return $false
    }
}

# =============================================================================
# 数据库备份函数
# =============================================================================

function Backup-Database {
    Write-Info "开始数据库备份..."
    
    # Pre-check: 数据库完整性检查
    Write-Info "执行数据库完整性检查..."
    $integrityResult = sqlite3 $DB_PATH "PRAGMA integrity_check;" 2>&1
    
    if ($integrityResult -match "ok") {
        Write-Success "数据库完整性检查通过"
    } else {
        Write-Error "数据库完整性检查失败: $integrityResult"
        exit 1
    }
    
    # 生成备份文件名（带时间戳）
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $BACKUP_DB_DIR "${DB_NAME}.backup_${timestamp}"
    $backupWal = "${backupFile}-wal"
    $backupShm = "${backupFile}-shm"
    
    # 执行热备份（不停止服务）
    Write-Info "执行 SQLite 热备份..."
    try {
        $result = sqlite3 $DB_PATH ".backup '$backupFile'" 2>&1
        Add-Content -Path $LOG_FILE -Value $result
        if ($LASTEXITCODE -eq 0) {
            Write-Success "数据库备份完成: $backupFile"
        } else {
            throw "备份失败"
        }
    } catch {
        Write-Error "数据库备份失败: $_"
        exit 1
    }
    
    # 备份 WAL 和 SHM 文件（如果存在）
    $walFile = "${DB_PATH}-wal"
    if (Test-Path $walFile) {
        Copy-Item $walFile $backupWal
        Write-Success "WAL 文件已备份: $backupWal"
    }
    
    $shmFile = "${DB_PATH}-shm"
    if (Test-Path $shmFile) {
        Copy-Item $shmFile $backupShm
        Write-Success "SHM 文件已备份: $backupShm"
    }
    
    # 压缩备份（可选，使用 PowerShell 压缩）
    Write-Info "压缩备份文件..."
    try {
        Compress-Archive -Path $backupFile -DestinationPath "${backupFile}.zip" -Force
        Remove-Item $backupFile -Force
        Write-Success "备份已压缩: ${backupFile}.zip"
        $backupFile = "${backupFile}.zip"
    } catch {
        Write-Warning "压缩失败，保留未压缩备份: $_"
    }
    
    return $backupFile
}

# =============================================================================
# MinIO 备份函数
# =============================================================================

function Backup-MinIO {
    Write-Info "开始 MinIO 文件备份..."
    
    # 配置 MinIO alias
    Set-MinIOAlias
    
    # 测试连接
    if (-not (Test-MinIOConnection)) {
        exit 1
    }
    
    # 备份每个 Bucket
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupBase = Join-Path $BACKUP_MINIO_DIR $timestamp
    New-Item -ItemType Directory -Force -Path $backupBase | Out-Null
    
    foreach ($bucket in $MINIO_BUCKETS) {
        Write-Info "备份 Bucket: $bucket"
        $bucketBackupDir = Join-Path $backupBase $bucket
        New-Item -ItemType Directory -Force -Path $bucketBackupDir | Out-Null
        
        # 使用 mc mirror 进行增量同步
        try {
            $result = mc mirror "${MINIO_ALIAS}/${bucket}" $bucketBackupDir 2>&1
            Add-Content -Path $LOG_FILE -Value $result
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Bucket '$bucket' 备份完成: $bucketBackupDir"
            } else {
                Write-Warning "Bucket '$bucket' 备份可能不完整，请检查日志"
            }
        } catch {
            Write-Warning "Bucket '$bucket' 备份出错: $_"
        }
    }
    
    return $backupBase
}

# =============================================================================
# 清理旧备份
# =============================================================================

function Remove-OldBackups {
    Write-Info "清理 $RETENTION_DAYS 天前的旧备份..."
    
    $cutoffDate = (Get-Date).AddDays(-$RETENTION_DAYS)
    
    # 清理数据库备份
    Get-ChildItem -Path $BACKUP_DB_DIR -File | Where-Object {
        $_.Name -match '\.backup_(\d{8})_\d{6}' -and
        $matches[1] -lt $cutoffDate.ToString("yyyyMMdd")
    } | ForEach-Object {
        Remove-Item $_.FullName -Force
        Remove-Item "${($_.FullName)}-wal" -ErrorAction SilentlyContinue
        Remove-Item "${($_.FullName)}-shm" -ErrorAction SilentlyContinue
        Write-Info "已删除旧备份: $($_.Name)"
    }
    
    # 清理 MinIO 备份
    Get-ChildItem -Path $BACKUP_MINIO_DIR -Directory | Where-Object {
        $_.Name -match '^\d{8}' -and
        $_.Name.Substring(0, 8) -lt $cutoffDate.ToString("yyyyMMdd")
    } | ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force
        Write-Info "已删除旧备份目录: $($_.Name)"
    }
    
    Write-Success "清理完成"
}

# =============================================================================
# 备份主函数
# =============================================================================

function Start-Backup {
    Write-Info "========== 开始备份流程 =========="
    
    # 检查依赖
    Test-Dependencies
    
    # 创建备份目录
    Initialize-BackupDirs
    
    # 备份数据库
    $dbBackup = Backup-Database
    
    # 备份 MinIO
    $minioBackup = Backup-MinIO
    
    # 清理旧备份
    Remove-OldBackups
    
    Write-Success "========== 备份完成 =========="
    Write-Success "数据库备份: $dbBackup"
    Write-Success "MinIO 备份: $minioBackup"
}

# =============================================================================
# 恢复函数
# =============================================================================

function Show-BackupList {
    Write-Info "可用的备份时间点:"
    Write-Host ""
    
    # 列出数据库备份
    Write-Host "数据库备份:" -ForegroundColor Cyan
    $dbBackups = @()
    Get-ChildItem -Path $BACKUP_DB_DIR -File | 
        Where-Object { $_.Name -match '\.backup_(\d{8}_\d{6})' } |
        Sort-Object Name -Descending |
        ForEach-Object {
            $timestamp = $matches[1]
            $dbBackups += @{ Timestamp = $timestamp; Path = $_.FullName }
            Write-Host "  [$timestamp] $($_.FullName)"
        }
    
    Write-Host ""
    Write-Host "MinIO 备份:" -ForegroundColor Cyan
    $minioBackups = @()
    Get-ChildItem -Path $BACKUP_MINIO_DIR -Directory |
        Where-Object { $_.Name -match '^\d{8}' } |
        Sort-Object Name -Descending |
        ForEach-Object {
            $timestamp = $_.Name
            $minioBackups += @{ Timestamp = $timestamp; Path = $_.FullName }
            Write-Host "  [$timestamp] $($_.FullName)"
        }
    
    Write-Host ""
    
    return @{ Database = $dbBackups; MinIO = $minioBackups }
}

function Restore-Database {
    param([string]$BackupFile)
    
    Write-Warning "========== 警告 =========="
    Write-Warning "此操作将覆盖当前数据库文件: $DB_PATH"
    Write-Warning "当前数据将被永久删除！"
    Write-Host ""
    $confirm = Read-Host "确认继续？(输入 'YES' 继续)"
    
    if ($confirm -ne "YES") {
        Write-Info "恢复操作已取消"
        return $false
    }
    
    Write-Info "停止服务（建议手动停止 Next.js 服务）..."
    Write-Warning "请确保已停止 Next.js 应用，否则可能导致数据损坏"
    Read-Host "按 Enter 继续..."
    
    # 解压备份文件（如果是压缩的）
    $sourceFile = $BackupFile
    if ($BackupFile -match '\.zip$') {
        Write-Info "解压备份文件..."
        $tempDir = Join-Path $env:TEMP "ehs_restore_$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
        Expand-Archive -Path $BackupFile -DestinationPath $tempDir -Force
        $sourceFile = Get-ChildItem -Path $tempDir -File | Select-Object -First 1 -ExpandProperty FullName
    }
    
    # 备份当前数据库（以防万一）
    $currentBackup = "${DB_PATH}.before_restore_$(Get-Date -Format 'yyyyMMddHHmmss')"
    if (Test-Path $DB_PATH) {
        Copy-Item $DB_PATH $currentBackup
        Write-Info "当前数据库已备份到: $currentBackup"
    }
    
    # 恢复数据库
    Write-Info "恢复数据库..."
    try {
        $result = sqlite3 $sourceFile ".backup '$DB_PATH'" 2>&1
        Add-Content -Path $LOG_FILE -Value $result
        if ($LASTEXITCODE -eq 0) {
            Write-Success "数据库恢复成功"
        } else {
            throw "恢复失败"
        }
    } catch {
        Write-Error "数据库恢复失败: $_"
        # 尝试恢复原数据库
        if (Test-Path $currentBackup) {
            Write-Warning "尝试恢复原数据库..."
            Copy-Item $currentBackup $DB_PATH -Force
        }
        exit 1
    }
    
    # 清理旧的 WAL/SHM 文件
    $walFile = "${DB_PATH}-wal"
    $shmFile = "${DB_PATH}-shm"
    if (Test-Path $walFile) { Remove-Item $walFile -Force }
    if (Test-Path $shmFile) { Remove-Item $shmFile -Force }
    Write-Success "已清理旧的 WAL/SHM 文件"
    
    # 清理临时解压文件
    if ($BackupFile -match '\.zip$' -and $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    return $true
}

function Restore-MinIO {
    param([string]$BackupDir)
    
    Write-Warning "========== 警告 =========="
    Write-Warning "此操作将覆盖 MinIO 中的文件"
    Write-Warning "当前文件可能被永久删除！"
    Write-Host ""
    $confirm = Read-Host "确认继续？(输入 'YES' 继续)"
    
    if ($confirm -ne "YES") {
        Write-Info "恢复操作已取消"
        return $false
    }
    
    # 配置 MinIO alias
    Set-MinIOAlias
    
    # 测试连接
    if (-not (Test-MinIOConnection)) {
        exit 1
    }
    
    # 恢复每个 Bucket
    Get-ChildItem -Path $BackupDir -Directory | ForEach-Object {
        $bucket = $_.Name
        Write-Info "恢复 Bucket: $bucket"
        
        # 使用 mc mirror 反向同步
        try {
            $result = mc mirror --overwrite $_.FullName "${MINIO_ALIAS}/${bucket}" 2>&1
            Add-Content -Path $LOG_FILE -Value $result
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Bucket '$bucket' 恢复完成"
            } else {
                throw "恢复失败"
            }
        } catch {
            Write-Error "Bucket '$bucket' 恢复失败: $_"
            exit 1
        }
    }
    
    Write-Success "MinIO 恢复完成"
    return $true
}

function Start-Restore {
    Write-Info "========== 开始恢复流程 =========="
    
    # 列出可用备份
    $backups = Show-BackupList
    
    # 选择备份时间点
    Write-Host ""
    $timestamp = Read-Host "请输入要恢复的时间点 (格式: YYYYMMDD_HHMMSS 或 YYYYMMDDHHMMSS)"
    
    if ([string]::IsNullOrWhiteSpace($timestamp)) {
        Write-Error "时间点不能为空"
        exit 1
    }
    
    # 标准化时间戳格式
    if ($timestamp -match '^(\d{8})_(\d{6})$') {
        # 已经是正确格式
        $normalizedTimestamp = $timestamp
    } elseif ($timestamp -match '^(\d{8})(\d{6})$') {
        # 转换为带下划线的格式
        $normalizedTimestamp = "$($matches[1])_$($matches[2])"
    } else {
        Write-Error "时间戳格式错误"
        exit 1
    }
    
    # 查找数据库备份
    $dbBackup = $backups.Database | Where-Object { $_.Timestamp -eq $normalizedTimestamp } | Select-Object -First 1
    
    # 查找 MinIO 备份（使用日期部分）
    $datePart = $normalizedTimestamp.Substring(0, 8)
    $minioBackup = $backups.MinIO | Where-Object { $_.Timestamp -like "${datePart}*" } | Select-Object -First 1
    
    if (-not $dbBackup -and -not $minioBackup) {
        Write-Error "未找到时间点 '$timestamp' 的备份"
        exit 1
    }
    
    # 恢复数据库
    if ($dbBackup) {
        Restore-Database -BackupFile $dbBackup.Path
    } else {
        Write-Warning "未找到数据库备份，跳过数据库恢复"
    }
    
    # 恢复 MinIO
    if ($minioBackup) {
        Restore-MinIO -BackupDir $minioBackup.Path
    } else {
        Write-Warning "未找到 MinIO 备份，跳过文件恢复"
    }
    
    Write-Success "========== 恢复完成 =========="
    Write-Warning "请重启 Next.js 应用以应用更改"
}

# =============================================================================
# 主程序入口
# =============================================================================

function Show-Help {
    Write-Host @"
用法: .\ops.ps1 [命令]

命令:
  backup      执行完整备份（数据库 + MinIO）
  restore     交互式恢复数据
  list        列出所有可用备份
  help        显示此帮助信息

环境变量:
  DB_PATH             数据库路径 (默认: prisma\dev.db)
  MINIO_ENDPOINT      MinIO 端点 (默认: localhost)
  MINIO_PORT          MinIO 端口 (默认: 9000)
  MINIO_ACCESS_KEY    MinIO 访问密钥
  MINIO_SECRET_KEY    MinIO 秘密密钥
  BACKUP_ROOT         备份根目录 (默认: data\backups)
  RETENTION_DAYS      备份保留天数 (默认: 30)

示例:
  .\ops.ps1 backup                    # 执行备份
  .\ops.ps1 restore                   # 交互式恢复
  .\ops.ps1 list                      # 列出备份

"@
}

function Main {
    param([string]$Command = "help")
    
    switch ($Command.ToLower()) {
        "backup" {
            Start-Backup
        }
        "restore" {
            Start-Restore
        }
        "list" {
            Show-BackupList
        }
        "help" {
            Show-Help
        }
        default {
            Write-Error "未知命令: $Command"
            Show-Help
            exit 1
        }
    }
}

# 执行主程序
if ($args.Count -eq 0) {
    Main "help"
} else {
    Main $args[0]
}

