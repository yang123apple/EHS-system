@echo off
REM MinIO 本地启动脚本 (Windows)
REM 当 Docker 不可用时使用此脚本

echo ========================================
echo MinIO 本地启动
echo ========================================
echo.

REM 检查 MinIO 是否已安装
set MINIO_EXE=
if exist "bin\minio.exe" (
    set MINIO_EXE=bin\minio.exe
    echo [信息] 使用项目目录中的 MinIO: bin\minio.exe
) else if exist "minio.exe" (
    set MINIO_EXE=minio.exe
    echo [信息] 使用当前目录中的 MinIO: minio.exe
) else (
    REM 检查系统 PATH 中的 minio，并验证是否真的可用
    where minio >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        REM 尝试运行 minio --version 来验证是否真的可用
        minio --version >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            set MINIO_EXE=minio
            echo [信息] 使用系统 PATH 中的 MinIO
        ) else (
            echo [警告] 检测到 PATH 中有 minio，但无法运行，将尝试其他方式...
        )
    )
)

if "%MINIO_EXE%"=="" (
    echo [错误] MinIO 未安装或无法运行
    echo.
    echo 请先安装 MinIO，有以下几种方式:
    echo.
    echo 方式 1: 手动下载（推荐）
    echo   1. 访问: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
    echo   2. 下载 minio.exe
    echo   3. 将 minio.exe 放到项目的 bin 文件夹中
    echo   4. 重新运行此脚本
    echo.
    echo 方式 2: 使用 Chocolatey（如果已安装）
    echo   choco install minio -y
    echo.
    echo 方式 3: 使用 PowerShell 下载
    echo   mkdir bin
    echo   powershell -Command "Invoke-WebRequest -Uri 'https://dl.min.io/server/minio/release/windows-amd64/minio.exe' -OutFile 'bin\minio.exe'"
    echo.
    echo 详细说明请查看: INSTALL_MINIO_MANUAL.md
    echo.
    pause
    exit /b 1
)

REM 设置环境变量
set MINIO_ROOT_USER=admin
set MINIO_ROOT_PASSWORD=change-me-now

REM 创建数据目录
if not exist "data\minio-data" (
    echo [信息] 创建数据目录: data\minio-data
    mkdir "data\minio-data"
)

echo.
echo ========================================
echo 启动 MinIO 服务器...
echo ========================================
echo   端点: http://localhost:9000
echo   Console: http://localhost:9001
echo   用户名: admin
echo   密码: change-me-now
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

REM 启动 MinIO
%MINIO_EXE% server data\minio-data --console-address ":9001"

REM 如果 MinIO 启动失败，暂停以便查看错误信息
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [错误] MinIO 启动失败，错误代码: %ERRORLEVEL%
    echo.
    pause
)
