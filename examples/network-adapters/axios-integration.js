/**
 * Axios + HTTPDNS 集成示例
 * 
 * 演示如何将 HTTPDNS Node.js SDK 与 Axios 集成，实现智能 DNS 解析
 */

const axios = require('axios');
const dns = require('dns');
const { createClient } = require('@alicloud-emas/httpdns');

class AxiosHTTPDNSAdapter {
  constructor(httpdnsConfig = {}) {
    // 创建 HTTPDNS 客户端
    this.httpdnsClient = createClient({
      accountId: httpdnsConfig.accountId || 'your-account-id',
      secretKey: httpdnsConfig.secretKey || 'your-secret-key',
      timeout: httpdnsConfig.timeout || 5000,
      maxRetries: httpdnsConfig.maxRetries || 2,
    });

    console.log('🚀 [HTTPDNS] Axios 适配器初始化完成');
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

    // 确保callback存在
    if (typeof callback !== 'function') {
      throw new Error('callback must be a function');
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

    console.log(`🔄 [DNS Lookup] HTTPDNS 无可用IP，降级到系统 DNS: ${hostname}`);
    dns.lookup(hostname, options, callback);
  }



  /**
   * 创建集成 HTTPDNS 的 Axios 实例
   */
  createAxiosInstance(baseConfig = {}) {
    console.log('🚀 [HTTPDNS] 创建 Axios 实例');

    // 通过 Agent 设置 lookup 函数
    const https = require('https');
    const http = require('http');

    const httpsAgent = new https.Agent({
      lookup: this.customLookup.bind(this),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 5000,
    });

    const httpAgent = new http.Agent({
      lookup: this.customLookup.bind(this),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 5000,
    });

    baseConfig.httpsAgent = httpsAgent;
    baseConfig.httpAgent = httpAgent;

    const instance = axios.create(baseConfig);

    // 响应拦截器 - 自动重试机制
    instance.interceptors.response.use(
      (response) => {
        console.log(`✅ [请求成功] 状态码: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      async (error) => {
        console.error(`❌ [请求失败] ${error.message}`);

        // 检查是否是连接错误
        const isConnectionError = this._isConnectionError(error);
        if (isConnectionError) {
          console.error(`🚨 [连接失败] 连接错误: ${error.message} (错误代码: ${error.code})`);

          // 单次重试机制 - 临时降级到系统 DNS
          if (!error.config._httpdnsRetried) {
            console.log(`🔄 [单次重试] 使用系统 DNS 重新请求（不影响后续请求）`);

            // 创建新的配置对象，不修改原配置
            const fallbackConfig = {
              ...error.config,
              _httpdnsRetried: true
            };
            delete fallbackConfig.httpsAgent;
            delete fallbackConfig.httpAgent;

            try {
              const fallbackResponse = await axios.request(fallbackConfig);
              console.log(`✅ [重试成功] 系统 DNS 请求成功: ${fallbackResponse.status}`);
              return fallbackResponse;
            } catch (fallbackError) {
              console.error(`❌ [重试失败] 系统 DNS 也失败: ${fallbackError.message}`);
              // 返回原始错误
            }
          }
        }

        return Promise.reject(error);
      }
    );

    return instance;
  }

  /**
   * 判断是否为连接错误
   * @private
   */
  _isConnectionError(error) {
    const connectionErrorCodes = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ECONNABORTED',
      'EPIPE',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];

    return connectionErrorCodes.includes(error.code) ||
      error.message.includes('timeout') ||
      error.message.includes('connect');
  }

  /**
   * 创建简单的 HTTP 客户端
   */
  async request(url, config = {}) {
    console.log(`[HTTPDNS] 发起请求: ${config.method || 'GET'} ${url}`);

    // 通过 Agent 设置 lookup
    const https = require('https');
    const http = require('http');

    const httpsAgent = new https.Agent({
      lookup: this.customLookup.bind(this),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
    });

    const httpAgent = new http.Agent({
      lookup: this.customLookup.bind(this),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
    });

    // 设置 Agent
    config.httpsAgent = httpsAgent;
    config.httpAgent = httpAgent;

    try {
      const response = await axios.request({
        url,
        ...config
      });

      console.log(`[HTTPDNS] 请求成功: ${response.status}`);
      return response;
    } catch (error) {
      console.error(`[HTTPDNS] 请求失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * GET 请求
   */
  async get(url, config = {}) {
    return this.request(url, { ...config, method: 'GET' });
  }

  /**
   * POST 请求
   */
  async post(url, data, config = {}) {
    return this.request(url, { ...config, method: 'POST', data });
  }

  /**
   * 关闭 HTTPDNS 客户端
   */
  async close() {
    await this.httpdnsClient.close();
    console.log('[HTTPDNS] Axios 适配器已关闭');
  }
}

// 使用示例
async function example() {
  console.log('=== Axios + HTTPDNS 集成示例 ===\n');

  // 创建适配器
  const adapter = new AxiosHTTPDNSAdapter({
    accountId: 'your-account-id',
    secretKey: 'your-secret-key',
  });

  try {
    // 方式1: 使用适配器的便捷方法
    console.log('\n--- 方式1: 使用适配器便捷方法 ---');

    const getResponse = await adapter.get('https://www.aliyun.com', {
      headers: {
        'User-Agent': 'HTTPDNS-Axios-Example/1.0.0'
      },
      timeout: 10000
    });

    console.log(`GET 响应状态: ${getResponse.status}`);
    console.log(`GET 响应大小: ${JSON.stringify(getResponse.data).length} bytes`);

    // 方式2: 创建 Axios 实例
    console.log('\n--- 方式2: 使用 Axios 实例 ---');

    const httpClient = adapter.createAxiosInstance({
      timeout: 10000,
      headers: {
        'User-Agent': 'HTTPDNS-Axios-Example/1.0.0'
      }
    });

    const getResponse2 = await httpClient.get('https://www.taobao.com');

    console.log(`GET 响应状态: ${getResponse2.status}`);
    console.log(`GET 响应大小: ${JSON.stringify(getResponse2.data).length} bytes`);



  } finally {
    // 清理资源
    await adapter.close();
  }
}

// 导出适配器类和示例函数
module.exports = {
  AxiosHTTPDNSAdapter,
  example
};

// 如果直接运行此文件，执行示例
if (require.main === module) {
  example().catch(console.error);
}