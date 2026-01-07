@echo off
REM ========================================================================
REM EHS System Backup Restore Tool (Simple Version)
REM Uses Node.js script to avoid encoding issues
REM ========================================================================

echo.
echo ========================================================================
echo            EHS System Data Restore Tool
echo ========================================================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

REM Run Node.js restore script
node scripts/restore-backup.js %*

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Restore failed!
    pause
    exit /b 1
)

echo.
pause

