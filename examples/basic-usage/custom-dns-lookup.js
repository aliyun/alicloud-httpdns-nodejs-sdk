/**
 * 自定义 DNS Lookup 示例
 * 
 * 演示如何创建自定义的 DNS lookup 函数，可以与任何支持自定义 lookup 的 HTTP 客户端集成
 */

const dns = require('dns');
const https = require('https');
const http = require('http');
const { createClient } = require('../dist/index.js');

class CustomDNSLookup {
  constructor(httpdnsConfig = {}) {
    // 创建 HTTPDNS 客户端
    this.httpdnsClient = createClient({
      accountId: httpdnsConfig.accountId || 'your-account-id',
      secretKey: httpdnsConfig.secretKey || 'your-secret-key',
      timeout: httpdnsConfig.timeout || 5000,
      maxRetries: httpdnsConfig.maxRetries || 2,
    });
    
    // 缓存解析结果（简单的内存缓存）
    this.cache = new Map();
    this.cacheTimeout = httpdnsConfig.cacheTimeout || 60000; // 1分钟缓存
    
    console.log('[HTTPDNS] 自定义 DNS Lookup 初始化完成');
  }

  /**
   * 自定义 lookup 函数，兼容 Node.js dns.lookup 接口
   */
  async lookup(hostname, options, callback) {
    // 标准化参数
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    const family = options.family || 4;
    const all = options.all || false;

    try {
      console.log(`[HTTPDNS] 开始解析域名: ${hostname}`);
      
      // 检查缓存
      const cacheKey = `${hostname}:${family}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`[HTTPDNS] 使用缓存结果: ${hostname} -> ${cached.ip}`);
        return this.formatResult(cached.ip, family, all, callback);
      }
      
      // 使用 HTTPDNS 解析域名
      const result = await this.httpdnsClient.getHttpDnsResultForHostSync(hostname);
      
      if (result.success && result.ipv4 && result.ipv4.length > 0) {
        const ip = result.ipv4[0]; // 使用第一个 IP
        console.log(`[HTTPDNS] 解析成功: ${hostname} -> ${ip}`);
        
        // 缓存结果
        this.cache.set(cacheKey, {
          ip: ip,
          timestamp: Date.now()
        });
        
        return this.formatResult(ip, family, all, callback);
      } else {
        console.log(`[HTTPDNS] 解析结果为空，降级到系统 DNS: ${hostname}`);
        return this.fallbackToSystemDNS(hostname, options, callback);
      }
    } catch (error) {
      console.warn(`[HTTPDNS] 解析失败: ${error.message}，降级到系统 DNS`);
      return this.fallbackToSystemDNS(hostname, options, callback);
    }
  }

  /**
   * 降级到系统 DNS
   */
  fallbackToSystemDNS(hostname, options, callback) {
    console.log(`[HTTPDNS] 使用系统 DNS 解析: ${hostname}`);
    return dns.lookup(hostname, options, (err, address, family) => {
      if (!err) {
        console.log(`[HTTPDNS] 系统 DNS 解析成功: ${hostname} -> ${address}`);
      }
      callback(err, address, family);
    });
  }

  /**
   * 格式化结果以匹配 Node.js dns.lookup 的输出格式
   */
  formatResult(address, family, all, callback) {
    if (all) {
      // 返回所有地址
      callback(null, [{ address, family: family === 6 ? 6 : 4 }]);
    } else {
      // 返回单个地址
      callback(null, address, family === 6 ? 6 : 4);
    }
  }

  /**
   * 创建使用自定义 DNS 的 HTTPS Agent
   */
  createHTTPSAgent(options = {}) {
    return new https.Agent({
      ...options,
      lookup: this.lookup.bind(this)
    });
  }

  /**
   * 创建使用自定义 DNS 的 HTTP Agent
   */
  createHTTPAgent(options = {}) {
    return new http.Agent({
      ...options,
      lookup: this.lookup.bind(this)
    });
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('[HTTPDNS] DNS 缓存已清理');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }

  /**
   * 关闭 HTTPDNS 客户端
   */
  async close() {
    this.clearCache();
    await this.httpdnsClient.close();
    console.log('[HTTPDNS] 自定义 DNS Lookup 已关闭');
  }
}

// 使用示例
async function example() {
  console.log('=== 自定义 DNS Lookup 示例 ===\n');
  
  // 创建自定义 DNS lookup
  const customDNS = new CustomDNSLookup({
    accountId: 'your-account-id',
    secretKey: 'your-secret-key',
    cacheTimeout: 30000 // 30秒缓存
  });
  
  try {
    // 示例1: 直接使用 lookup 函数
    console.log('--- 示例1: 直接使用 lookup 函数 ---');
    await new Promise((resolve, reject) => {
      customDNS.lookup('www.aliyun.com', (err, address, family) => {
        if (err) {
          console.error('Lookup 失败:', err.message);
          reject(err);
        } else {
          console.log(`直接 lookup 结果: ${address} (IPv${family})`);
          resolve();
        }
      });
    });
    
    // 示例2: 使用自定义 HTTPS Agent
    console.log('\n--- 示例2: 使用自定义 HTTPS Agent ---');
    const httpsAgent = customDNS.createHTTPSAgent({
      keepAlive: true,
      timeout: 10000
    });
    
    const httpsOptions = {
      hostname: 'www.aliyun.com',
      path: '/',
      method: 'GET',
      agent: httpsAgent,
      headers: {
        'User-Agent': 'HTTPDNS-CustomLookup-Example/1.0.0'
      }
    };
    
    await new Promise((resolve, reject) => {
      const req = https.request(httpsOptions, (res) => {
        console.log(`HTTPS 请求状态: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log(`HTTPS 响应大小: ${data.length} bytes`);
          resolve();
        });
      });
      
      req.on('error', reject);
      req.end();
    });
    
    // 示例3: 测试缓存功能
    console.log('\n--- 示例3: 测试缓存功能 ---');
    console.log('第一次解析（会缓存）:');
    await new Promise((resolve) => {
      customDNS.lookup('www.taobao.com', (err, address) => {
        if (!err) console.log(`解析结果: ${address}`);
        resolve();
      });
    });
    
    console.log('第二次解析（使用缓存）:');
    await new Promise((resolve) => {
      customDNS.lookup('www.taobao.com', (err, address) => {
        if (!err) console.log(`解析结果: ${address}`);
        resolve();
      });
    });
    
    // 显示缓存统计
    const cacheStats = customDNS.getCacheStats();
    console.log(`缓存统计: ${cacheStats.size} 个条目`);
    console.log(`缓存域名: ${cacheStats.entries.join(', ')}`);
    
  } finally {
    // 清理资源
    await customDNS.close();
  }
}

// 导出类和示例函数
module.exports = {
  CustomDNSLookup,
  example
};

// 如果直接运行此文件，执行示例
if (require.main === module) {
  example().catch(console.error);
}