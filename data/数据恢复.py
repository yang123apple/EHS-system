#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EHS 系统数据恢复工具
整合所有恢复功能到一个统一的 Python 脚本中
"""

import os
import sys
import json
import shutil
import sqlite3
import zipfile
import subprocess
import uuid
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Tuple

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
BACKUP_DIR = DATA_DIR / "backups"
PRISMA_DIR = PROJECT_ROOT / "prisma"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"

# 数据库路径
DB_PATH = PRISMA_DIR / "dev.db"
DB_WAL_PATH = PRISMA_DIR / "dev.db-wal"
DB_SHM_PATH = PRISMA_DIR / "dev.db-shm"

# 备份目录
FULL_BACKUP_DIR = BACKUP_DIR / "database" / "full"
INCREMENTAL_BACKUP_DIR = BACKUP_DIR / "database" / "incremental"
PRE_RESTORE_DIR = BACKUP_DIR / "pre_restore"


class Colors:
    """终端颜色"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """打印标题"""
    print(f"\n{Colors.BOLD}{Colors.HEADER}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{text}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.HEADER}{'=' * 60}{Colors.ENDC}\n")


def print_success(text: str):
    """打印成功信息"""
    print(f"{Colors.OKGREEN}✅ {text}{Colors.ENDC}")


def print_error(text: str):
    """打印错误信息"""
    print(f"{Colors.FAIL}❌ {text}{Colors.ENDC}")


def print_warning(text: str):
    """打印警告信息"""
    print(f"{Colors.WARNING}⚠️  {text}{Colors.ENDC}")


def print_info(text: str):
    """打印信息"""
    print(f"{Colors.OKCYAN}ℹ️  {text}{Colors.ENDC}")


def format_bytes(bytes_size: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"


def backup_current_database() -> Optional[str]:
    """备份当前数据库"""
    if not DB_PATH.exists():
        return None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = PRE_RESTORE_DIR / f"dev.db.backup.{timestamp}"
    
    PRE_RESTORE_DIR.mkdir(parents=True, exist_ok=True)
    
    try:
        shutil.copy2(DB_PATH, backup_path)
        print_success(f"当前数据库已备份到: {backup_path.name}")
        return str(backup_path)
    except Exception as e:
        print_error(f"备份当前数据库失败: {e}")
        return None


def restore_notification_templates() -> Tuple[int, int, int]:
    """
    恢复通知模板
    从 data/notification-templates.json 读取并存储到数据库
    返回: (创建数量, 跳过数量, 错误数量)
    """
    print_header("恢复通知模板")
    
    template_file = DATA_DIR / "notification-templates.json"
    
    if not template_file.exists():
        print_error(f"找不到模板文件: {template_file}")
        return (0, 0, 1)
    
    try:
        # 读取模板文件
        with open(template_file, 'r', encoding='utf-8') as f:
            content = f.read()
            # 移除 BOM
            if content.startswith('\ufeff'):
                content = content[1:]
            templates = json.loads(content)
        
        if not isinstance(templates, list):
            print_error("模板数据必须是数组格式")
            return (0, 0, 1)
        
        print_success(f"成功从文件加载 {len(templates)} 个模板配置\n")
        
        # 连接数据库
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 检查现有模板
        cursor.execute("SELECT name FROM NotificationTemplate")
        existing_names = {row[0] for row in cursor.fetchall()}
        print_info(f"当前已有 {len(existing_names)} 个模板\n")
        
        created = 0
        skipped = 0
        errors = 0
        
        # 创建或跳过模板
        for template in templates:
            # 验证必填字段
            if not all(key in template for key in ['name', 'title', 'content', 'type', 'triggerEvent']):
                print_error(f"模板数据不完整，缺少必填字段: {template.get('name', '未知')}")
                errors += 1
                continue
            
            if template['name'] in existing_names:
                print_info(f"跳过已存在的模板: {template['name']}")
                skipped += 1
                continue
            
            # 处理 JSON 字段
            trigger_condition = None
            if template.get('triggerCondition'):
                if isinstance(template['triggerCondition'], str):
                    trigger_condition = template['triggerCondition']
                else:
                    trigger_condition = json.dumps(template['triggerCondition'], ensure_ascii=False)
            
            variables = None
            if template.get('variables'):
                if isinstance(template['variables'], str):
                    variables = template['variables']
                else:
                    variables = json.dumps(template['variables'], ensure_ascii=False)
            
            try:
                # 生成唯一 ID（类似 cuid 格式）
                template_id = f"tmpl_{uuid.uuid4().hex[:12]}"
                now = datetime.now().isoformat()
                
                cursor.execute("""
                    INSERT INTO NotificationTemplate 
                    (id, name, title, content, type, triggerEvent, triggerCondition, variables, isActive, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    template_id,
                    template['name'],
                    template['title'],
                    template['content'],
                    template['type'],
                    template['triggerEvent'],
                    trigger_condition,
                    variables,
                    template.get('isActive', True),
                    now,
                    now
                ))
                conn.commit()
                print_success(f"创建模板: {template['name']} ({template['type']})")
                created += 1
            except Exception as e:
                print_error(f"创建模板失败 {template['name']}: {e}")
                errors += 1
        
        conn.close()
        
        print(f"\n恢复完成！")
        print(f"  • 创建: {created} 个")
        print(f"  • 跳过: {skipped} 个")
        print(f"  • 错误: {errors} 个")
        print(f"  • 总计: {len(existing_names) + created} 个模板\n")
        
        return (created, skipped, errors)
        
    except Exception as e:
        print_error(f"恢复通知模板失败: {e}")
        return (0, 0, 1)


def list_database_backups() -> Dict[str, List[Dict]]:
    """列出可用的数据库备份"""
    backups = {
        'full': [],
        'incremental': []
    }
    
    # 列出全量备份
    if FULL_BACKUP_DIR.exists():
        for file in FULL_BACKUP_DIR.glob("*.db"):
            stat = file.stat()
            backups['full'].append({
                'name': file.name,
                'path': str(file),
                'size': stat.st_size,
                'mtime': datetime.fromtimestamp(stat.st_mtime)
            })
        backups['full'].sort(key=lambda x: x['mtime'], reverse=True)
    
    # 列出增量备份
    if INCREMENTAL_BACKUP_DIR.exists():
        for file in INCREMENTAL_BACKUP_DIR.glob("*.wal"):
            stat = file.stat()
            backups['incremental'].append({
                'name': file.name,
                'path': str(file),
                'size': stat.st_size,
                'mtime': datetime.fromtimestamp(stat.st_mtime)
            })
        backups['incremental'].sort(key=lambda x: x['mtime'])
    
    return backups


def restore_full_backup(backup_path: str) -> bool:
    """恢复数据库全量备份"""
    print_header("恢复数据库全量备份")
    
    backup_file = Path(backup_path)
    if not backup_file.exists():
        print_error(f"备份文件不存在: {backup_path}")
        return False
    
    try:
        # 备份当前数据库
        backup_current_database()
        
        # 删除现有数据库文件
        for db_file in [DB_PATH, DB_WAL_PATH, DB_SHM_PATH]:
            if db_file.exists():
                try:
                    db_file.unlink()
                except Exception as e:
                    print_warning(f"删除 {db_file.name} 失败: {e}")
        
        # 复制备份文件
        shutil.copy2(backup_file, DB_PATH)
        print_success(f"数据库全量备份已恢复: {backup_file.name}")
        return True
        
    except Exception as e:
        print_error(f"恢复数据库失败: {e}")
        return False


def restore_from_zip(zip_path: str) -> bool:
    """从 ZIP 备份文件恢复系统"""
    print_header("从 ZIP 备份恢复系统")
    
    zip_file = Path(zip_path)
    if not zip_file.exists():
        print_error(f"备份文件不存在: {zip_path}")
        return False
    
    try:
        # 备份当前数据库
        backup_current_database()
        
        # 解压备份文件
        temp_dir = PROJECT_ROOT / "temp_restore"
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
        temp_dir.mkdir()
        
        print_info("解压备份文件...")
        with zipfile.ZipFile(zip_file, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        print_success("备份文件已解压")
        
        # 查找数据库文件
        db_source = temp_dir / "prisma" / "dev.db"
        if not db_source.exists():
            db_source = temp_dir / "dev.db"
        
        if not db_source.exists():
            print_error("备份文件中未找到数据库文件")
            return False
        
        # 恢复数据库
        PRISMA_DIR.mkdir(exist_ok=True)
        shutil.copy2(db_source, DB_PATH)
        
        # 恢复 WAL 和 SHM 文件（如果存在）
        for ext in ['-wal', '-shm']:
            wal_source = db_source.parent / f"{db_source.name}{ext}"
            if wal_source.exists():
                wal_target = PRISMA_DIR / f"dev.db{ext}"
                shutil.copy2(wal_source, wal_target)
        
        print_success("数据库文件已恢复")
        
        # 清理临时目录
        shutil.rmtree(temp_dir)
        
        return True
        
    except Exception as e:
        print_error(f"从 ZIP 恢复失败: {e}")
        return False


def restore_from_git(commit_hash: str = "HEAD") -> bool:
    """从 Git 历史恢复 JSON 文件"""
    print_header("从 Git 历史恢复数据文件")
    
    try:
        # 恢复 org.json
        print_info("恢复 data/org.json...")
        result = subprocess.run(
            ["git", "show", f"{commit_hash}:data/org.json"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )
        
        if result.returncode == 0:
            org_file = DATA_DIR / "org.json"
            with open(org_file, 'w', encoding='utf-8') as f:
                f.write(result.stdout)
            print_success("data/org.json 已恢复")
        else:
            print_warning("无法从 Git 恢复 org.json")
        
        # 恢复 users.json
        print_info("恢复 data/users.json...")
        result = subprocess.run(
            ["git", "show", f"{commit_hash}:data/users.json"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )
        
        if result.returncode == 0:
            users_file = DATA_DIR / "users.json"
            with open(users_file, 'w', encoding='utf-8') as f:
                f.write(result.stdout)
            print_success("data/users.json 已恢复")
        else:
            print_warning("无法从 Git 恢复 users.json")
        
        return True
        
    except Exception as e:
        print_error(f"从 Git 恢复失败: {e}")
        return False


def main():
    """主函数"""
    print_header("EHS 系统数据恢复工具")
    
    if len(sys.argv) < 2:
        print("使用方法:")
        print("  python data/数据恢复.py <功能> [参数]")
        print("\n可用功能:")
        print("  templates              - 恢复通知模板")
        print("  db-full [备份文件]     - 恢复数据库全量备份")
        print("  db-list                - 列出可用的数据库备份")
        print("  zip <ZIP文件>          - 从 ZIP 备份恢复系统")
        print("  git [commit_hash]      - 从 Git 恢复 JSON 文件")
        print("\n示例:")
        print("  python data/数据恢复.py templates")
        print("  python data/数据恢复.py db-full")
        print("  python data/数据恢复.py db-list")
        print("  python data/数据恢复.py zip data/backups/full_backup_xxx.zip")
        print("  python data/数据恢复.py git c4818a4")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    try:
        if command == "templates":
            restore_notification_templates()
            
        elif command == "db-full":
            backups = list_database_backups()
            if not backups['full']:
                print_error("没有找到任何全量备份")
                sys.exit(1)
            
            if len(sys.argv) > 2:
                backup_path = sys.argv[2]
            else:
                # 使用最新的备份
                latest = backups['full'][0]
                backup_path = latest['path']
                print_info(f"使用最新的备份: {latest['name']}")
                print_info(f"大小: {format_bytes(latest['size'])}")
                print_info(f"时间: {latest['mtime'].strftime('%Y-%m-%d %H:%M:%S')}\n")
            
            if restore_full_backup(backup_path):
                print_success("\n数据库恢复完成！")
                print_warning("请重启应用程序以使用恢复的数据库")
            
        elif command == "db-list":
            backups = list_database_backups()
            print_header("可用的数据库备份")
            
            if backups['full']:
                print(f"\n{Colors.BOLD}全量备份:{Colors.ENDC}")
                for i, backup in enumerate(backups['full'], 1):
                    print(f"  {i}. {backup['name']}")
                    print(f"     大小: {format_bytes(backup['size'])}")
                    print(f"     时间: {backup['mtime'].strftime('%Y-%m-%d %H:%M:%S')}")
            
            if backups['incremental']:
                print(f"\n{Colors.BOLD}增量备份:{Colors.ENDC}")
                for i, backup in enumerate(backups['incremental'], 1):
                    print(f"  {i}. {backup['name']}")
                    print(f"     大小: {format_bytes(backup['size'])}")
                    print(f"     时间: {backup['mtime'].strftime('%Y-%m-%d %H:%M:%S')}")
            
            if not backups['full'] and not backups['incremental']:
                print_error("没有找到任何备份")
            
        elif command == "zip":
            if len(sys.argv) < 3:
                print_error("请指定 ZIP 备份文件路径")
                sys.exit(1)
            
            zip_path = sys.argv[2]
            if restore_from_zip(zip_path):
                print_success("\n系统恢复完成！")
                print_warning("请重启应用程序以使用恢复的数据")
            
        elif command == "git":
            commit_hash = sys.argv[2] if len(sys.argv) > 2 else "HEAD"
            if restore_from_git(commit_hash):
                print_success("\nGit 恢复完成！")
                print_info("现在可以运行导入脚本将数据导入到数据库")
            
        else:
            print_error(f"未知命令: {command}")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n操作已取消")
        sys.exit(1)
    except Exception as e:
        print_error(f"执行失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

