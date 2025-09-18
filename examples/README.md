# HTTPDNS Node.js SDK 示例

本目录包含 HTTPDNS Node.js SDK 的使用示例，帮助开发者快速上手和集成。

## 📁 目录结构

### basic-usage/ - 基础使用示例
- `basic-usage.js` - 基础 API 使用
- `simplified-api.js` - 简化 API 使用
- `advanced-features.js` - 高级功能示例
- `large-batch-example.js` - 批量解析示例
- `typescript-example.ts` - TypeScript 示例
- `custom-dns-lookup.js` - 自定义 DNS lookup

### network-adapters/ - 网络库集成示例
- `axios-integration.js` - Axios 集成
- `urllib-integration.js` - urllib 集成
- `oss-integration.js` - Ali-OSS 集成

## 🚀 快速开始

1. 配置账户信息：
```javascript
const client = createClient({
  accountId: 'your-account-id',
  secretKey: 'your-secret-key'
});
```

2. 运行示例：
```bash
# 基础使用
node examples/basic-usage/basic-usage.js

# 网络库集成
node examples/network-adapters/axios-integration.js
node examples/network-adapters/urllib-integration.js
node examples/network-adapters/oss-integration.js
```

## ✨ 主要特性

- **自动降级** - HTTPDNS 失败时降级到系统 DNS
- **故障转移** - 支持多 IP 自动切换
- **连接复用** - Agent 方式实现高性能集成
- **错误重试** - 智能重试机制确保可用性