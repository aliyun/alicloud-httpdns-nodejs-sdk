#!/usr/bin/env node
/**
 * urllib + HTTPDNS 集成示例 - Agent 方式（推荐）
 * 
 * 使用 Agent 方式集成 HTTPDNS，支持连接复用和更好的性能
 * 兼容 urllib 2.x 和更高版本，与 OSS 集成保持一致
 */
const urllib = require('urllib');
const https = require('https');
const http = require('http');
const dns = require('dns');
const { createClient } = require('@alicloud-emas/httpdns');

class UrllibHTTPDNSAdapter {
  constructor(httpdnsConfig) {
    this.httpdnsClient = createClient(httpdnsConfig);
    console.log('🚀 [urllib-Agent] HTTPDNS 适配器初始化完成');
  }

  /**
   * 自定义 DNS lookup 函数
   */
  customLookup(hostname, options, callback) {
    // 标准化参数
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }

    console.log(`🌐 [DNS Lookup] 使用 HTTPDNS SDK 解析: ${hostname}`);

    // 使用 HTTPDNS 解析域名
    const result = this.httpdnsClient.getHttpDnsResultForHostSyncNonBlocking(hostname);
    console.log(`📡 [HTTPDNS 响应] result: ${result ? JSON.stringify(result, null, 2) : 'null'}`);

    if (result) {
      const hasIPv4 = result.ipv4 && result.ipv4.length > 0;
      const hasIPv6 = result.ipv6 && result.ipv6.length > 0;

      if (hasIPv4 || hasIPv6) {
        if (options && options.all) {
          // 返回所有IP
          const addresses = [
            ...(hasIPv4 ? result.ipv4.map(ip => ({ address: ip, family: 4 })) : []),
            ...(hasIPv6 ? result.ipv6.map(ip => ({ address: ip, family: 6 })) : [])
          ];
          console.log(`✅ [DNS Lookup] HTTPDNS 解析成功: ${hostname} -> 返回所有IP (${addresses.length}个)`);
          callback(null, addresses);
        } else {
          // 优先IPv4，其次IPv6
          if (hasIPv4) {
            console.log(`✅ [DNS Lookup] HTTPDNS 解析成功: ${hostname} -> ${result.ipv4[0]} (IPv4)`);
            callback(null, result.ipv4[0], 4);
          } else {
            console.log(`✅ [DNS Lookup] HTTPDNS 解析成功: ${hostname} -> ${result.ipv6[0]} (IPv6)`);
            callback(null, result.ipv6[0], 6);
          }
        }
        return;
      }
    }

    console.log(`⚠️  [DNS Lookup] HTTPDNS SDK 返回空结果，降级到系统 DNS`);
    dns.lookup(hostname, options, callback);
  }

  /**
   * 创建集成 HTTPDNS 的 Agent
   */
  createAgents() {
    const httpsAgent = new https.Agent({
      lookup: this.customLookup.bind(this),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 5000
    });

    const httpAgent = new http.Agent({
      lookup: this.customLookup.bind(this),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 5000
    });

    console.log('✅ [urllib-Agent] Agent 创建完成，已集成 HTTPDNS');

    return { httpsAgent, httpAgent };
  }

  /**
   * 发起请求
   */
  async request(url, options = {}) {
    console.log(`📡 [urllib-Agent] 发起请求: ${url}`);

    const { httpsAgent, httpAgent } = this.createAgents();

    // 设置 Agent
    options.agent = httpAgent;
    options.httpsAgent = httpsAgent;
    options.timeout = options.timeout || 10000;

    try {
      // urllib 2.x 使用回调模式，需要 Promise 包装
      return new Promise((resolve, reject) => {
        urllib.request(url, options, (err, data, res) => {
          if (err) {
            console.error(`❌ [urllib-Agent] 请求失败: ${err.message} (${err.code || 'N/A'})`);

            // 自动重试机制
            if (this._isConnectionError(err) && !options._httpdnsRetried) {
              console.log(`🔄 [urllib-Agent] 自动重试使用系统 DNS`);
              const fallbackOptions = { ...options, _httpdnsRetried: true };
              delete fallbackOptions.agent;
              delete fallbackOptions.httpsAgent;

              urllib.request(url, fallbackOptions, (fallbackErr, fallbackData, fallbackRes) => {
                if (fallbackErr) {
                  console.error(`❌ [urllib-Agent] 重试失败: ${fallbackErr.message}`);
                  reject(err);
                } else {
                  console.log(`✅ [urllib-Agent] 重试成功: 系统 DNS`);
                  resolve({ data: fallbackData, res: fallbackRes });
                }
              });
            } else {
              reject(err);
            }
          } else {
            console.log(`✅ [urllib-Agent] 请求成功: ${res.statusCode}`);
            resolve({ data, res });
          }
        });
      });
    } catch (error) {
      console.error(`❌ [urllib-Agent] 请求异常: ${error.message}`);
      throw error;
    }
  }

  /**
   * 判断是否为连接错误
   */
  _isConnectionError(error) {
    const connectionErrorCodes = [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT',
      'ENOTFOUND', 'EAI_AGAIN', 'ECONNABORTED',
      'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH'
    ];

    return connectionErrorCodes.includes(error.code) ||
      error.message.includes('timeout') ||
      error.message.includes('connect');
  }

  /**
   * 获取 Agent 状态信息
   */
  getAgentStatus() {
    const { httpsAgent, httpAgent } = this.createAgents();

    return {
      https: {
        sockets: Object.keys(httpsAgent.sockets).length,
        freeSockets: Object.keys(httpsAgent.freeSockets).length,
        maxSockets: httpsAgent.maxSockets,
        maxFreeSockets: httpsAgent.maxFreeSockets
      },
      http: {
        sockets: Object.keys(httpAgent.sockets).length,
        freeSockets: Object.keys(httpAgent.freeSockets).length,
        maxSockets: httpAgent.maxSockets,
        maxFreeSockets: httpAgent.maxFreeSockets
      }
    };
  }

  async close() {
    await this.httpdnsClient.close();
    console.log('🔒 [urllib-Agent] 适配器已关闭');
  }
}

// 使用示例
async function example() {
  console.log('=== urllib + HTTPDNS 集成示例 ===\n');

  const httpdnsConfig = {
    accountId: 'your-account-id',
    secretKey: 'your-secret-key',
    timeout: 5000,
    maxRetries: 2,
  };

  const adapter = new UrllibHTTPDNSAdapter(httpdnsConfig);

  try {
    console.log('🎯 测试 urllib Agent 集成...\n');

    // 测试请求
    const testUrls = [
      'https://www.aliyun.com',
      'https://www.taobao.com'
    ];

    for (const url of testUrls) {
      console.log(`\n📍 测试 URL: ${url}`);
      try {
        const result = await adapter.request(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'urllib-agent-httpdns-test'
          }
        });
        console.log(`✅ 请求成功: ${result.res.statusCode}`);
      } catch (error) {
        console.error(`❌ 请求失败: ${error.message}`);
      }
    }

    // 显示 Agent 状态
    console.log('\n📊 Agent 连接池状态:');
    const agentStatus = adapter.getAgentStatus();
    console.log('HTTPS Agent:', agentStatus.https);
    console.log('HTTP Agent:', agentStatus.http);

    console.log('\n🎉 urllib Agent 集成测试完成！');

    console.log('\n💡 Agent 方式优势:');
    console.log('- 连接复用，性能更好');
    console.log('- 全局配置，管理方便');
    console.log('- 与 OSS 集成保持一致');
    console.log('- 支持连接池管理');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  } finally {
    await adapter.close();
  }
}

// 导出适配器类
module.exports = { UrllibHTTPDNSAdapter };

// 如果直接运行此文件，执行示例
if (require.main === module) {
  example()
    .then(() => {
      console.log('\n✅ urllib Agent 示例完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 示例失败:', error);
      process.exit(1);
    });
}