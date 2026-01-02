@echo off
REM ========================================================================
REM EHS 系统备份恢复脚本
REM ========================================================================
REM 功能：从 ZIP 备份文件快速恢复系统数据
REM 作者：EHS System Team
REM 日期：2026-01-02
REM ========================================================================

setlocal enabledelayedexpansion

REM 设置控制台编码为 UTF-8
chcp 65001 >nul

REM 设置颜色
color 0A

echo.
echo ========================================================================
echo                    EHS 系统数据恢复工具
echo ========================================================================
echo.

REM 检查是否以管理员身份运行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 请以管理员身份运行此脚本！
    echo 右键点击脚本，选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

REM ========================================================================
REM 步骤 0: 准备工作
REM ========================================================================

echo [步骤 0/6] 准备恢复环境...
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js！
    pause
    exit /b 1
)

REM 检查 unzipper 是否安装
node -e "require('unzipper')" >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] unzipper 模块未安装，尝试安装...
    npm install unzipper --save-dev
    if %errorLevel% neq 0 (
        echo [错误] unzipper 安装失败！
        pause
        exit /b 1
    )
)

REM 列出可用的备份文件
echo 可用的备份文件：
echo --------------------------------
set count=0
for %%f in (backups\full_backup_*.zip) do (
    set /a count+=1
    echo [!count!] %%f
    set "backup!count!=%%f"
)

if %count% equ 0 (
    echo [错误] 未找到备份文件！
    echo 备份文件应位于 backups\ 目录下，文件名格式：full_backup_*.zip
    echo.
    pause
    exit /b 1
)

echo --------------------------------
echo.
set /p choice="请输入要恢复的备份编号 (1-%count%) 或输入完整文件路径: "

REM 判断用户输入是编号还是路径
if exist "%choice%" (
    set "BACKUP_FILE=%choice%"
) else (
    if !choice! gtr 0 if !choice! leq %count% (
        set "BACKUP_FILE=!backup%choice%!"
    ) else (
        echo [错误] 无效的选择！
        pause
        exit /b 1
    )
)

REM 验证备份文件存在
if not exist "!BACKUP_FILE!" (
    echo [错误] 备份文件不存在：!BACKUP_FILE!
    pause
    exit /b 1
)

echo.
echo 选择的备份文件：!BACKUP_FILE!
echo.

REM 最终确认
set /p confirm="警告：此操作将覆盖当前系统数据，是否继续？(yes/no): "
if /i not "!confirm!"=="yes" (
    echo 操作已取消
    pause
    exit /b 0
)

echo.
echo ========================================================================
echo 开始恢复流程...
echo ========================================================================
echo.

REM ========================================================================
REM 步骤 1: 停止 Node.js 服务
REM ========================================================================

echo [步骤 1/6] 停止 Node.js 服务...
echo.

REM 查找并终止所有 Node.js 进程（与当前项目相关）
echo 查找运行中的 Node.js 进程...
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %errorLevel% equ 0 (
    echo 发现 Node.js 进程，正在终止...
    taskkill /F /IM node.exe /T >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo ✓ Node.js 服务已停止
) else (
    echo ✓ 没有运行中的 Node.js 服务
)

REM 额外等待，确保文件句柄释放
timeout /t 1 /nobreak >nul

echo.

REM ========================================================================
REM 步骤 2: 备份当前数据（安全措施）
REM ========================================================================

echo [步骤 2/6] 备份当前数据（安全措施）...
echo.

set "CURRENT_BACKUP=backups\current_backup_before_restore_%date:~0,4%-%date:~5,2%-%date:~8,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%.zip"
set "CURRENT_BACKUP=!CURRENT_BACKUP: =0!"

echo 正在创建当前系统快照...
node -e "const archiver=require('archiver');const fs=require('fs');const output=fs.createWriteStream('!CURRENT_BACKUP!');const archive=archiver('zip',{zlib:{level:9}});output.on('close',()=>console.log('✓ 当前数据已备份'));archive.on('error',err=>{throw err;});archive.pipe(output);if(fs.existsSync('prisma/dev.db'))archive.file('prisma/dev.db',{name:'database.db'});if(fs.existsSync('public/uploads'))archive.directory('public/uploads',false);archive.finalize();"

if %errorLevel% neq 0 (
    echo [警告] 当前数据备份失败，但继续恢复流程
) else (
    echo ✓ 当前数据已备份至：!CURRENT_BACKUP!
)

echo.

REM ========================================================================
REM 步骤 3: 解压 ZIP 文件
REM ========================================================================

echo [步骤 3/6] 解压备份文件...
echo.

REM 创建临时解压目录
set "TEMP_DIR=temp_restore_%random%"
if exist "!TEMP_DIR!" rmdir /s /q "!TEMP_DIR!"
mkdir "!TEMP_DIR!"

echo 正在解压：!BACKUP_FILE!
echo 解压到：!TEMP_DIR!\
echo.

REM 使用 Node.js 解压（支持中文路径和大文件）
node -e "const unzipper=require('unzipper');const fs=require('fs');fs.createReadStream('!BACKUP_FILE!').pipe(unzipper.Extract({path:'!TEMP_DIR!'})).on('close',()=>{console.log('✓ 解压完成');process.exit(0);}).on('error',err=>{console.error('解压失败:',err);process.exit(1);});"

if %errorLevel% neq 0 (
    echo [错误] 解压失败！
    echo 可能原因：
    echo   1. 备份文件损坏
    echo   2. 磁盘空间不足
    echo   3. 文件权限问题
    echo.
    pause
    exit /b 1
)

REM 验证解压内容
if not exist "!TEMP_DIR!\database.db" (
    echo [错误] 解压后未找到 database.db 文件！
    echo 备份文件可能不完整或格式错误
    rmdir /s /q "!TEMP_DIR!"
    pause
    exit /b 1
)

echo ✓ 备份文件解压成功
echo.

REM ========================================================================
REM 步骤 4: 恢复数据库文件
REM ========================================================================

echo [步骤 4/6] 恢复数据库文件...
echo.

REM 删除旧的 WAL 和 SHM 文件
if exist "prisma\dev.db-wal" (
    echo 删除旧的 WAL 文件...
    del /f /q "prisma\dev.db-wal" 2>nul
)
if exist "prisma\dev.db-shm" (
    echo 删除旧的 SHM 文件...
    del /f /q "prisma\dev.db-shm" 2>nul
)

REM 覆盖数据库文件
echo 正在覆盖数据库文件...
copy /y "!TEMP_DIR!\database.db" "prisma\dev.db" >nul
if %errorLevel% neq 0 (
    echo [错误] 数据库文件覆盖失败！
    echo 可能原因：数据库文件被锁定
    rmdir /s /q "!TEMP_DIR!"
    pause
    exit /b 1
)

REM 恢复 WAL 和 SHM 文件（如果备份中存在）
if exist "!TEMP_DIR!\database.db-wal" (
    echo 恢复 WAL 文件...
    copy /y "!TEMP_DIR!\database.db-wal" "prisma\dev.db-wal" >nul
)
if exist "!TEMP_DIR!\database.db-shm" (
    echo 恢复 SHM 文件...
    copy /y "!TEMP_DIR!\database.db-shm" "prisma\dev.db-shm" >nul
)

echo ✓ 数据库文件已恢复
echo.

REM ========================================================================
REM 步骤 5: 恢复上传文件
REM ========================================================================

echo [步骤 5/6] 恢复上传文件...
echo.

REM 删除现有的 uploads 目录
if exist "public\uploads" (
    echo 删除现有上传文件目录...
    rmdir /s /q "public\uploads" 2>nul
    if exist "public\uploads" (
        echo [警告] 无法完全删除旧的 uploads 目录，可能有文件被占用
        echo 尝试强制删除...
        timeout /t 2 /nobreak >nul
        rmdir /s /q "public\uploads" 2>nul
    )
)

REM 复制备份的 uploads 目录
if exist "!TEMP_DIR!\uploads" (
    echo 正在恢复上传文件...
    xcopy /e /i /y /q "!TEMP_DIR!\uploads" "public\uploads" >nul
    if %errorLevel% neq 0 (
        echo [错误] 上传文件恢复失败！
        rmdir /s /q "!TEMP_DIR!"
        pause
        exit /b 1
    )
    
    REM 统计恢复的文件数量
    set filecount=0
    for /r "public\uploads" %%f in (*) do set /a filecount+=1
    echo ✓ 上传文件已恢复 (共 !filecount! 个文件)
) else (
    echo [警告] 备份中未找到 uploads 目录
    mkdir "public\uploads" 2>nul
    echo ✓ 已创建空的 uploads 目录
)

echo.

REM ========================================================================
REM 步骤 6: 恢复其他数据文件（可选）
REM ========================================================================

echo [步骤 6/6] 恢复其他数据文件...
echo.

REM 恢复 data 目录下的 JSON 文件
if exist "!TEMP_DIR!\data" (
    echo 正在恢复数据文件...
    if not exist "data" mkdir "data"
    xcopy /e /i /y /q "!TEMP_DIR!\data" "data" >nul
    echo ✓ 数据文件已恢复
) else (
    echo ○ 备份中无 data 目录
)

REM 恢复 Prisma schema（仅在存在时）
if exist "!TEMP_DIR!\schema.prisma" (
    echo 正在恢复 Prisma schema...
    copy /y "!TEMP_DIR!\schema.prisma" "prisma\schema.prisma" >nul
    echo ✓ Prisma schema 已恢复
) else (
    echo ○ 备份中无 Prisma schema
)

echo.

REM ========================================================================
REM 清理临时文件
REM ========================================================================

echo 清理临时文件...
rmdir /s /q "!TEMP_DIR!" 2>nul
echo ✓ 临时文件已清理
echo.

REM ========================================================================
REM 步骤 7: 重启服务
REM ========================================================================

echo ========================================================================
echo 数据恢复完成！
echo ========================================================================
echo.

set /p restart="是否立即启动开发服务器？(yes/no): "
if /i "!restart!"=="yes" (
    echo.
    echo 正在启动开发服务器...
    echo ========================================================================
    echo 按 Ctrl+C 可停止服务器
    echo ========================================================================
    echo.
    
    REM 启动开发服务器
    start "EHS System - Dev Server" cmd /k "npm run dev"
    
    timeout /t 3 /nobreak >nul
    echo.
    echo ✓ 开发服务器已在新窗口中启动
    echo.
    echo 访问地址：http://localhost:3000
    echo.
) else (
    echo.
    echo 服务未启动，您可以稍后手动启动：
    echo   npm run dev
    echo.
)

echo ========================================================================
echo 恢复总结：
echo ========================================================================
echo ✓ 备份文件：!BACKUP_FILE!
echo ✓ 数据库：已恢复到 prisma/dev.db
echo ✓ 上传文件：已恢复到 public/uploads
echo ✓ 安全备份：!CURRENT_BACKUP!
echo ========================================================================
echo.

REM 验证数据库文件
echo 验证数据库完整性...
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$queryRaw`SELECT COUNT(*) as count FROM User`.then(r=>{console.log('✓ 数据库验证通过，用户数:',r[0].count);p.$disconnect();}).catch(e=>{console.error('✗ 数据库验证失败:',e.message);p.$disconnect();process.exit(1);});"

if %errorLevel% equ 0 (
    echo ✓ 数据库文件完整性验证通过
) else (
    echo [警告] 数据库验证失败，可能需要手动检查
)

echo.
echo 恢复流程全部完成！🎉
echo.
pause
