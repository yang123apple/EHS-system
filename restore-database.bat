@echo off
chcp 65001 >nul
echo ============================================================
echo 数据库恢复脚本
echo ============================================================
echo.
echo 重要提示: 请先关闭所有正在运行的应用程序！
echo    - Next.js 开发服务器 (npm run dev)
echo    - 任何可能使用数据库的程序
echo.
pause

echo.
echo 步骤 1: 清理损坏的数据库文件...
if exist "prisma\dev.db" (
    echo   备份损坏的数据库文件...
    copy "prisma\dev.db" "prisma\dev.db.corrupted.%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%" >nul
    del "prisma\dev.db" 2>nul
    if errorlevel 1 (
        echo   ⚠ 无法删除数据库文件，可能仍被占用
        echo   请手动关闭所有应用程序后重试
        pause
        exit /b 1
    )
    echo   ✓ 已删除损坏的数据库文件
)

del "prisma\dev.db-wal" 2>nul
del "prisma\dev.db-shm" 2>nul
del "prisma\dev.db-journal" 2>nul

echo.
echo 步骤 2: 创建数据库表结构...
call npx prisma migrate deploy
if errorlevel 1 (
    echo   ✗ 迁移失败
    pause
    exit /b 1
)
echo   ✓ 数据库表结构创建成功

echo.
echo 步骤 3: 生成 Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo   ✗ 生成失败
    pause
    exit /b 1
)
echo   ✓ Prisma Client 生成成功

echo.
echo 步骤 4: 从 JSON 文件导入数据...
echo   请选择导入模式:
echo   1. 清空现有数据后导入 (推荐)
echo   2. 合并模式导入 (保留现有数据)
set /p choice="请选择 (1/2): "

if "%choice%"=="1" (
    echo   清空现有数据...
    node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{await p.user.deleteMany({});await p.department.deleteMany({});await p.$disconnect();})()"
)

call npm run db:import

echo.
echo ============================================================
echo 数据库恢复完成！
echo ============================================================
echo.
echo 下一步: 重启应用程序
echo   运行: npm run dev
echo.
pause

