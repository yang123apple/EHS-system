// scripts/import-from-json.js
// 从JSON文件导入组织架构和用户数据到数据库（智能合并，不删除现有数据）
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('开始从JSON文件导入核心数据到数据库...\n')

    // 读取组织架构数据
    const orgPath = path.join(__dirname, '../data/org.json')
    if (!fs.existsSync(orgPath)) {
      console.error('错误: 找不到 data/org.json 文件')
      process.exit(1)
    }
    let orgContent = fs.readFileSync(orgPath, 'utf-8')
    // 移除 BOM
    if (orgContent.charCodeAt(0) === 0xFEFF) {
      orgContent = orgContent.slice(1)
    }
    const orgData = JSON.parse(orgContent)
    
    // 读取用户数据
    const usersPath = path.join(__dirname, '../data/users.json')
    if (!fs.existsSync(usersPath)) {
      console.error('错误: 找不到 data/users.json 文件')
      process.exit(1)
    }
    let usersContent = fs.readFileSync(usersPath, 'utf-8')
    // 移除 BOM
    if (usersContent.charCodeAt(0) === 0xFEFF) {
      usersContent = usersContent.slice(1)
    }
    const usersData = JSON.parse(usersContent)

    console.log(`找到 ${orgData.length} 个部门`)
    console.log(`找到 ${usersData.length} 个用户\n`)

    // 询问用户是否要清空现有数据
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const answer = await new Promise((resolve) => {
      readline.question('是否清空现有数据后导入？(y/N): ', (ans) => {
        readline.close()
        resolve(ans.toLowerCase())
      })
    })

    if (answer === 'y' || answer === 'yes') {
      console.log('\n清理现有数据...')
      await prisma.user.deleteMany({})
      await prisma.department.deleteMany({})
      console.log('现有数据已清理\n')
    } else {
      console.log('\n将以合并模式导入（保留现有数据）\n')
    }

    // 导入部门数据（按层级顺序）
    console.log('导入部门数据...')
    const sortedDepts = orgData.sort((a, b) => a.level - b.level)
    
    let deptCreated = 0
    let deptUpdated = 0
    
    for (const dept of sortedDepts) {
      try {
        // 尝试创建或更新
        const existing = await prisma.department.findUnique({ where: { id: dept.id } })
        
        if (existing) {
          await prisma.department.update({
            where: { id: dept.id },
            data: {
              name: dept.name,
              parentId: dept.parentId,
              level: dept.level,
              managerId: dept.managerId || null,
            }
          })
          console.log(`  ↻ 更新部门: ${dept.name} (Level ${dept.level})`)
          deptUpdated++
        } else {
          await prisma.department.create({
            data: {
              id: dept.id,
              name: dept.name,
              parentId: dept.parentId,
              level: dept.level,
              managerId: dept.managerId || null,
            }
          })
          console.log(`  ✓ 创建部门: ${dept.name} (Level ${dept.level})`)
          deptCreated++
        }
      } catch (error) {
        console.error(`  ✗ 部门 ${dept.name} 导入失败:`, error.message)
      }
    }
    console.log(`部门导入完成: ${deptCreated} 个新建, ${deptUpdated} 个更新\n`)

    // 导入用户数据
    console.log('导入用户数据...')
    
    // 获取所有有效的部门ID
    const allDepts = await prisma.department.findMany()
    const validDeptIds = new Set(allDepts.map(d => d.id))
    const rootDept = allDepts.find(d => d.level === 0)
    
    let userCreated = 0
    let userUpdated = 0
    
    for (const user of usersData) {
      try {
        // 检查 departmentId 是否有效
        let departmentId = user.departmentId
        if (!validDeptIds.has(departmentId)) {
          console.log(`  ⚠ 用户 ${user.name} 的部门ID ${departmentId} 不存在，使用根部门`)
          departmentId = rootDept?.id || allDepts[0]?.id
        }
        
        // 尝试创建或更新
        const existing = await prisma.user.findUnique({ where: { id: user.id } })
        
        const userData = {
          username: user.username,
          name: user.name,
          password: user.password,
          avatar: user.avatar || '/image/default_avatar.jpg',
          role: user.role || 'user',
          departmentId: departmentId,
          jobTitle: user.jobTitle || null,
          directManagerId: user.directManagerId || null,
          permissions: JSON.stringify(user.permissions || {}),
        }
        
        if (existing) {
          await prisma.user.update({
            where: { id: user.id },
            data: userData
          })
          console.log(`  ↻ 更新用户: ${user.name} (${user.username})`)
          userUpdated++
        } else {
          await prisma.user.create({
            data: {
              id: user.id,
              ...userData
            }
          })
          console.log(`  ✓ 创建用户: ${user.name} (${user.username})`)
          userCreated++
        }
      } catch (error) {
        console.error(`  ✗ 用户 ${user.name} 导入失败:`, error.message)
      }
    }
    console.log(`用户导入完成: ${userCreated} 个新建, ${userUpdated} 个更新\n`)

    // 验证导入
    console.log('验证导入结果...')
    const deptCount = await prisma.department.count()
    const userCount = await prisma.user.count()
    
    console.log(`\n=== 导入完成 ===`)
    console.log(`部门总数: ${deptCount} (新建 ${deptCreated}, 更新 ${deptUpdated})`)
    console.log(`用户总数: ${userCount} (新建 ${userCreated}, 更新 ${userUpdated})`)
    
    // 验证admin用户
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' },
      include: { department: true }
    })
    
    if (admin) {
      console.log(`\n✓ Admin用户验证成功`)
      console.log(`  用户名: ${admin.username}`)
      console.log(`  姓名: ${admin.name}`)
      console.log(`  部门: ${admin.department?.name || '未分配'}`)
    } else {
      console.log(`\n⚠ 警告: 未找到admin用户`)
    }

  } catch (error) {
    console.error('导入失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => {
    console.log('\n导入成功完成!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('导入过程中发生错误:', error)
    process.exit(1)
  })
