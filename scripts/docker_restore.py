#!/usr/bin/env python3
"""
EHS 系统数据恢复脚本
用于恢复备份的数据库和文件到 Docker 容器
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """执行命令并返回结果"""
    print(f"+ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def confirm_action(message: str) -> bool:
    """确认操作"""
    response = input(f"\n⚠️  {message} (yes/no): ").strip().lower()
    return response in ["yes", "y"]


def stop_services(compose_file: Path, env_file: Path):
    """停止 Docker 服务"""
    print("\n🛑 停止 Docker 服务...")
    run_command([
        "docker", "compose",
        "--env-file", str(env_file),
        "-f", str(compose_file),
        "down"
    ])
    print("✅ 服务已停止")


def restore_database(backup_file: Path, container_name: str = "ehs-app"):
    """恢复数据库文件"""
    print(f"\n📥 恢复数据库: {backup_file.name}")

    if not backup_file.exists():
        print(f"❌ 错误: 备份文件不存在: {backup_file}")
        sys.exit(1)

    # 恢复到本地目录
    local_db_dir = Path("./data/db")
    local_db_dir.mkdir(parents=True, exist_ok=True)
    local_db = local_db_dir / "ehs.db"

    import shutil
    shutil.copy2(backup_file, local_db)
    print(f"✅ 数据库已恢复到: {local_db}")


def restore_minio_data(backup_file: Path):
    """恢复 MinIO 数据"""
    print(f"\n📥 恢复 MinIO 数据: {backup_file.name}")

    if not backup_file.exists():
        print(f"⚠️  警告: 备份文件不存在: {backup_file}")
        return

    # 清空现有 MinIO 数据
    minio_data_dir = Path("./data/minio-data")
    if minio_data_dir.exists():
        if confirm_action("是否删除现有 MinIO 数据？"):
            import shutil
            shutil.rmtree(minio_data_dir)
            print("✅ 已删除现有 MinIO 数据")

    # 解压备份文件
    run_command([
        "tar", "-xzf", str(backup_file),
        "-C", "./data"
    ])
    print(f"✅ MinIO 数据已恢复")


def restore_uploads(backup_file: Path):
    """恢复上传文件"""
    print(f"\n📥 恢复上传文件: {backup_file.name}")

    if not backup_file.exists():
        print(f"⚠️  警告: 备份文件不存在: {backup_file}")
        return

    # 清空现有上传文件
    uploads_dir = Path("./public/uploads")
    if uploads_dir.exists():
        if confirm_action("是否删除现有上传文件？"):
            import shutil
            shutil.rmtree(uploads_dir)
            print("✅ 已删除现有上传文件")

    # 解压备份文件
    uploads_dir.parent.mkdir(parents=True, exist_ok=True)
    run_command([
        "tar", "-xzf", str(backup_file),
        "-C", "./public"
    ])
    print(f"✅ 上传文件已恢复")


def restore_env_config(backup_file: Path):
    """恢复环境配置文件"""
    print(f"\n📥 恢复环境配置: {backup_file.name}")

    if not backup_file.exists():
        print(f"⚠️  警告: 备份文件不存在: {backup_file}")
        return

    target_file = Path(".env.docker.local")
    if target_file.exists():
        if not confirm_action(f"是否覆盖现有配置文件 {target_file}？"):
            print("⏭️  跳过环境配置恢复")
            return

    import shutil
    shutil.copy2(backup_file, target_file)
    print(f"✅ 环境配置已恢复到: {target_file}")


def start_services(compose_file: Path, env_file: Path):
    """启动 Docker 服务"""
    print("\n🚀 启动 Docker 服务...")
    run_command([
        "docker", "compose",
        "--env-file", str(env_file),
        "-f", str(compose_file),
        "up", "-d"
    ])
    print("✅ 服务已启动")


def main():
    parser = argparse.ArgumentParser(description="恢复 EHS 系统数据")
    parser.add_argument(
        "--backup-dir",
        type=str,
        required=True,
        help="备份目录路径 (例如: ./backups/backup-20260128-120000)"
    )
    parser.add_argument(
        "--container",
        type=str,
        default="ehs-app",
        help="容器名称 (默认: ehs-app)"
    )
    parser.add_argument(
        "--skip-minio",
        action="store_true",
        help="跳过 MinIO 数据恢复"
    )
    parser.add_argument(
        "--skip-uploads",
        action="store_true",
        help="跳过上传文件恢复"
    )
    parser.add_argument(
        "--skip-env",
        action="store_true",
        help="跳过环境配置恢复"
    )
    parser.add_argument(
        "--no-restart",
        action="store_true",
        help="不自动重启服务"
    )

    args = parser.parse_args()

    backup_dir = Path(args.backup_dir)
    if not backup_dir.exists():
        print(f"❌ 错误: 备份目录不存在: {backup_dir}")
        sys.exit(1)

    print(f"\n🚀 开始恢复 EHS 系统数据")
    print(f"📁 备份目录: {backup_dir}")
    print("=" * 60)

    # 显示备份清单
    manifest_file = backup_dir / "backup-manifest.txt"
    if manifest_file.exists():
        print("\n📋 备份清单:")
        with open(manifest_file) as f:
            print(f.read())
    else:
        print("⚠️  警告: 找不到备份清单文件")

    # 确认恢复操作
    if not confirm_action("确认要恢复这个备份吗？这将覆盖现有数据！"):
        print("❌ 操作已取消")
        sys.exit(0)

    # 停止服务
    compose_file = Path("docker-compose.prod.yml")
    env_file = Path(".env.docker.local")
    if not env_file.exists():
        env_file = Path(".env.docker")

    if not args.no_restart:
        try:
            stop_services(compose_file, env_file)
        except Exception as e:
            print(f"⚠️  警告: 停止服务失败: {e}")

    # 查找备份文件
    db_files = list(backup_dir.glob("ehs-db-*.db"))
    minio_files = list(backup_dir.glob("minio-data-*.tar.gz"))
    uploads_files = list(backup_dir.glob("uploads-*.tar.gz"))
    env_files = list(backup_dir.glob("env-config-*.txt"))

    # 恢复数据库
    if db_files:
        restore_database(db_files[0], args.container)
    else:
        print("⚠️  警告: 找不到数据库备份文件")

    # 恢复 MinIO 数据
    if not args.skip_minio and minio_files:
        restore_minio_data(minio_files[0])

    # 恢复上传文件
    if not args.skip_uploads and uploads_files:
        restore_uploads(uploads_files[0])

    # 恢复环境配置
    if not args.skip_env and env_files:
        restore_env_config(env_files[0])

    # 启动服务
    if not args.no_restart:
        start_services(compose_file, env_file)

        print("\n⏳ 等待服务启动...")
        import time
        time.sleep(5)

        # 检查服务状态
        print("\n📊 检查服务状态:")
        run_command([
            "docker", "compose",
            "--env-file", str(env_file),
            "-f", str(compose_file),
            "ps"
        ], check=False)

    print("\n" + "=" * 60)
    print("✅ 恢复完成！")
    print("\n💡 提示:")
    print("   - 查看日志: docker logs -f ehs-app")
    print("   - 检查健康: curl http://localhost:3000/api/health")
    print("   - 访问应用: http://YOUR_IP:3000")


if __name__ == "__main__":
    main()
