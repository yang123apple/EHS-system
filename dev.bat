@echo off
chcp 65001 >nul
title EHS System Dev

:: 设置工作目录为脚本所在目录
cd /d "%~dp0"

echo ========================================
echo       EHS System 开发环境启动
echo ========================================
echo.

:: 检查 MinIO 是否已在运行（检查端口 9000）
netstat -ano | findstr ":9000.*LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] 正在后台启动 MinIO 服务...
    start "" /min cmd /c "start-minio.bat"
    :: 等待 MinIO 启动
    timeout /t 2 /nobreak >nul
    echo [INFO] MinIO 服务已在后台启动
) else (
    echo [INFO] MinIO 服务已在运行中
)

echo.
echo [INFO] 正在启动 Next.js 开发服务器...
echo ========================================
echo.

:: 启动 Next.js 开发服务器
npm run dev
