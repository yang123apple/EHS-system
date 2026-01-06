// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1. 创建根部门
  const rootDept = await prisma.department.create({
    data: {
      id: 'dept_root',
      name: 'XX新能源科技有限公司',
      level: 1,
    }
  })

  // 2. 创建 EHS 部
  const ehsDept = await prisma.department.create({
    data: {
      id: 'dept_ehs',
      name: 'EHS部',
      parentId: 'dept_root',
      level: 2,
    }
  })

  // 3. 创建管理员
  const admin = await prisma.user.create({
    data: {
      id: '88888888',
      username: 'admin',
      name: '超级管理员',
      password: 'admin', // 生产环境请加密
      role: 'admin',
      departmentId: 'dept_ehs',
      jobTitle: 'EHS总监',
      permissions: JSON.stringify({ all: ['all'] }),
      avatar: '/image/default_avatar.jpg'
    }
  })

  // 关联部门负责人
  await prisma.department.update({
    where: { id: 'dept_root' },
    data: { managerId: admin.id }
  })

  await prisma.department.update({
    where: { id: 'dept_ehs' },
    data: { managerId: admin.id }
  })

  // 4. 初始化隐患配置
  await prisma.hazardConfig.upsert({
    where: { key: 'hazard_types' },
    update: {},
    create: {
      key: 'hazard_types',
      value: JSON.stringify(['火灾', '爆炸', '中毒', '窒息', '触电', '机械伤害']),
      description: '隐患分类配置'
    }
  })

  await prisma.hazardConfig.upsert({
    where: { key: 'hazard_areas' },
    update: {},
    create: {
      key: 'hazard_areas',
      value: JSON.stringify(['施工现场', '仓库', '办公室', '车间', '其他']),
      description: '发现区域配置'
    }
  })

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
