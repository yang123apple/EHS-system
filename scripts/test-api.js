// 测试 API 端点
const fetch = require('node-fetch');

async function testAPI() {
  console.log('测试 API: /api/admin/notification-templates\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/admin/notification-templates');
    const data = await response.json();
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data) {
      console.log(`\n✅ API 正常，返回 ${data.data.length} 个模板`);
    } else {
      console.log('\n❌ API 返回失败');
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    console.log('\n提示: 确保应用正在运行 (npm run dev)');
  }
}

testAPI();
