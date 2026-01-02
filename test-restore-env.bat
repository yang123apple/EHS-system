@echo off
REM 测试批处理脚本语法和环境

echo ========================================
echo   批处理脚本环境测试
echo ========================================
echo.

echo [测试 1] 检查文件存在性...
if exist "restore-backup.bat" (
    echo   ✓ restore-backup.bat 存在
) else (
    echo   ✗ restore-backup.bat 不存在
)

if exist "restore-backup-quick.bat" (
    echo   ✓ restore-backup-quick.bat 存在
) else (
    echo   ✗ restore-backup-quick.bat 不存在
)
echo.

echo [测试 2] 检查 Node.js 环境...
where node >nul 2>&1
if %errorLevel% equ 0 (
    echo   ✓ Node.js 已安装
    node --version
) else (
    echo   ✗ Node.js 未安装
)
echo.

echo [测试 3] 检查 npm 包...
node -e "require('archiver')" >nul 2>&1
if %errorLevel% equ 0 (
    echo   ✓ archiver 已安装
) else (
    echo   ✗ archiver 未安装
)

node -e "require('unzipper')" >nul 2>&1
if %errorLevel% equ 0 (
    echo   ✓ unzipper 已安装
) else (
    echo   ✗ unzipper 未安装
)
echo.

echo [测试 4] 检查备份目录...
if exist "backups" (
    echo   ✓ backups 目录存在
    dir /b backups\full_backup_*.zip 2>nul | find /c /v "" >nul
    if %errorLevel% equ 0 (
        echo   ✓ 找到备份文件
        dir /b backups\full_backup_*.zip 2>nul
    ) else (
        echo   ○ 暂无备份文件
    )
) else (
    echo   ✗ backups 目录不存在
)
echo.

echo [测试 5] 检查数据库文件...
if exist "prisma\dev.db" (
    echo   ✓ 数据库文件存在
    for %%A in ("prisma\dev.db") do (
        echo     大小: %%~zA 字节
    )
) else (
    echo   ✗ 数据库文件不存在
)

if exist "prisma\dev.db-wal" (
    echo   ✓ WAL 文件存在 (WAL 模式已启用)
) else (
    echo   ○ WAL 文件不存在
)
echo.

echo [测试 6] 检查上传目录...
if exist "public\uploads" (
    echo   ✓ uploads 目录存在
    dir /s /b public\uploads\* 2>nul | find /c /v "" >nul
    if %errorLevel% equ 0 (
        for /f %%A in ('dir /s /b public\uploads\* 2^>nul ^| find /c /v ""') do (
            echo     文件数: %%A
        )
    )
) else (
    echo   ✗ uploads 目录不存在
)
echo.

echo [测试 7] 检查管理员权限...
net session >nul 2>&1
if %errorLevel% equ 0 (
    echo   ✓ 以管理员身份运行
) else (
    echo   ✗ 未以管理员身份运行
    echo     (恢复脚本需要管理员权限)
)
echo.

echo ========================================
echo   测试完成
echo ========================================
echo.

echo 建议：
if exist "backups\full_backup_*.zip" (
    echo   • 可以开始使用恢复脚本
    echo   • 推荐使用: restore-backup.bat
) else (
    echo   • 请先创建备份: npm run backup
    echo   • 或运行: node scripts/auto-backup.js
)
echo.

pause
