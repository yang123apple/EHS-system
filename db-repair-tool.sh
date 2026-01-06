#!/bin/bash
# Linux/Mac 启动脚本

echo "========================================"
echo "数据库修复与备份同步工具"
echo "========================================"
echo ""

if [ "$1" == "repair" ]; then
    echo "执行数据库修复..."
    node db-repair-tool.js repair
elif [ "$1" == "sync" ]; then
    echo "执行备份同步..."
    node db-repair-tool.js sync
else
    echo "启动 Web 服务器..."
    echo "访问 http://localhost:8888"
    echo ""
    node db-repair-tool.js server
fi

