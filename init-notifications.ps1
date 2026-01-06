# 通知模块一键初始化脚本
# 使用方法: 在 PowerShell 中运行 .\init-notifications.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  通知模块初始化工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否有 Node 进程在运行
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "⚠️  检测到应用正在运行" -ForegroundColor Yellow
    Write-Host "需要停止应用才能执行数据库迁移" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "是否停止所有 Node 进程？(y/n)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "正在停止 Node 进程..." -ForegroundColor Yellow
        Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-Host "✅ Node 进程已停止" -ForegroundColor Green
    } else {
        Write-Host "❌ 请手动停止应用后重新运行此脚本" -ForegroundColor Red
        exit
    }
}

Write-Host ""
Write-Host "步骤 1/3: 执行数据库迁移..." -ForegroundColor Cyan
Write-Host ""

try {
    $output = & node node_modules/prisma/build/index.js migrate deploy 2>&1
    Write-Host $output
    Write-Host "✅ 数据库迁移完成" -ForegroundColor Green
} catch {
    Write-Host "❌ 数据库迁移失败: $_" -ForegroundColor Red
    Write-Host "您可以手动运行: node node_modules/prisma/build/index.js migrate deploy" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "步骤 2/3: 重新生成 Prisma 客户端..." -ForegroundColor Cyan
Write-Host ""

try {
    $output = & node node_modules/prisma/build/index.js generate 2>&1
    Write-Host $output
    Write-Host "✅ Prisma 客户端生成完成" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Prisma 客户端生成可能有问题" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "步骤 3/3: 启动应用..." -ForegroundColor Cyan
Write-Host ""

Write-Host "正在后台启动应用..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "等待应用启动（10秒）..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  初始化准备完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "接下来的步骤：" -ForegroundColor Cyan
Write-Host "1. 等待应用完全启动（约30秒）" -ForegroundColor White
Write-Host "2. 打开浏览器访问: http://localhost:3000/init-notification-templates.html" -ForegroundColor White
Write-Host "3. 登录管理员账号" -ForegroundColor White
Write-Host "4. 点击'开始初始化'按钮创建模板" -ForegroundColor White
Write-Host "5. 访问 /admin/notifications 查看结果" -ForegroundColor White
Write-Host ""
Write-Host "💡 提示: 如果遇到问题，请查看 '通知模块初始化步骤.md' 文档" -ForegroundColor Yellow
Write-Host ""

# 自动打开浏览器（可选）
$openBrowser = Read-Host "是否自动打开浏览器？(y/n)"
if ($openBrowser -eq 'y' -or $openBrowser -eq 'Y') {
    Start-Sleep -Seconds 20
    Start-Process "http://localhost:3000/init-notification-templates.html"
}
