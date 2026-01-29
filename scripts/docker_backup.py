#!/usr/bin/env python3
"""
EHS 系统数据备份脚本
用于备份 Docker 容器中的数据库和文件
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """执行命令并返回结果"""
    print(f"+ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def backup_database(backup_dir: Path, container_name: str = "ehs-app") -> Path:
    """备份数据库文件"""
    print("\n📦 备份数据库...")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    db_backup_file = backup_dir / f"ehs-db-{timestamp}.db"

    # 从容器中复制数据库文件
    result = run_command([
        "docker", "cp",
        f"{container_name}:/app/data/db/ehs.db",
        str(db_backup_file)
    ], check=False)

    if result.returncode != 0:
        print(f"⚠️  警告: 无法从容器复制数据库，尝试从本地目录备份...")
        local_db = Path("./data/db/ehs.db")
        if local_db.exists():
            import shutil
            shutil.copy2(local_db, db_backup_file)
        else:
            print("❌ 错误: 找不到数据库文件")
            sys.exit(1)

    print(f"✅ 数据库已备份到: {db_backup_file}")
    return db_backup_file


def backup_minio_data(backup_dir: Path) -> Path:
    """备份 MinIO 数据"""
    print("\n📦 备份 MinIO 数据...")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    minio_backup_file = backup_dir / f"minio-data-{timestamp}.tar.gz"

    minio_data_dir = Path("./data/minio-data")
    if not minio_data_dir.exists():
        print("⚠️  警告: MinIO 数据目录不存在，跳过备份")
        return None

    # 使用 tar 压缩 MinIO 数据
    run_command([
        "tar", "-czf", str(minio_backup_file),
        "-C", "./data", "minio-data"
    ])

    print(f"✅ MinIO 数据已备份到: {minio_backup_file}")
    return minio_backup_file


def backup_uploads(backup_dir: Path) -> Path:
    """备份上传文件"""
    print("\n📦 备份上传文件...")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    uploads_backup_file = backup_dir / f"uploads-{timestamp}.tar.gz"

    uploads_dir = Path("./public/uploads")
    if not uploads_dir.exists() or not any(uploads_dir.iterdir()):
        print("⚠️  警告: 上传目录为空，跳过备份")
        return None

    # 使用 tar 压缩上传文件
    run_command([
        "tar", "-czf", str(uploads_backup_file),
        "-C", "./public", "uploads"
    ])

    print(f"✅ 上传文件已备份到: {uploads_backup_file}")
    return uploads_backup_file


def backup_env_config(backup_dir: Path) -> Path:
    """备份环境配置文件"""
    print("\n📦 备份环境配置...")

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    env_backup_file = backup_dir / f"env-config-{timestamp}.txt"

    env_file = Path(".env.docker.local")
    if not env_file.exists():
        env_file = Path(".env.docker")

    if env_file.exists():
        import shutil
        shutil.copy2(env_file, env_backup_file)
        print(f"✅ 环境配置已备份到: {env_backup_file}")
        return env_backup_file
    else:
        print("⚠️  警告: 找不到环境配置文件")
        return None


def create_backup_manifest(backup_dir: Path, files: dict[str, Path]) -> Path:
    """创建备份清单文件"""
    manifest_file = backup_dir / "backup-manifest.txt"

    with open(manifest_file, "w") as f:
        f.write(f"EHS 系统备份清单\n")
        f.write(f"备份时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"=" * 60 + "\n\n")

        for name, path in files.items():
            if path and path.exists():
                size = path.stat().st_size
                size_mb = size / (1024 * 1024)
                f.write(f"{name}:\n")
                f.write(f"  文件: {path.name}\n")
                f.write(f"  大小: {size_mb:.2f} MB\n")
                f.write(f"  路径: {path}\n\n")

    print(f"\n📋 备份清单已创建: {manifest_file}")
    return manifest_file


def main():
    parser = argparse.ArgumentParser(description="备份 EHS 系统数据")
    parser.add_argument(
        "--backup-dir",
        type=str,
        default="./backups",
        help="备份目录路径 (默认: ./backups)"
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
        help="跳过 MinIO 数据备份"
    )
    parser.add_argument(
        "--skip-uploads",
        action="store_true",
        help="跳过上传文件备份"
    )

    args = parser.parse_args()

    # 创建备份目录
    backup_dir = Path(args.backup_dir)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_session_dir = backup_dir / f"backup-{timestamp}"
    backup_session_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n🚀 开始备份 EHS 系统数据")
    print(f"📁 备份目录: {backup_session_dir}")
    print("=" * 60)

    backup_files = {}

    # 备份数据库
    try:
        db_file = backup_database(backup_session_dir, args.container)
        backup_files["数据库"] = db_file
    except Exception as e:
        print(f"❌ 数据库备份失败: {e}")
        sys.exit(1)

    # 备份 MinIO 数据
    if not args.skip_minio:
        try:
            minio_file = backup_minio_data(backup_session_dir)
            if minio_file:
                backup_files["MinIO 数据"] = minio_file
        except Exception as e:
            print(f"⚠️  MinIO 数据备份失败: {e}")

    # 备份上传文件
    if not args.skip_uploads:
        try:
            uploads_file = backup_uploads(backup_session_dir)
            if uploads_file:
                backup_files["上传文件"] = uploads_file
        except Exception as e:
            print(f"⚠️  上传文件备份失败: {e}")

    # 备份环境配置
    try:
        env_file = backup_env_config(backup_session_dir)
        if env_file:
            backup_files["环境配置"] = env_file
    except Exception as e:
        print(f"⚠️  环境配置备份失败: {e}")

    # 创建备份清单
    create_backup_manifest(backup_session_dir, backup_files)

    print("\n" + "=" * 60)
    print("✅ 备份完成！")
    print(f"📁 备份位置: {backup_session_dir}")
    print("\n💡 提示:")
    print(f"   - 恢复数据: python3 scripts/docker_restore.py --backup-dir {backup_session_dir}")
    print(f"   - 查看清单: cat {backup_session_dir}/backup-manifest.txt")


if __name__ == "__main__":
    main()
