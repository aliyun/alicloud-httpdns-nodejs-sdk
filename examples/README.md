# HTTPDNS Node.js SDK 示例

本目录包含 HTTPDNS Node.js SDK 的使用示例，帮助开发者快速上手和集成。

## 📁 目录结构

### basic-usage/ - 基础使用示例
- `basic-usage.js` - 基础 API 使用（包含所有核心功能）
- `typescript-example.ts` - TypeScript 示例

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

# 网络库集成（推荐）
node examples/network-adapters/axios-integration.js
node examples/network-adapters/urllib-integration.js
node examples/network-adapters/oss-integration.js
```

## 💡 推荐

**生产环境建议使用 network-adapters 中的集成方式**，这些示例提供了：
- 完整的错误处理和重试机制
- 多 IP 自动故障转移
- 与主流网络库的最佳实践集成

## ✨ 主要特性

- **自动降级** - HTTPDNS 失败时降级到系统 DNS
- **故障转移** - 支持多 IP 自动切换
- **连接复用** - Agent 方式实现高性能集成
- **错误重试** - 智能重试机制确保可用性