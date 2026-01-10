@echo off
chcp 65001 >nul
title MinIO Server

:: 设置工作目录为脚本所在目录
cd /d "%~dp0"

:: MinIO 配置
set MINIO_ROOT_USER=admin
set MINIO_ROOT_PASSWORD=change-me-now

:: 数据目录
set DATA_PATH=.\data\minio-data

:: 确保数据目录存在
if not exist "%DATA_PATH%" (
    mkdir "%DATA_PATH%"
    echo [INFO] 已创建数据目录: %DATA_PATH%
)

echo ========================================
echo         MinIO 本地服务启动脚本
echo ========================================
echo.
echo [INFO] Root User: %MINIO_ROOT_USER%
echo [INFO] API 端口: 9000
echo [INFO] Console 端口: 9001
echo [INFO] 数据目录: %DATA_PATH%
echo.
echo [INFO] MinIO Console 访问地址: http://localhost:9001
echo [INFO] MinIO API 地址: http://localhost:9000
echo.
echo 按 Ctrl+C 停止服务
echo ========================================
echo.

:: 启动 MinIO
.\bin\minio.exe server %DATA_PATH% --console-address ":9001"
