/**
 * 为所有现有培训材料生成缩略图
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateThumbnails() {
  console.log('🎨 开始为所有培训材料生成缩略图...\n');

  try {
    // 获取所有没有缩略图的材料
    const materials = await prisma.trainingMaterial.findMany({
      where: {
        OR: [
          { thumbnail: null },
          { thumbnail: '' }
        ]
      }
    });

    console.log(`📊 找到 ${materials.length} 个需要生成缩略图的材料\n`);

    let successCount = 0;
    let failCount = 0;

    for (const material of materials) {
      console.log(`处理: ${material.title} (${material.type})`);
      
      try {
        // 调用缩略图生成 API
        const response = await fetch(`http://localhost:3000/api/training/materials/${material.id}/thumbnail`, {
          method: 'POST'
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ 成功: ${data.thumbnailUrl || '使用占位图'}\n`);
          successCount++;
        } else {
          const error = await response.text();
          console.log(`❌ 失败: ${error}\n`);
          failCount++;
        }
      } catch (error) {
        console.log(`❌ 失败: ${error.message}\n`);
        failCount++;
      }

      // 添加延迟避免过载
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n========================================');
    console.log('📊 缩略图生成完成');
    console.log(`✅ 成功: ${successCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ 生成缩略图时出错:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generateThumbnails();
