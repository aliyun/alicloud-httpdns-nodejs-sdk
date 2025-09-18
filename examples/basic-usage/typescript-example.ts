/**
 * HTTPDNS Node.js SDK TypeScript 使用示例
 */

import {
  createClient,
  HTTPDNSClient,
  HTTPDNSConfig,
  ResolveResult,
  ResolveOptions,
  HTTPDNSError,
  Logger,
  QueryType
} from '../../dist/index.js';

// 自定义日志器实现
class CustomLogger implements Logger {
  private prefix: string;

  constructor(prefix: string = 'HTTPDNS') {
    this.prefix = prefix;
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${this.prefix} DEBUG]`, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${this.prefix} INFO]`, message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix} WARN]`, message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix} ERROR]`, message, ...args);
  }
}

// DNS服务类
class DNSService {
  private client: HTTPDNSClient;
  private logger: Logger;

  constructor(config: HTTPDNSConfig) {
    this.logger = config.logger || new CustomLogger();
    this.client = createClient(config);
  }

  /**
   * 同步阻塞解析域名（兜底方式）
   */
  async resolveDomain(
    domain: string,
    options?: ResolveOptions
  ): Promise<ResolveResult> {
    try {
      this.logger.info(`开始解析域名: ${domain}`);
      const result = await this.client.getHttpDnsResultForHostSync(domain, options);
      
      if (result.success) {
        this.logger.info(`解析成功: ${domain} -> ${result.ipv4.join(', ')}`);
      } else {
        this.logger.warn(`解析失败: ${domain} -> ${result.error?.message}`);
      }
      
      return result;
    } catch (error) {
      this.logger.error(`解析异常: ${domain}`, error);
      throw error;
    }
  }

  /**
   * 非阻塞解析域名（推荐方式）
   */
  getHttpDnsResultForHostSyncNonBlocking(
    domain: string,
    options?: ResolveOptions
  ): ResolveResult | null {
    this.logger.debug(`非阻塞解析: ${domain}`);
    const result = this.client.getHttpDnsResultForHostSyncNonBlocking(domain, options);
    
    if (result) {
      this.logger.debug(`缓存命中: ${domain} -> ${result.ipv4.join(', ')}`);
    } else {
      this.logger.debug(`缓存未命中，异步解析中: ${domain}`);
    }
    
    return result;
  }

  /**
   * 带重试的解析（使用内置重试机制）
   */
  async resolveWithRetry(
    domain: string,
    maxRetries: number = 3
  ): Promise<ResolveResult> {
    // 使用内置重试机制
    const result = await this.client.getHttpDnsResultForHostSync(domain);
    
    if (!result.success) {
      this.logger.warn(`解析失败: ${domain} -> ${result.error?.message}`);
    }
    
    return result;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
  } {
    // 注意：getCacheManager 方法在当前版本中不可用
    // 这里返回一个模拟的统计信息
    return {
      size: 0,
    };
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    await this.client.close();
    this.logger.info('DNS服务已关闭');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// DNS缓存类
class DNSCache {
  private cache = new Map<string, { result: ResolveResult; expiry: number }>();

  async resolve(
    dnsService: DNSService,
    domain: string
  ): Promise<ResolveResult> {
    const cacheKey = domain;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiry) {
      console.log(`缓存命中: ${domain}`);
      return cached.result;
    }

    console.log(`缓存未命中，解析: ${domain}`);
    const result = await dnsService.resolveDomain(domain);

    // 使用TTL作为缓存过期时间，最少缓存30秒
    const ttlMs = Math.max(result.ttl * 1000, 30000);
    const expiry = Date.now() + ttlMs;
    
    this.cache.set(cacheKey, { result, expiry });
    return result;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// 应用配置接口
interface AppConfig {
  httpdns: {
    accountId: string;
    secretKey?: string;
    enableHTTPS: boolean;
    timeout: number;
    maxRetries: number;
  };
}

// 主应用类
class HTTPDNSApp {
  private dnsService: DNSService;
  private dnsCache: DNSCache;
  constructor(config: AppConfig) {
    this.dnsCache = new DNSCache();
    
    const httpdnsConfig: HTTPDNSConfig = {
      accountId: config.httpdns.accountId,
      secretKey: config.httpdns.secretKey,
      enableHTTPS: config.httpdns.enableHTTPS,
      timeout: config.httpdns.timeout,
      maxRetries: config.httpdns.maxRetries,
      logger: new CustomLogger('APP'),
    };

    this.dnsService = new DNSService(httpdnsConfig);
  }

  /**
   * 解析域名（带缓存）
   */
  async resolve(domain: string): Promise<ResolveResult> {
    return this.dnsCache.resolve(this.dnsService, domain);
  }

  /**
   * 非阻塞解析域名
   */
  getHttpDnsResultForHostSyncNonBlocking(domain: string): ResolveResult | null {
    return this.dnsService.getHttpDnsResultForHostSyncNonBlocking(domain);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      // 测试解析功能
      const result = await this.dnsService.resolveDomain('www.aliyun.com');
      
      if (result.success) {
        console.log('健康检查通过');
        return true;
      } else {
        console.warn('健康检查失败: 解析不成功');
        return false;
      }
    } catch (error) {
      console.error('健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    cache: { size: number };
    serviceCache: { size: number };
  } {
    return {
      cache: { size: this.dnsCache.size() },
      serviceCache: this.dnsService.getCacheStats(),
    };
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.dnsCache.clear();
    await this.dnsService.close();
  }
}

// 示例函数
async function typeScriptExample(): Promise<void> {
  console.log('=== TypeScript 示例 ===\n');

  const config: AppConfig = {
    httpdns: {
      accountId: process.env.HTTPDNS_ACCOUNT_ID || 'your-account-id',
      secretKey: process.env.HTTPDNS_SECRET_KEY,
      enableHTTPS: false,
      timeout: 5000,
      maxRetries: 3,
    },
  };

  const app = new HTTPDNSApp(config);

  try {
    // 1. 非阻塞解析（推荐方式）
    console.log('1. 非阻塞解析示例（推荐方式）');
    console.log('---------------');
    
    // 第一次调用 - 缓存未命中
    let nonBlockingResult = app.getHttpDnsResultForHostSyncNonBlocking('www.taobao.com');
    console.log(`第一次调用结果: ${nonBlockingResult ? '缓存命中' : '缓存未命中'}`);
    
    // 等待异步解析完成
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 第二次调用 - 缓存命中
    nonBlockingResult = app.getHttpDnsResultForHostSyncNonBlocking('www.taobao.com');
    if (nonBlockingResult) {
      console.log(`第二次调用结果: ${nonBlockingResult.domain} -> ${nonBlockingResult.ipv4.join(', ')}`);
    }

    // 2. 同步解析（兜底方式）
    console.log('\n2. 同步解析示例（兜底方式）');
    console.log('---------------');
    
    const result1 = await app.resolve('www.aliyun.com');
    console.log(`解析结果: ${result1.domain} -> ${result1.ipv4.join(', ')}`);

    // 3. 缓存测试
    console.log('\n3. 缓存测试');
    console.log('-----------');
    
    const stats = app.getStats();
    console.log(`缓存状态: 已缓存 ${stats.serviceCache.size} 个域名`);

    // 4. 错误处理
    console.log('\n4. 错误处理');
    console.log('-----------');
    
    try {
      const errorResult = await app.resolve('invalid.domain.test');
      console.log(`错误处理结果: ${errorResult.success ? '解析成功' : '解析失败'} - ${errorResult.error?.message}`);
    } catch (error) {
      if (error instanceof HTTPDNSError) {
        console.log('捕获到HTTPDNS错误:');
        console.log(`  类型: ${error.operation}`);
        console.log(`  消息: ${error.message}`);
        console.log(`  时间戳: ${error.timestamp}`);
      }
    }

    // 5. 性能测试
    console.log('\n5. 性能测试');
    console.log('-----------');
    
    const startTime = Date.now();
    const testDomains = ['www.aliyun.com', 'www.taobao.com', 'www.tmall.com'];
    
    for (const domain of testDomains) {
      app.getHttpDnsResultForHostSyncNonBlocking(domain);
    }
    
    const avgTime = (Date.now() - startTime) / testDomains.length;
    console.log(`性能测试完成，平均耗时: ${avgTime.toFixed(2)}ms`);

  } catch (error) {
    console.error('示例执行失败:', error);
  } finally {
    await app.cleanup();
    console.log('\n应用已清理完毕');
  }
}

// 类型安全的配置验证
function validateConfig(config: any): config is AppConfig {
  return (
    config &&
    config.httpdns &&
    typeof config.httpdns.accountId === 'string' &&
    config.httpdns.accountId.length > 0
  );
}

// 运行示例
async function main(): Promise<void> {
  const config = {
    httpdns: {
      accountId: process.env.HTTPDNS_ACCOUNT_ID || 'your-account-id',
      secretKey: process.env.HTTPDNS_SECRET_KEY,
      enableHTTPS: false,
      timeout: 5000,
      maxRetries: 3,
    },
  };

  if (!validateConfig(config)) {
    console.error('配置验证失败');
    process.exit(1);
  }

  await typeScriptExample();
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  DNSService,
  DNSCache,
  HTTPDNSApp,
  CustomLogger,
  typeScriptExample,
};

export type { AppConfig };