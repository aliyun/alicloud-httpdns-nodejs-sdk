/**
 * HTTPDNS Node.js SDK 基础使用示例
 * 展示重构后的新API使用方式
 */

const { createClient } = require('@alicloud-emas/httpdns');

async function basicExample() {
  console.log('=== HTTPDNS SDK 基础使用示例 ===');
  
  // 创建客户端
  const client = createClient({
    accountId: 'your-account-id', // 使用你的账户ID
    // secretKey: 'your-secret-key', // 如果需要鉴权，取消注释并填入密钥
    enableCache: true,   // 启用缓存（默认启用）
    maxRetries: 2,       // 重试次数
    timeout: 8000,       // 超时时间
  });

  try {
    console.log('\n=== 同步非阻塞解析示例（推荐方式）===');
    
    // 第一次调用 - 缓存未命中，返回null并异步解析
    console.log('第一次调用getHttpDnsResultForHostSyncNonBlocking (缓存未命中)...');
    let result1 = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com');
    console.log('立即返回结果:', result1); // 应该是null
    
    // 等待异步解析完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 第二次调用 - 缓存命中，立即返回
    console.log('第二次调用getHttpDnsResultForHostSyncNonBlocking (缓存命中)...');
    result1 = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com');
    if (result1) {
      console.log('缓存命中结果:', {
        domain: result1.domain,
        ipv4: result1.ipv4,
        ipv6: result1.ipv6,
        ttl: result1.ttl,
        success: result1.success,
        source: result1.source
      });
    }

    console.log('\n=== 同步阻塞解析示例（兜底方式）===');
    console.log('解析 www.taobao.com...');
    const result2 = await client.getHttpDnsResultForHostSync('www.taobao.com');
    console.log('解析结果:', {
      domain: result2.domain,
      ipv4: result2.ipv4,
      source: result2.source
    });

    console.log('\n=== 批量解析示例 ===');
    
    const domains = ['www.aliyun.com', 'www.taobao.com', 'www.tmall.com'];
    console.log('批量解析结果:');
    
    for (const domain of domains) {
      const result = client.getHttpDnsResultForHostSyncNonBlocking(domain);
      if (result && result.ipv4.length > 0) {
        console.log(`${domain} -> ${result.ipv4.join(',')}`);
      } else {
        console.log(`${domain} -> 缓存未命中`);
      }
    }

    console.log('\n=== 错误处理示例 ===');
    
    console.log('解析失败域名: invalid.domain.test');
    const errorResult = await client.getHttpDnsResultForHostSync('invalid.domain.test');
    console.log('解析结果:', {
      domain: errorResult.domain,
      ipv4: errorResult.ipv4,
      ipv6: errorResult.ipv6,
      ipv4Ttl: errorResult.ipv4Ttl,
      ipv6Ttl: errorResult.ipv6Ttl,
      ipv4Timestamp: errorResult.ipv4Timestamp,
      ipv6Timestamp: errorResult.ipv6Timestamp
    });
    
  } catch (error) {
    console.error('解析过程中发生错误:', error.message);
    
    // 检查错误类型
    if (error.name === 'HTTPDNSError') {
      console.log('错误详情:');
      console.log('  操作类型:', error.operation);
      console.log('  域名:', error.domain);
      console.log('  时间戳:', error.timestamp);
    }
  } finally {
    // 关闭客户端
    await client.close();
    console.log('\n客户端已关闭');
    
    console.log('\n=== 新功能说明 ===');
    console.log('- getHttpDnsResultForHostSync: 同步阻塞解析，先查缓存，缓存未命中时网络解析');
    console.log('- getHttpDnsResultForHostSyncNonBlocking: 同步非阻塞解析，缓存命中立即返回，未命中返回null并异步解析');
    console.log('- 内置缓存: 自动缓存解析结果，支持TTL过期');
    console.log('- 重试机制: 网络失败时自动重试，支持服务IP切换');
    console.log('- 错误处理: 统一的错误格式，便于调试和监控');
  }
}

// 运行示例
if (require.main === module) {
  basicExample().catch(console.error);
}

module.exports = { basicExample };