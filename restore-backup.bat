@echo off
REM ========================================================================
REM EHS 系统备份恢复脚本
REM ========================================================================
REM 功能：从 ZIP 备份文件快速恢复系统数据
REM 作者：EHS System Team
REM 日期：2026-01-02
REM ========================================================================

setlocal enabledelayedexpansion

REM 设置控制台编码为 GBK（Windows 中文系统默认编码）
REM 注意：批处理文件本身需要以 ANSI/GBK 编码保存才能正确显示中文
chcp 65001 >nul 2>&1
REM 如果仍有编码问题，可以尝试使用 UTF-8
REM chcp 65001 >nul 2>&1

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

echo [Step 0/6] Preparing restore environment...
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
echo Available backup files:
echo --------------------------------

REM 获取脚本所在目录
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM 设置备份目录路径
set "BACKUP_DIR=%SCRIPT_DIR%\data\backups"

REM 检查备份目录是否存在
if not exist "%BACKUP_DIR%" (
    echo [ERROR] Backup directory not found: %BACKUP_DIR%
    echo.
    pause
    exit /b 1
)

REM 切换到脚本目录
cd /d "%SCRIPT_DIR%"

set count=0
for %%f in ("%BACKUP_DIR%\full_backup_*.zip") do (
    set /a count+=1
    echo [!count!] %%~nxf
    set "backup!count!=%%f"
)

if %count% equ 0 (
    echo [ERROR] Backup file not found!
    echo Backup files should be in: %BACKUP_DIR%
    echo Format: full_backup_*.zip
    echo.
    echo Current directory: %CD%
    echo Looking in: %BACKUP_DIR%
    echo.
    pause
    exit /b 1
)

echo --------------------------------
echo.
echo Please enter backup number (1-%count%) or full file path:
set /p choice=

REM 判断用户输入是编号还是路径
if exist "%choice%" (
    set "BACKUP_FILE=%choice%"
) else (
    if !choice! gtr 0 if !choice! leq %count% (
        set "BACKUP_FILE=!backup%choice%!"
    ) else (
        echo [ERROR] Invalid selection!
        pause
        exit /b 1
    )
)

REM 验证备份文件存在
if not exist "!BACKUP_FILE!" (
    echo [ERROR] Backup file not found: !BACKUP_FILE!
    pause
    exit /b 1
)

echo.
echo Selected backup file: !BACKUP_FILE!
echo.

REM 最终确认
echo WARNING: This operation will overwrite current system data!
echo Do you want to continue? (yes/no):
set /p confirm=
if /i not "!confirm!"=="yes" (
    echo Operation cancelled
    pause
    exit /b 0
)

echo.
echo ========================================================================
echo Starting restore process...
echo ========================================================================
echo.

REM ========================================================================
REM 步骤 1: 停止 Node.js 服务
REM ========================================================================

echo [Step 1/6] Stopping Node.js service...
echo.

REM 查找并终止所有 Node.js 进程（与当前项目相关）
echo Finding running Node.js processes...
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %errorLevel% equ 0 (
    echo Found Node.js processes, terminating...
    taskkill /F /IM node.exe /T >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo Node.js service stopped
) else (
    echo No running Node.js service found
)

REM 额外等待，确保文件句柄释放
timeout /t 1 /nobreak >nul

echo.

REM ========================================================================
REM 步骤 2: 备份当前数据（安全措施）
REM ========================================================================

echo [Step 2/6] Backing up current data (safety measure)...
echo.

REM 创建时间戳（使用 PowerShell 获取标准格式）
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "timestamp=%datetime:~0,8%_%datetime:~8,6%"
set "timestamp=!timestamp: =0!"

REM 设置备份文件路径（使用绝对路径）
set "CURRENT_BACKUP=%SCRIPT_DIR%\data\backups\current_backup_before_restore_%timestamp%.zip"

REM 确保备份目录存在
if not exist "%SCRIPT_DIR%\data\backups" mkdir "%SCRIPT_DIR%\data\backups"

echo Creating current system snapshot...
set "BACKUP_PATH=!CURRENT_BACKUP!"
node -e "const archiver=require('archiver');const fs=require('fs');const path=require('path');const backupPath=path.resolve(process.env.BACKUP_PATH);const output=fs.createWriteStream(backupPath);const archive=archiver('zip',{zlib:{level:9}});output.on('close',()=>console.log('Current data backed up'));archive.on('error',err=>{console.error('Backup error:',err);process.exit(1);});archive.pipe(output);if(fs.existsSync('prisma/dev.db'))archive.file('prisma/dev.db',{name:'database.db'});if(fs.existsSync('public/uploads'))archive.directory('public/uploads',false);archive.finalize();"

if %errorLevel% neq 0 (
    echo [WARNING] Current data backup failed, but continuing restore process
) else (
    echo Current data backed up to: !CURRENT_BACKUP!
)

echo.

REM ========================================================================
REM 步骤 3: 解压 ZIP 文件
REM ========================================================================

echo [Step 3/6] Extracting backup file...
echo.

REM 创建临时解压目录
set "TEMP_DIR=%SCRIPT_DIR%\temp_restore_%random%"
if exist "!TEMP_DIR!" rmdir /s /q "!TEMP_DIR!"
mkdir "!TEMP_DIR!"

echo Extracting: !BACKUP_FILE!
echo To: !TEMP_DIR!
echo.

REM 使用 Node.js 解压（支持中文路径和大文件）
set "RESTORE_BACKUP_FILE=!BACKUP_FILE!"
set "RESTORE_TEMP_DIR=!TEMP_DIR!"
node -e "const unzipper=require('unzipper');const fs=require('fs');const path=require('path');const backupPath=path.resolve(process.env.RESTORE_BACKUP_FILE);const extractPath=path.resolve(process.env.RESTORE_TEMP_DIR);fs.createReadStream(backupPath).pipe(unzipper.Extract({path:extractPath})).on('close',()=>{console.log('Extraction completed');process.exit(0);}).on('error',err=>{console.error('Extraction failed:',err.message);process.exit(1);});"

if %errorLevel% neq 0 (
    echo [ERROR] Extraction failed!
    echo Possible reasons:
    echo   1. Backup file is corrupted
    echo   2. Insufficient disk space
    echo   3. File permission issues
    echo.
    pause
    exit /b 1
)

REM Verify extracted content - Find database file (may be in multiple locations)
set "DB_FILE="
if exist "!TEMP_DIR!\database\dev.db" (
    set "DB_FILE=!TEMP_DIR!\database\dev.db"
) else if exist "!TEMP_DIR!\database.db" (
    set "DB_FILE=!TEMP_DIR!\database.db"
) else if exist "!TEMP_DIR!\dev.db" (
    set "DB_FILE=!TEMP_DIR!\dev.db"
) else if exist "!TEMP_DIR!\prisma\dev.db" (
    set "DB_FILE=!TEMP_DIR!\prisma\dev.db"
)

if not defined DB_FILE (
    echo [ERROR] Database file not found after extraction!
    echo Searched locations:
    echo   - !TEMP_DIR!\database\dev.db
    echo   - !TEMP_DIR!\database.db
    echo   - !TEMP_DIR!\dev.db
    echo   - !TEMP_DIR!\prisma\dev.db
    echo.
    echo Backup file may be incomplete or corrupted
    rmdir /s /q "!TEMP_DIR!"
    pause
    exit /b 1
)

echo Backup file extracted successfully
echo Found database file: !DB_FILE!
echo.

REM ========================================================================
REM 步骤 4: 恢复数据库文件
REM ========================================================================

echo [Step 4/6] Restoring database file...
echo.

REM 删除旧的 WAL 和 SHM 文件
if exist "prisma\dev.db-wal" (
    echo Deleting old WAL file...
    del /f /q "prisma\dev.db-wal" 2>nul
)
if exist "prisma\dev.db-shm" (
    echo Deleting old SHM file...
    del /f /q "prisma\dev.db-shm" 2>nul
)

REM 覆盖数据库文件
echo Overwriting database file...
copy /y "!DB_FILE!" "prisma\dev.db" >nul
if %errorLevel% neq 0 (
    echo [ERROR] Database file overwrite failed!
    echo Possible reason: Database file is locked
    rmdir /s /q "!TEMP_DIR!"
    pause
    exit /b 1
)

REM Restore WAL and SHM files (if they exist in backup)
REM Find WAL and SHM files (may be in multiple locations)
set "WAL_FILE="
set "SHM_FILE="

if exist "!TEMP_DIR!\database\dev.db-wal" (
    set "WAL_FILE=!TEMP_DIR!\database\dev.db-wal"
) else if exist "!TEMP_DIR!\database.db-wal" (
    set "WAL_FILE=!TEMP_DIR!\database.db-wal"
) else if exist "!TEMP_DIR!\dev.db-wal" (
    set "WAL_FILE=!TEMP_DIR!\dev.db-wal"
)

if exist "!TEMP_DIR!\database\dev.db-shm" (
    set "SHM_FILE=!TEMP_DIR!\database\dev.db-shm"
) else if exist "!TEMP_DIR!\database.db-shm" (
    set "SHM_FILE=!TEMP_DIR!\database.db-shm"
) else if exist "!TEMP_DIR!\dev.db-shm" (
    set "SHM_FILE=!TEMP_DIR!\dev.db-shm"
)

if defined WAL_FILE (
    echo Restoring WAL file...
    copy /y "!WAL_FILE!" "prisma\dev.db-wal" >nul
)
if defined SHM_FILE (
    echo Restoring SHM file...
    copy /y "!SHM_FILE!" "prisma\dev.db-shm" >nul
)

echo Database file restored successfully
echo.

REM ========================================================================
REM 步骤 5: 恢复上传文件
REM ========================================================================

echo [Step 5/6] Restoring upload files...
echo.

REM 删除现有的 uploads 目录
if exist "public\uploads" (
    echo Deleting existing uploads directory...
    rmdir /s /q "public\uploads" 2>nul
    if exist "public\uploads" (
        echo [WARNING] Cannot fully delete old uploads directory, files may be in use
        echo Attempting forced deletion...
        timeout /t 2 /nobreak >nul
        rmdir /s /q "public\uploads" 2>nul
    )
)

REM 复制备份的 uploads 目录
if exist "!TEMP_DIR!\uploads" (
    echo Restoring upload files...
    xcopy /e /i /y /q "!TEMP_DIR!\uploads" "public\uploads" >nul
    if %errorLevel% neq 0 (
        echo [ERROR] Upload files restore failed!
        rmdir /s /q "!TEMP_DIR!"
        pause
        exit /b 1
    )
    
    REM 统计恢复的文件数量
    set filecount=0
    for /r "public\uploads" %%f in (*) do set /a filecount+=1
    echo Upload files restored successfully (!filecount! files)
) else (
    echo [WARNING] uploads directory not found in backup
    mkdir "public\uploads" 2>nul
    echo Created empty uploads directory
)

echo.

REM ========================================================================
REM 步骤 6: 恢复其他数据文件（可选）
REM ========================================================================

echo [Step 6/6] Restoring other data files...
echo.

REM 恢复 data 目录下的 JSON 文件
if exist "!TEMP_DIR!\data" (
    echo Restoring data files...
    if not exist "data" mkdir "data"
    xcopy /e /i /y /q "!TEMP_DIR!\data" "data" >nul
    echo Data files restored successfully
) else (
    echo No data directory in backup
)

REM 恢复 Prisma schema（仅在存在时）
if exist "!TEMP_DIR!\schema.prisma" (
    echo Restoring Prisma schema...
    copy /y "!TEMP_DIR!\schema.prisma" "prisma\schema.prisma" >nul
    echo Prisma schema restored successfully
) else (
    echo No Prisma schema in backup
)

echo.

REM ========================================================================
REM 清理临时文件
REM ========================================================================

echo Cleaning up temporary files...
rmdir /s /q "!TEMP_DIR!" 2>nul
echo Temporary files cleaned up
echo.

REM ========================================================================
REM 步骤 7: 重启服务
REM ========================================================================

echo ========================================================================
echo Data restore completed!
echo ========================================================================
echo.

echo Start development server now? (yes/no):
set /p restart=
if /i "!restart!"=="yes" (
    echo.
    echo Starting development server...
    echo ========================================================================
    echo Press Ctrl+C to stop the server
    echo ========================================================================
    echo.
    
    REM 启动开发服务器
    start "EHS System - Dev Server" cmd /k "npm run dev"
    
    timeout /t 3 /nobreak >nul
    echo.
    echo Development server started in new window
    echo.
    echo Access URL: http://localhost:3000
    echo.
) else (
    echo.
    echo Server not started. You can start it manually later:
    echo   npm run dev
    echo.
)

echo ========================================================================
echo Restore Summary:
echo ========================================================================
echo Backup file: !BACKUP_FILE!
echo Database: Restored to prisma/dev.db
echo Upload files: Restored to public/uploads
echo Safety backup: !CURRENT_BACKUP!
echo ========================================================================
echo.

REM Verify database file
echo Verifying database integrity...
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.$queryRawUnsafe('SELECT COUNT(*) as count FROM User').then(r=>{console.log('Database verification passed, user count:',r[0].count);p.$disconnect();}).catch(e=>{console.error('Database verification failed:',e.message);p.$disconnect();process.exit(1);});"

if %errorLevel% equ 0 (
    echo Database integrity verification passed
) else (
    echo [WARNING] Database verification failed, manual check may be required
)

echo.
echo Restore process completed successfully!
echo.
pause
