#!/bin/bash

echo "========================================="
echo "局域网服务重启脚本"
echo "========================================="
echo ""

echo "1. 正在停止现有服务..."
pkill -f "next dev"
sleep 1

echo "2. 检查端口是否已释放..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   警告: 端口 3000 仍被占用，强制停止..."
    PID=$(lsof -t -i :3000)
    kill -9 $PID 2>/dev/null
    sleep 2
fi

echo "3. 检查当前 IP 地址..."
IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
echo "   本机 IP: $IP"

echo "4. 验证配置文件..."
if grep -q "next dev -H 0.0.0.0" package.json; then
    echo "   ✓ package.json 配置正确"
else
    echo "   ✗ 警告: package.json 配置可能不正确"
fi

if grep -q "MINIO_ENDPOINT=$IP" .env.local; then
    echo "   ✓ .env.local 配置正确"
else
    echo "   ⚠ 警告: .env.local 中的 MINIO_ENDPOINT 可能需要更新为 $IP"
fi

echo "5. 启动服务（监听所有接口 0.0.0.0）..."
cd /Users/yangguang/Desktop/EHS/EHS-system
npm run dev > /tmp/ehs-server.log 2>&1 &
SERVER_PID=$!

echo "6. 等待服务启动..."
sleep 8

echo "7. 验证服务状态..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   ✓ 服务已启动 (PID: $SERVER_PID)"
    
    echo ""
    echo "8. 检查监听地址..."
    LISTEN_INFO=$(netstat -an | grep 3000 | grep LISTEN)
    echo "$LISTEN_INFO"
    
    if echo "$LISTEN_INFO" | grep -q "\*\.3000"; then
        echo "   ✓ 正在监听所有接口"
    else
        echo "   ✗ 警告: 可能只监听 localhost"
    fi
    
    echo ""
    echo "9. 测试本地连接..."
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|302"; then
        echo "   ✓ localhost 访问正常"
    else
        echo "   ✗ localhost 访问失败"
    fi
    
    echo ""
    echo "10. 测试局域网 IP 连接..."
    if curl -s -o /dev/null -w "%{http_code}" http://$IP:3000 --max-time 5 | grep -q "200\|302"; then
        echo "   ✓ 局域网 IP 访问正常"
    else
        echo "   ✗ 局域网 IP 访问失败，请检查防火墙"
    fi
    
    echo ""
    echo "========================================="
    echo "服务已成功启动！"
    echo "========================================="
    echo "访问地址："
    echo "  • 本机访问: http://localhost:3000"
    echo "  • 局域网访问: http://$IP:3000"
    echo ""
    echo "服务日志: tail -f /tmp/ehs-server.log"
    echo "停止服务: pkill -f 'next dev'"
    echo "========================================="
else
    echo "   ✗ 服务启动失败"
    echo ""
    echo "查看错误日志："
    tail -20 /tmp/ehs-server.log
    exit 1
fi
