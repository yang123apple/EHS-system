// scripts/auto-backup.js
// 自动备份核心数据并清理30天前的旧备份
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function autoBackup() {
  try {
    console.log('[自动备份] 开始执行每日自动备份...\n')

    // 1. 导出部门数据
    const departments = await prisma.department.findMany({
      orderBy: { level: 'asc' }
    })
    
    // 2. 导出用户数据
    const users = await prisma.user.findMany({
      include: { department: true }
    })
    
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

    // 3. 更新主文件
    const orgPath = path.join(__dirname, '../data/org.json')
    const usersPath = path.join(__dirname, '../data/users.json')
    
    fs.writeFileSync(orgPath, JSON.stringify(departments, null, 2), 'utf-8')
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2), 'utf-8')
    
    console.log(`✓ 已更新 data/org.json (${departments.length} 个部门)`)
    console.log(`✓ 已更新 data/users.json (${usersData.length} 个用户)`)

    // 4. 创建带时间戳的备份
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

    // 5. 清理30天前的备份
    console.log(`\n[清理旧备份] 删除30天前的备份文件...`)
    const files = fs.readdirSync(backupDir)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    let deletedCount = 0
    
    files.forEach(file => {
      const filePath = path.join(backupDir, file)
      const stats = fs.statSync(filePath)
      
      if (stats.mtimeMs < thirtyDaysAgo && file.endsWith('.json')) {
        fs.unlinkSync(filePath)
        console.log(`  ✓ 删除: ${file}`)
        deletedCount++
      }
    })
    
    if (deletedCount === 0) {
      console.log(`  没有需要清理的旧备份`)
    } else {
      console.log(`  共删除 ${deletedCount} 个旧备份文件`)
    }

    console.log(`\n[自动备份] 备份完成！`)
    console.log(`部门总数: ${departments.length}`)
    console.log(`用户总数: ${usersData.length}`)
    console.log(`备份时间: ${new Date().toLocaleString('zh-CN')}`)

  } catch (error) {
    console.error('[自动备份] 备份失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 如果直接运行脚本
if (require.main === module) {
  autoBackup()
    .then(() => {
      console.log('\n备份任务执行成功!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('备份任务执行失败:', error)
      process.exit(1)
    })
}

module.exports = { autoBackup }
