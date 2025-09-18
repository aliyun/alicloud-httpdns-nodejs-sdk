/**
 * 简化后的API使用示例
 * 展示两种创建客户端的方式
 */

const { createClient, createHTTPDNSClient } = require('../dist/index');

async function main() {
  console.log('=== 简化后的API示例 ===\n');

  // 方式1: 使用createClient传入完整配置对象
  console.log('1. 使用createClient (完整配置)');
  const client1 = createClient({
    accountId: 'your-account-id',
    secretKey: 'your-secret-key',
    enableHTTPS: true,
    maxRetries: 2,
    timeout: 8000,
    logger: console
  });

  try {
    const result1 = await client1.getHttpDnsResultForHostSync('baidu.com');
    console.log('解析结果:', {
      domain: result1.domain,
      ipv4: result1.ipv4,
      ipv6: result1.ipv6
    });
  } catch (error) {
    console.log('解析失败:', error.message);
  } finally {
    await client1.close();
  }

  console.log('\n');

  // 方式2: 使用createHTTPDNSClient便捷方法
  console.log('2. 使用createHTTPDNSClient (便捷方法)');

  // 基础使用 - 只传accountId
  const client2 = createHTTPDNSClient('your-account-id');

  try {
    const result2 = await client2.getHttpDnsResultForHostSync('aliyun.com');
    console.log('基础解析结果:', {
      domain: result2.domain,
      ipv4: result2.ipv4,
      ipv6: result2.ipv6
    });
  } catch (error) {
    console.log('解析失败:', error.message);
  } finally {
    await client2.close();
  }

  console.log('\n');

  // 带鉴权和自定义配置
  console.log('3. 使用createHTTPDNSClient (带鉴权和配置)');
  const client3 = createHTTPDNSClient('your-account-id', 'your-secret-key', {
    enableHTTPS: true,
    maxRetries: 3,
    timeout: 6000
  });

  try {
    const result3 = await client3.getHttpDnsResultForHostSync('taobao.com');
    console.log('鉴权解析结果:', {
      domain: result3.domain,
      ipv4: result3.ipv4,
      ipv6: result3.ipv6
    });
  } catch (error) {
    console.log('解析失败:', error.message);
  } finally {
    await client3.close();
  }

  console.log('\n=== 默认配置说明 ===');
  console.log('默认配置:');
  console.log('- timeout: 5000ms (5秒)');
  console.log('- maxRetries: 0 (不重试，避免频率限制)');
  console.log('- enableHTTPS: false (默认HTTP)');

}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };