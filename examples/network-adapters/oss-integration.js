#!/usr/bin/env node
/**
 * Ali-OSS + HTTPDNS 集成示例
 * 
 * 演示如何将 HTTPDNS Node.js SDK 与 Ali-OSS SDK 集成，
 * 通过自定义 Agent 实现 IP 直连，提升 OSS 访问性能
 */

const OSS = require('ali-oss');
const https = require('https');
const dns = require('dns');
const { createClient } = require('../../dist/index.js');

class OSSHTTPDNSAdapter {
  constructor(httpdnsConfig) {
    this.httpdnsClient = createClient(httpdnsConfig);
    console.log('🚀 [OSS] HTTPDNS 适配器初始化完成');
  }

  /**
   * 创建自定义 DNS lookup 函数
   */
  createHTTPDNSLookup() {
    return (hostname, options, callback) => {
      // 参数标准化
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }

      console.log(`🔍 [OSS] 开始解析 OSS 域名: ${hostname}`);

      try {
        // 使用非阻塞方式获取缓存结果
        const result = this.httpdnsClient.getHttpDnsResultForHostSyncNonBlocking(hostname);

        if (!result) {
          // 缓存未命中，降级到系统DNS
          console.log(`🔄 [OSS] HTTPDNS 缓存未命中，降级到系统 DNS: ${hostname}`);
          dns.lookup(hostname, options, callback);
          return;
        }

        if (result.success) {
          const hasIPv4 = result.ipv4 && result.ipv4.length > 0;
          const hasIPv6 = result.ipv6 && result.ipv6.length > 0;

          if (hasIPv4 || hasIPv6) {
            if (options && options.all) {
              // 返回所有IP
              const addresses = [
                ...(hasIPv4 ? result.ipv4.map(ip => ({ address: ip, family: 4 })) : []),
                ...(hasIPv6 ? result.ipv6.map(ip => ({ address: ip, family: 6 })) : [])
              ];
              console.log(`✅ [OSS] HTTPDNS 解析成功: ${hostname} -> 返回所有IP (${addresses.length}个)`);
              callback(null, addresses);
            } else {
              // 优先IPv4，其次IPv6
              if (hasIPv4) {
                console.log(`✅ [OSS] HTTPDNS 解析成功: ${hostname} -> ${result.ipv4[0]} (IPv4)`);
                callback(null, result.ipv4[0], 4);
              } else {
                console.log(`✅ [OSS] HTTPDNS 解析成功: ${hostname} -> ${result.ipv6[0]} (IPv6)`);
                callback(null, result.ipv6[0], 6);
              }
            }
            return;
          }
        }

        console.log(`🔄 [OSS] HTTPDNS 无可用IP，降级到系统 DNS: ${hostname}`);
        dns.lookup(hostname, options, callback);
      } catch (error) {
        console.warn(`⚠️ [OSS] HTTPDNS 解析异常，降级到系统 DNS: ${error.message}`);
        dns.lookup(hostname, options, callback);
      }
    };
  }

  /**
   * 创建带 HTTPDNS 的 OSS 客户端
   */
  createOSSClient(ossConfig) {
    console.log('🚀 [OSS] 创建集成 HTTPDNS 的 OSS 客户端');

    // 创建 HTTPS Agent
    const httpsAgent = new https.Agent({
      lookup: this.createHTTPDNSLookup(),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 5000
    });

    // 创建 HTTP Agent
    const http = require('http');
    const httpAgent = new http.Agent({
      lookup: this.createHTTPDNSLookup(),
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 5000
    });

    // 创建 OSS 客户端
    const ossClient = new OSS({
      ...ossConfig,
      httpsAgent: httpsAgent,
      agent: httpAgent  // HTTP Agent for HTTP endpoints
    });

    console.log('✅ [OSS] OSS 客户端创建完成，已集成 HTTPDNS');
    return ossClient;
  }

  async close() {
    await this.httpdnsClient.close();
    console.log('🔒 [OSS] 适配器已关闭');
  }
}

// 使用示例
async function example() {
  console.log('🧪 Ali-OSS + HTTPDNS 集成示例');
  console.log('='.repeat(50));

  const httpdnsConfig = {
    accountId: 'your-account-id',
    secretKey: 'your-secret-key', // 可选
    timeout: 5000,
    maxRetries: 2,
  };

  const ossConfig = {
    region: 'oss-cn-hangzhou',
    accessKeyId: 'your-access-key-id',
    accessKeySecret: 'your-access-key-secret',
    bucket: 'your-bucket-name'
  };

  const adapter = new OSSHTTPDNSAdapter(httpdnsConfig);
  const ossClient = adapter.createOSSClient(ossConfig);

  try {
    console.log('\n🎯 测试 OSS 操作');

    // 示例1: 列举对象
    console.log('📋 列举 Bucket 中的对象...');
    const listResult = await ossClient.list({
      'max-keys': 10
    });
    console.log(`✅ 列举成功: 找到 ${listResult.objects?.length || 0} 个对象`);

    // 示例2: 上传小文件
    console.log('\n📤 上传测试文件...');
    const uploadResult = await ossClient.put('test-httpdns.txt', Buffer.from('Hello HTTPDNS!'));
    console.log(`✅ 上传成功: ${uploadResult.name}`);

    // 示例3: 下载文件
    console.log('\n📥 下载测试文件...');
    const downloadResult = await ossClient.get('test-httpdns.txt');
    console.log(`✅ 下载成功: ${downloadResult.content.toString()}`);

    // 示例4: 删除文件
    console.log('\n🗑️ 删除测试文件...');
    await ossClient.delete('test-httpdns.txt');
    console.log('✅ 删除成功');

  } catch (error) {
    console.error('❌ OSS 操作失败:', error.message);

    // 如果是认证错误，提供帮助信息
    if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      console.log('\n💡 提示: 请确保 OSS 配置正确:');
      console.log('  - region: OSS 区域');
      console.log('  - accessKeyId: 访问密钥 ID');
      console.log('  - accessKeySecret: 访问密钥');
      console.log('  - bucket: 存储桶名称');
    }
  } finally {
    await adapter.close();
  }
}

// 运行示例
if (require.main === module) {
  example()
    .then(() => {
      console.log('\n🎉 OSS 集成示例完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 示例运行失败:', error);
      process.exit(1);
    });
}

module.exports = { OSSHTTPDNSAdapter };