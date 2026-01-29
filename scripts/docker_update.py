#!/usr/bin/env python3
"""
EHS 系统服务更新脚本
用于更新服务器上的 Docker 服务，支持零停机或最小停机更新
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path


def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """执行命令并返回结果"""
    print(f"+ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def confirm_action(message: str) -> bool:
    """确认操作"""
    response = input(f"\n⚠️  {message} (yes/no): ").strip().lower()
    return response in ["yes", "y"]


def check_docker_running():
    """检查 Docker 是否运行"""
    result = run_command(["docker", "ps"], check=False)
    if result.returncode != 0:
        print("❌ 错误: Docker 未运行或无权限访问")
        sys.exit(1)


def backup_before_update(backup_script: Path):
    """更新前自动备份"""
    print("\n📦 更新前自动备份...")
    if backup_script.exists():
        result = run_command([
            "python3", str(backup_script),
            "--backup-dir", "./backups"
        ], check=False)
        if result.returncode == 0:
            print("✅ 备份完成")
            return True
        else:
            print("⚠️  警告: 备份失败，但继续更新")
            return False
    else:
        print("⚠️  警告: 找不到备份脚本，跳过备份")
        return False


def pull_latest_code():
    """拉取最新代码"""
    print("\n📥 拉取最新代码...")

    # 检查是否有未提交的更改
    result = run_command(["git", "status", "--porcelain"], check=False)
    if result.stdout.strip():
        print("⚠️  警告: 有未提交的更改")
        if not confirm_action("是否继续拉取代码？未提交的更改可能丢失"):
            print("❌ 操作已取消")
            sys.exit(0)

    # 拉取代码
    run_command(["git", "pull"])
    print("✅ 代码已更新")


def build_new_image(compose_file: Path, env_file: Path, no_cache: bool = False):
    """构建新的 Docker 镜像"""
    print("\n🔨 构建新的 Docker 镜像...")

    cmd = [
        "docker", "compose",
        "--env-file", str(env_file),
        "-f", str(compose_file),
        "build"
    ]

    if no_cache:
        cmd.append("--no-cache")

    cmd.append("app")  # 只构建 app 服务

    run_command(cmd)
    print("✅ 镜像构建完成")


def update_service_rolling(compose_file: Path, env_file: Path):
    """滚动更新服务（最小停机时间）"""
    print("\n🔄 执行滚动更新...")

    # 使用 docker compose up -d 会自动进行滚动更新
    run_command([
        "docker", "compose",
        "--env-file", str(env_file),
        "-f", str(compose_file),
        "up", "-d", "--no-deps", "app"
    ])

    print("✅ 服务已更新")


def update_service_recreate(compose_file: Path, env_file: Path):
    """重新创建服务（完全停机更新）"""
    print("\n🔄 停止并重新创建服务...")

    # 停止服务
    print("🛑 停止服务...")
    run_command([
        "docker", "compose",
        "--env-file", str(env_file),
        "-f", str(compose_file),
        "down"
    ])

    # 启动服务
    print("🚀 启动服务...")
    run_command([
        "docker", "compose",
        "--env-file", str(env_file),
        "-f", str(compose_file),
        "up", "-d"
    ])

    print("✅ 服务已重新创建")


def wait_for_healthy(container_name: str = "ehs-app", timeout: int = 60):
    """等待容器健康"""
    print(f"\n⏳ 等待容器 {container_name} 健康检查...")

    start_time = time.time()
    while time.time() - start_time < timeout:
        result = run_command([
            "docker", "inspect",
            "--format", "{{.State.Health.Status}}",
            container_name
        ], check=False)

        if result.returncode == 0:
            status = result.stdout.strip()
            if status == "healthy":
                print(f"✅ 容器 {container_name} 已健康")
                return True
            elif status == "unhealthy":
                print(f"❌ 容器 {container_name} 不健康")
                return False
            else:
                print(f"⏳ 当前状态: {status}，等待中...")

        time.sleep(5)

    print(f"⚠️  超时: 容器 {container_name} 未在 {timeout} 秒内变为健康")
    return False


def check_service_health(env_file: Path):
    """检查服务健康状态"""
    print("\n🏥 检查服务健康状态...")

    # 检查容器状态
    result = run_command([
        "docker", "ps",
        "--filter", "name=ehs-",
        "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    ], check=False)

    if result.returncode == 0:
        print(result.stdout)

    # 尝试访问健康检查端点
    print("\n🔍 测试健康检查端点...")
    result = run_command([
        "curl", "-f", "-s",
        "http://localhost:3000/api/health"
    ], check=False)

    if result.returncode == 0:
        print("✅ 健康检查端点正常")
        print(result.stdout)
    else:
        print("⚠️  警告: 健康检查端点无响应")


def show_logs(container_name: str = "ehs-app", lines: int = 50):
    """显示容器日志"""
    print(f"\n📋 显示最近 {lines} 行日志:")
    run_command([
        "docker", "logs",
        "--tail", str(lines),
        container_name
    ], check=False)


def main():
    parser = argparse.ArgumentParser(description="更新 EHS 系统 Docker 服务")
    parser.add_argument(
        "--mode",
        choices=["rolling", "recreate"],
        default="rolling",
        help="更新模式: rolling (滚动更新，最小停机) 或 recreate (重新创建，完全停机)"
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="跳过更新前备份"
    )
    parser.add_argument(
        "--no-pull",
        action="store_true",
        help="跳过拉取最新代码"
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="构建镜像时不使用缓存"
    )
    parser.add_argument(
        "--skip-health-check",
        action="store_true",
        help="跳过健康检查等待"
    )
    parser.add_argument(
        "--show-logs",
        action="store_true",
        help="更新后显示日志"
    )

    args = parser.parse_args()

    print("🚀 EHS 系统服务更新工具")
    print("=" * 60)

    # 检查 Docker
    check_docker_running()

    # 配置文件路径
    compose_file = Path("docker-compose.prod.yml")
    env_file = Path(".env.docker.local")
    if not env_file.exists():
        env_file = Path(".env.docker")

    backup_script = Path("scripts/docker_backup.py")

    if not compose_file.exists():
        print(f"❌ 错误: 找不到 {compose_file}")
        sys.exit(1)

    if not env_file.exists():
        print(f"❌ 错误: 找不到环境配置文件")
        sys.exit(1)

    # 显示更新信息
    print(f"\n📋 更新配置:")
    print(f"   - 更新模式: {args.mode}")
    print(f"   - 环境配置: {env_file}")
    print(f"   - Compose 文件: {compose_file}")

    if not confirm_action("确认要更新服务吗？"):
        print("❌ 操作已取消")
        sys.exit(0)

    # 1. 更新前备份
    if not args.no_backup:
        backup_before_update(backup_script)

    # 2. 拉取最新代码
    if not args.no_pull:
        pull_latest_code()

    # 3. 构建新镜像
    build_new_image(compose_file, env_file, args.no_cache)

    # 4. 更新服务
    if args.mode == "rolling":
        update_service_rolling(compose_file, env_file)
    else:
        update_service_recreate(compose_file, env_file)

    # 5. 等待健康检查
    if not args.skip_health_check:
        if not wait_for_healthy("ehs-app", timeout=60):
            print("\n⚠️  警告: 服务可能未正常启动")
            if args.show_logs:
                show_logs("ehs-app", lines=100)
            sys.exit(1)

    # 6. 检查服务健康
    check_service_health(env_file)

    # 7. 显示日志
    if args.show_logs:
        show_logs("ehs-app", lines=50)

    print("\n" + "=" * 60)
    print("✅ 服务更新完成！")
    print("\n💡 提示:")
    print("   - 查看日志: docker logs -f ehs-app")
    print("   - 检查状态: docker ps")
    print("   - 访问应用: http://YOUR_IP:3000")
    print("   - 如有问题，可使用备份恢复: python3 scripts/docker_restore.py --backup-dir ./backups/backup-XXXXXX")


if __name__ == "__main__":
    main()
