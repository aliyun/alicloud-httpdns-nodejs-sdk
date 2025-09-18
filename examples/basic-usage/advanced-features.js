/**
 * HTTPDNS Node.js SDK 高级功能示例
 */

const {
  createClient,
  createHTTPDNSClient,
  QueryType,
  HTTPDNSError
} = require('../dist/index.js');

async function advancedExample() {
  console.log('=== 高级功能示例 ===\n');

  // 创建生产环境配置的客户端
  const client = createHTTPDNSClient(
    process.env.HTTPDNS_ACCOUNT_ID || 'your-account-id',
    process.env.HTTPDNS_SECRET_KEY || 'your-secret-key',
    {
      enableHTTPS: false,   // 使用HTTP避免证书问题
      timeout: 5000,
      maxRetries: 3,        // 生产环境增加重试
      logger: {
        debug: (msg, ...args) => console.log(`[DEBUG] ${msg}`, ...args),
        info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
        warn: (msg, ...args) => console.log(`[WARN] ${msg}`, ...args),
        error: (msg, ...args) => console.log(`[ERROR] ${msg}`, ...args),
      }
    }
  );

  try {
    // 1. 查询类型控制
    console.log('1. 查询类型控制示例');
    console.log('-------------------');

    const domain = 'www.aliyun.com';

    // 仅查询IPv4
    const ipv4Result = client.getHttpDnsResultForHostSyncNonBlocking(domain, {
      queryType: QueryType.IPv4
    });
    console.log(`IPv4查询结果: ${ipv4Result.ipv4.join(', ')}`);

    // 仅查询IPv6
    const ipv6Result = client.getHttpDnsResultForHostSyncNonBlocking(domain, {
      queryType: QueryType.IPv6
    });
    console.log(`IPv6查询结果: ${ipv6Result.ipv6.join(', ') || '无IPv6地址'}`);

    // 2. 超时控制
    console.log('\n2. 超时控制示例');
    console.log('---------------');

    try {
      const quickResult = client.getHttpDnsResultForHostSyncNonBlocking(domain, {
        timeout: 1000 // 1秒超时
      });
      console.log('快速解析成功:', quickResult.ipv4[0]);
    } catch (error) {
      if (error instanceof HTTPDNSError) {
        console.log('解析超时，这是正常的演示');
      }
    }

    // 4. 服务IP管理
    console.log('\n4. 服务IP管理示例');
    console.log('----------------');

    console.log('当前服务IP列表:', client.getServiceIPs());
    console.log('客户端健康状态:', client.isHealthy());

    // 更新服务IP
    try {
      await client.updateServiceIPs();
      console.log('服务IP更新成功');
      console.log('更新后的服务IP:', client.getServiceIPs());
    } catch (error) {
      console.log('服务IP更新失败:', error.message);
    }

    // 5. 错误处理示例
    console.log('\n5. 错误处理示例');
    console.log('---------------');

    try {
      // 尝试解析无效域名
      client.getHttpDnsResultForHostSyncNonBlocking('invalid..domain');
    } catch (error) {
      if (error instanceof HTTPDNSError) {
        console.log('捕获到HTTPDNS错误:');
        console.log(`  错误类型: ${error.operation}`);
        console.log(`  域名: ${error.domain}`);
        console.log(`  原始错误: ${error.originalError?.message || '无'}`);
      }
    }

    // 6. 批量解析错误处理
    console.log('\n6. 批量解析错误处理示例');
    console.log('---------------------');

    try {
      // 尝试解析过多域名（超过5个限制）
      const tooManyDomains = Array(6).fill('example.com');
      await client.resolveBatch(tooManyDomains);
    } catch (error) {
      if (error instanceof HTTPDNSError) {
        console.log('批量解析错误:', error.message);
      }
    }

  } catch (error) {
    console.error('示例执行过程中发生错误:', error);
  } finally {
    // 关闭客户端
    await client.close();
    console.log('\n客户端已关闭');
  }
}

// 重试机制示例
async function retryExample() {
  console.log('\n=== 重试机制示例 ===\n');

  // 开发环境配置：快速失败，启用日志
  const client = createHTTPDNSClient('your-account-id', undefined, {
    enableHTTPS: false,   // 开发环境使用HTTP
    timeout: 3000,        // 短超时
    maxRetries: 1,        // 少重试
    logger: console       // 启用控制台日志
  });

  async function resolveWithRetry(domain, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`尝试解析 ${domain} (第${attempt}次)`);
        const result = client.getHttpDnsResultForHostSyncNonBlocking(domain);
        console.log(`解析成功: ${result.ipv4.join(', ')}`);
        return result;
      } catch (error) {
        console.log(`第${attempt}次尝试失败: ${error.message}`);

        if (error instanceof HTTPDNSError && attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 指数退避
          console.log(`等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  try {
    await resolveWithRetry('www.aliyun.com');
  } catch (error) {
    console.log('重试机制示例完成');
  } finally {
    await client.close();
  }
}

// 缓存示例
class DNSCache {
  constructor() {
    this.cache = new Map();
  }

  async resolve(client, domain) {
    const cached = this.cache.get(domain);
    if (cached && Date.now() < cached.expiry) {
      console.log(`缓存命中: ${domain}`);
      return cached.result;
    }

    console.log(`缓存未命中，解析: ${domain}`);
    const result = client.getHttpDnsResultForHostSyncNonBlocking(domain);

    // 使用TTL作为缓存过期时间
    const expiry = Date.now() + (result.ttl * 1000);
    this.cache.set(domain, { result, expiry });

    return result;
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

async function cacheExample() {
  console.log('\n=== 缓存机制示例 ===\n');

  // 开发环境配置
  const client = createHTTPDNSClient('your-account-id', undefined, {
    timeout: 3000,
    logger: console
  });
  const cache = new DNSCache();

  try {
    const domain = 'www.aliyun.com';

    // 第一次解析（缓存未命中）
    const result1 = await cache.resolve(client, domain);
    console.log(`第一次解析结果: ${result1.ipv4[0]}, TTL: ${result1.ttl}秒`);

    // 第二次解析（缓存命中）
    const result2 = await cache.resolve(client, domain);
    console.log(`第二次解析结果: ${result2.ipv4[0]}`);

    console.log(`缓存大小: ${cache.size()}`);

  } finally {
    await client.close();
  }
}

// 运行所有示例
async function runAllExamples() {
  try {
    await advancedExample();
    await retryExample();
    await cacheExample();
  } catch (error) {
    console.error('示例运行失败:', error);
  }
}

if (require.main === module) {
  runAllExamples();
}

module.exports = {
  advancedExample,
  retryExample,
  cacheExample,
  DNSCache
};