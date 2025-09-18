/**
 * 大批量域名解析示例
 * 演示超过5个域名的批量解析功能
 */

const { createClient } = require('../dist/index.js');

async function largeBatchExample() {
  console.log('=== 大批量域名解析示例 ===\n');

  const client = createClient({
    accountId: process.env.HTTPDNS_ACCOUNT_ID || 'your-account-id'
  });

  try {
    // 测试大批量域名解析（超过5个）
    const largeDomainList = [
      'www.aliyun.com',
      'www.taobao.com', 
      'www.tmall.com',
      'www.1688.com',
      'www.alibaba.com',
      'www.aliexpress.com',
      'www.alipay.com',
      'www.dingtalk.com',
      'www.cainiao.com',
      'www.ele.me'
    ];

    console.log(`批量解析 ${largeDomainList.length} 个域名:`);
    console.log(largeDomainList.join(', '));
    console.log('\n开始解析...\n');

    const startTime = Date.now();
    const results = await client.resolveBatch(largeDomainList);
    const endTime = Date.now();

    console.log(`解析完成，耗时: ${endTime - startTime}ms\n`);

    // 显示结果统计
    const successCount = results.filter(r => !r.error && (r.ipv4.length > 0 || r.ipv6.length > 0)).length;
    const failureCount = results.length - successCount;

    console.log('=== 解析结果统计 ===');
    console.log(`总域名数: ${results.length}`);
    console.log(`成功解析: ${successCount}`);
    console.log(`解析失败: ${failureCount}`);
    console.log(`成功率: ${((successCount / results.length) * 100).toFixed(1)}%\n`);

    // 显示详细结果
    console.log('=== 详细解析结果 ===');
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.domain}:`);
      if (result.error) {
        console.log(`   ❌ 解析失败: ${result.error.message}`);
      } else {
        console.log(`   ✅ IPv4: ${result.ipv4.join(', ') || '无'}`);
        console.log(`   ✅ IPv6: ${result.ipv6.join(', ') || '无'}`);
        console.log(`   ⏱️  TTL: ${result.ttl}秒`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('批量解析过程中发生错误:', error.message);
  } finally {
    await client.close();
    console.log('客户端已关闭');
  }
}

// 运行示例
if (require.main === module) {
  largeBatchExample().catch(console.error);
}

module.exports = { largeBatchExample };