# HTTPDNS Node.js SDK

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D12.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.1%2B-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-Apache%202.0-green.svg)](LICENSE)

阿里云HTTPDNS Node.js SDK 是一个轻量级的 DNS 解析库，通过 HTTP/HTTPS 协议提供域名解析服务。支持阿里云 EMAS HTTPDNS 服务，为传统 DNS 解析提供更好的性能、安全性和可靠性。

## 特性

- ✅ **TypeScript优先**: 完整的TypeScript类型定义和类型安全
- ✅ **版本兼容**: 支持Node.js 12+，兼容更广泛的用户群体
- ✅ **高可用性**: 启动 IP 冗余、服务 IP 轮转、故障转移
- ✅ **智能调度**: 支持客户端 IP 传递，实现就近接入
- ✅ **安全认证**: 支持鉴权解析，MD5 签名算法
- ✅ **性能优化**: 异步解析、连接复用、请求去重
- ✅ **IPv6 支持**: 完整的 IPv4/IPv6 双栈支持

## 安装

```bash
npm install https://github.com/aliyun/alicloud-httpdns-nodejs-sdk.git
```

## 快速开始

### 基础使用

```typescript
import { createClient } from 'httpdns-nodejs-sdk';

async function main() {
  // 创建客户端
  const client = createClient({
    accountId: 'your-account-id'
  });

  try {
    // 同步非阻塞解析域名（推荐方式）
    const result = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com');
    console.log('Domain:', result.domain);
    console.log('IPv4:', result.ipv4);
    console.log('IPv6:', result.ipv6);
    console.log('TTL:', result.ttl);
    console.log('Success:', result.success);
  } catch (error) {
    console.error('Resolve failed:', error);
  } finally {
    // 关闭客户端
    await client.close();
  }
}

main();
```

### 鉴权解析

```typescript
// 方式1: 使用createClient
const client = createClient({
  accountId: 'your-account-id',
  secretKey: 'your-secret-key'  // 启用鉴权解析
});

// 方式2: 使用便捷方法createHTTPDNSClient
import { createHTTPDNSClient } from 'httpdns-nodejs-sdk';

const client = createHTTPDNSClient('your-account-id', 'your-secret-key');
```

### 同步非阻塞解析

```typescript
// 立即返回缓存结果或null，不阻塞
const cachedResult = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com');

if (cachedResult) {
  console.log('Cached result:', cachedResult.domain, '->', cachedResult.ipv4);
} else {
  console.log('No cached result, async resolution started');
  
  // 稍后再次查询可能已有缓存结果
  setTimeout(() => {
    const laterResult = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com');
    if (laterResult) {
      console.log('Later cached result:', laterResult.ipv4);
    }
  }, 1000);
}
```

## 高级配置

### 完整配置示例

```typescript
import { createClient, QueryType } from 'httpdns-nodejs-sdk';

const client = createClient({
  // 认证信息
  accountId: 'your-account-id',
  secretKey: 'your-secret-key',
  
  // 网络配置
  bootstrapIPs: ['203.107.1.1', '203.107.1.97'],
  timeout: 5000,
  maxRetries: 3,
  
  // 功能开关
  enableHTTPS: false,
  enableCache: true,
  

  
  // 日志配置
  logger: console
});
```

### 解析选项

```typescript
// 仅解析 IPv4
const result = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com', {
  queryType: QueryType.IPv4
});

// 仅解析 IPv6
const result = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com', {
  queryType: QueryType.IPv6
});

// 自定义超时
const result = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com', {
  timeout: 10000
});
```

## 客户端管理

```typescript
// 检查客户端健康状态
const isHealthy = client.isHealthy();
console.log('Client is healthy:', isHealthy);

// 获取当前服务IP列表
const serviceIPs = client.getServiceIPs();
console.log('Service IPs:', serviceIPs);

// 手动更新服务IP
await client.updateServiceIPs();
```

## 错误处理

```typescript
import { HTTPDNSError } from 'httpdns-nodejs-sdk';

try {
  const result = client.getHttpDnsResultForHostSyncNonBlocking('www.aliyun.com');
  if (!result.success) {
    console.log('Resolve failed:', result.error?.message);
  }
} catch (error) {
  if (error instanceof HTTPDNSError) {
    console.log('Operation:', error.operation);
    console.log('Domain:', error.domain);
    console.log('Original Error:', error.originalError);
  }
}
```

## 开发

### 构建

```bash
npm run build
```

### 测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行集成测试
npm run test:integration

# 持续集成测试
npm run test:ci
```

### 代码质量

```bash
# 代码检查
npm run lint

# 自动修复代码问题
npm run lint:fix

# 代码格式化
npm run format

# 检查代码格式
npm run format:check

# TypeScript类型检查
npm run type-check

# 完整验证（类型检查+构建）
npm run validate
```

## 许可证

本项目采用 Apache 2.0 许可证。详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基础域名解析功能
- 支持鉴权和非鉴权模式
- 支持高可用性和故障转移
- 完整的TypeScript类型定义