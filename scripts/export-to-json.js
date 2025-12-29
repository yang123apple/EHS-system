// scripts/export-to-json.js
// 从数据库导出组织架构和用户数据到JSON文件（备份核心数据）
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('开始从数据库导出核心数据到JSON文件...\n')

    // 1. 导出部门数据
    console.log('导出部门数据...')
    const departments = await prisma.department.findMany({
      orderBy: { level: 'asc' }
    })
    
    const orgPath = path.join(__dirname, '../data/org.json')
    fs.writeFileSync(orgPath, JSON.stringify(departments, null, 2), 'utf-8')
    console.log(`✓ 已导出 ${departments.length} 个部门到 data/org.json`)

    // 2. 导出用户数据
    console.log('导出用户数据...')
    const users = await prisma.user.findMany({
      include: {
        department: true
      }
    })
    
    // 转换为JSON格式（包含department名称便于阅读）
    const usersData = users.map(user => ({
      id: user.id,
      username: user.username,
      name: user.name,
      password: user.password,
      avatar: user.avatar,
      role: user.role,
      departmentId: user.departmentId,
      department: user.department?.name || '',
      jobTitle: user.jobTitle,
      directManagerId: user.directManagerId,
      permissions: user.permissions ? JSON.parse(user.permissions) : {}
    }))
    
    const usersPath = path.join(__dirname, '../data/users.json')
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2), 'utf-8')
    console.log(`✓ 已导出 ${usersData.length} 个用户到 data/users.json`)

    // 3. 创建备份（带时间戳）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const backupDir = path.join(__dirname, '../data/backups')
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }
    
    const orgBackupPath = path.join(backupDir, `org-${timestamp}.json`)
    const usersBackupPath = path.join(backupDir, `users-${timestamp}.json`)
    
    fs.writeFileSync(orgBackupPath, JSON.stringify(departments, null, 2), 'utf-8')
    fs.writeFileSync(usersBackupPath, JSON.stringify(usersData, null, 2), 'utf-8')
    
    console.log(`\n✓ 备份文件已创建:`)
    console.log(`  ${orgBackupPath}`)
    console.log(`  ${usersBackupPath}`)

    console.log(`\n=== 导出完成 ===`)
    console.log(`部门总数: ${departments.length}`)
    console.log(`用户总数: ${usersData.length}`)

  } catch (error) {
    console.error('导出失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => {
    console.log('\n导出成功完成!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('导出过程中发生错误:', error)
    process.exit(1)
  })
