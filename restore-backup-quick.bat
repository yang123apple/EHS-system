@echo off
REM ========================================================================
REM EHS 系统快速恢复脚本（简化版）
REM ========================================================================
REM 使用方法：restore-backup-quick.bat [备份文件路径]
REM 示例：restore-backup-quick.bat data\backups\full_backup_2026-01-02.zip
REM ========================================================================

setlocal enabledelayedexpansion
REM 设置控制台编码为 GBK（Windows 中文系统默认编码）
chcp 936 >nul 2>&1

echo.
echo ================================
echo    EHS 快速恢复工具
echo ================================
echo.

REM 获取备份文件参数
if "%~1"=="" (
    echo 用法：%0 [备份文件路径]
    echo.
    echo 示例：
    echo   %0 data\backups\full_backup_2026-01-02.zip
    echo.
    
    REM 显示最新的备份文件
    for /f "delims=" %%f in ('dir /b /o-d data\backups\full_backup_*.zip 2^>nul') do (
        set "latest=data\backups\%%f"
        goto :found_latest
    )
    
    :found_latest
    if defined latest (
        echo 最新备份：!latest!
        set /p use_latest="使用此备份？(Y/N): "
        if /i "!use_latest!"=="Y" (
            set "BACKUP_FILE=!latest!"
        ) else (
            exit /b 1
        )
    ) else (
        echo 错误：未找到备份文件！
        exit /b 1
    )
) else (
    set "BACKUP_FILE=%~1"
)

if not exist "!BACKUP_FILE!" (
    echo 错误：备份文件不存在：!BACKUP_FILE!
    exit /b 1
)

echo.
echo 恢复文件：!BACKUP_FILE!
echo.
set /p confirm="确认恢复？(yes): "
if /i not "!confirm!"=="yes" exit /b 0

echo.
echo [1/5] 停止服务...
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/5] 解压备份...
set "TEMP_DIR=temp_restore_%random%"
node -e "const uz=require('unzipper');const fs=require('fs');fs.createReadStream('!BACKUP_FILE!').pipe(uz.Extract({path:'!TEMP_DIR!'})).on('close',()=>process.exit(0));" >nul
if %errorLevel% neq 0 (
    echo 错误：解压失败！
    exit /b 1
)

echo [3/5] 恢复数据库...
del /f /q "prisma\dev.db-wal" 2>nul
del /f /q "prisma\dev.db-shm" 2>nul
copy /y "!TEMP_DIR!\database.db" "prisma\dev.db" >nul

echo [4/5] 恢复上传文件...
if exist "public\uploads" rmdir /s /q "public\uploads" >nul 2>&1
if exist "!TEMP_DIR!\uploads" xcopy /e /i /y /q "!TEMP_DIR!\uploads" "public\uploads" >nul

echo [5/5] 清理...
rmdir /s /q "!TEMP_DIR!" >nul 2>&1

echo.
echo ✓ 恢复完成！
echo.
set /p start="启动服务？(Y/N): "
if /i "!start!"=="Y" start cmd /k "npm run dev"

echo.
pause
