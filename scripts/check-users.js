// scripts/check-users.js
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Checking users in database...\n')
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
        role: true,
        departmentId: true,
      }
    })
    
    console.log(`Found ${users.length} users:\n`)
    users.forEach(user => {
      console.log('---')
      console.log(`ID: ${user.id}`)
      console.log(`Username: ${user.username}`)
      console.log(`Name: ${user.name}`)
      console.log(`Password: ${user.password}`)
      console.log(`Role: ${user.role}`)
      console.log(`Department ID: ${user.departmentId}`)
      console.log('')
    })
    
    // Try to find admin specifically
    const admin = await prisma.user.findUnique({
      where: { username: 'admin' }
    })
    
    if (admin) {
      console.log('Admin user found!')
      console.log('Password matches "admin":', admin.password === 'admin')
    } else {
      console.log('❌ Admin user NOT found in database!')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
