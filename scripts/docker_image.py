#!/usr/bin/env python3
"""
EHS 系统 Docker 镜像导出/导入脚本
用于在没有网络或 Docker Registry 的情况下传输镜像
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def run_command(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """执行命令并返回结果"""
    print(f"+ {' '.join(cmd)}")
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def export_image(image_name: str, output_dir: Path):
    """导出 Docker 镜像"""
    print(f"\n📦 导出 Docker 镜像: {image_name}")

    # 检查镜像是否存在
    result = run_command([
        "docker", "images", "-q", image_name
    ], check=False)

    if not result.stdout.strip():
        print(f"❌ 错误: 镜像 {image_name} 不存在")
        print("\n💡 提示: 先构建镜像")
        print(f"   docker compose -f docker-compose.prod.yml build")
        sys.exit(1)

    # 创建输出目录
    output_dir.mkdir(parents=True, exist_ok=True)

    # 生成文件名
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    safe_name = image_name.replace(":", "-").replace("/", "-")
    output_file = output_dir / f"{safe_name}-{timestamp}.tar"

    print(f"📁 输出文件: {output_file}")

    # 导出镜像
    print("⏳ 导出中，请稍候...")
    with open(output_file, "wb") as f:
        result = run_command([
            "docker", "save", image_name
        ], check=False)
        f.write(result.stdout.encode() if isinstance(result.stdout, str) else result.stdout)

    # 使用正确的方式导出
    run_command([
        "docker", "save",
        "-o", str(output_file),
        image_name
    ])

    # 获取文件大小
    size_bytes = output_file.stat().st_size
    size_mb = size_bytes / (1024 * 1024)

    print(f"✅ 镜像已导出")
    print(f"   文件: {output_file}")
    print(f"   大小: {size_mb:.2f} MB")

    # 压缩镜像文件
    print("\n🗜️  压缩镜像文件...")
    compressed_file = output_file.with_suffix(".tar.gz")
    run_command([
        "gzip", "-f", str(output_file)
    ])

    # 重命名为 .tar.gz
    gzipped_file = Path(str(output_file) + ".gz")
    if gzipped_file.exists():
        gzipped_file.rename(compressed_file)

    compressed_size_mb = compressed_file.stat().st_size / (1024 * 1024)
    compression_ratio = (1 - compressed_size_mb / size_mb) * 100

    print(f"✅ 压缩完成")
    print(f"   文件: {compressed_file}")
    print(f"   大小: {compressed_size_mb:.2f} MB")
    print(f"   压缩率: {compression_ratio:.1f}%")

    return compressed_file


def import_image(image_file: Path):
    """导入 Docker 镜像"""
    print(f"\n📥 导入 Docker 镜像: {image_file}")

    if not image_file.exists():
        print(f"❌ 错误: 文件不存在: {image_file}")
        sys.exit(1)

    # 如果是压缩文件，先解压
    if image_file.suffix == ".gz":
        print("🗜️  解压镜像文件...")
        decompressed_file = image_file.with_suffix("")
        run_command([
            "gunzip", "-c", str(image_file)
        ])
        # 使用管道解压并导入
        print("⏳ 导入中，请稍候...")
        subprocess.run(
            f"gunzip -c {image_file} | docker load",
            shell=True,
            check=True
        )
    else:
        # 直接导入
        print("⏳ 导入中，请稍候...")
        run_command([
            "docker", "load",
            "-i", str(image_file)
        ])

    print("✅ 镜像已导入")

    # 显示导入的镜像
    print("\n📋 已导入的镜像:")
    run_command(["docker", "images"], check=False)


def list_images():
    """列出所有镜像"""
    print("\n📋 本地 Docker 镜像:")
    result = run_command([
        "docker", "images",
        "--format", "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    ], check=False)
    print(result.stdout)


def main():
    parser = argparse.ArgumentParser(description="导出/导入 EHS 系统 Docker 镜像")
    subparsers = parser.add_subparsers(dest="command", help="命令")

    # 导出命令
    export_parser = subparsers.add_parser("export", help="导出镜像")
    export_parser.add_argument(
        "--image",
        type=str,
        default="ehs-system:prod",
        help="镜像名称 (默认: ehs-system:prod)"
    )
    export_parser.add_argument(
        "--output-dir",
        type=str,
        default="/Users/yangguang/Desktop/EHS/docker-images",
        help="输出目录 (默认: /Users/yangguang/Desktop/EHS/docker-images)"
    )

    # 导入命令
    import_parser = subparsers.add_parser("import", help="导入镜像")
    import_parser.add_argument(
        "image_file",
        type=str,
        help="镜像文件路径 (支持 .tar 或 .tar.gz)"
    )

    # 列表命令
    subparsers.add_parser("list", help="列出本地镜像")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    print("🚀 EHS 系统 Docker 镜像管理工具")
    print("=" * 60)

    if args.command == "export":
        output_file = export_image(args.image, Path(args.output_dir))
        print("\n" + "=" * 60)
        print("✅ 导出完成！")
        print(f"\n💡 传输到服务器:")
        print(f"   scp {output_file} user@server:/path/to/destination/")
        print(f"\n💡 在服务器上导入:")
        print(f"   python3 scripts/docker_image.py import {output_file.name}")

    elif args.command == "import":
        import_image(Path(args.image_file))
        print("\n" + "=" * 60)
        print("✅ 导入完成！")
        print("\n💡 启动服务:")
        print("   python3 scripts/docker_oneclick.py")

    elif args.command == "list":
        list_images()


if __name__ == "__main__":
    main()
