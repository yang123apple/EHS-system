数据恢复工具说明
================

文件位置: data/data_restore.py
（由于 Windows 编码限制，使用英文文件名，功能完全相同）

使用方法:
---------
python data/data_restore.py <功能> [参数]

可用功能:
---------
1. templates              - 恢复通知模板
   从 data/notification-templates.json 读取并存储到数据库

2. db-full [备份文件]     - 恢复数据库全量备份
   如果不指定备份文件，将自动使用最新的备份

3. db-list                - 列出可用的数据库备份
   显示所有可用的全量备份和增量备份

4. zip <ZIP文件>          - 从 ZIP 备份恢复系统
   从全量备份 ZIP 文件恢复数据库和文件

5. git [commit_hash]      - 从 Git 恢复 JSON 文件
   从 Git 历史恢复 org.json 和 users.json 文件

示例:
-----
# 恢复通知模板
python data/data_restore.py templates

# 恢复最新的数据库备份
python data/data_restore.py db-full

# 恢复指定的数据库备份
python data/data_restore.py db-full data/backups/database/full/full_2026-01-06_13-31-22.db

# 列出所有备份
python data/data_restore.py db-list

# 从 ZIP 恢复
python data/data_restore.py zip data/backups/full_backup_xxx.zip

# 从 Git 恢复
python data/data_restore.py git c4818a4

注意事项:
---------
1. 恢复数据库前会自动备份当前数据库到 data/backups/pre_restore/
2. 恢复完成后需要重启应用程序
3. 通知模板恢复会跳过已存在的模板，避免覆盖用户自定义内容

