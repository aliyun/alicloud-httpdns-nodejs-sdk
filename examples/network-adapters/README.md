# HTTPDNS 网络库适配示例

本目录包含 HTTPDNS Node.js SDK 与主流网络库的集成示例，统一使用 Agent 方式实现高性能集成。

## 📁 文件说明

- **`axios-integration.js`** - Axios + HTTPDNS 集成
- **`urllib-integration.js`** - urllib + HTTPDNS 集成  
- **`oss-integration.js`** - Ali-OSS + HTTPDNS 集成

## 🚀 快速开始

```bash
# Axios 集成示例
node examples/network-adapters/axios-integration.js

# urllib 集成示例
node examples/network-adapters/urllib-integration.js

# OSS 集成示例
node examples/network-adapters/oss-integration.js
```

## 🔧 核心实现

所有示例都使用 Agent 方式集成，通过自定义 lookup 函数实现 HTTPDNS 解析：

```javascript
const httpsAgent = new https.Agent({
  lookup: customHTTPDNSLookup,
  keepAlive: true,
  maxSockets: 10,
  maxFreeSockets: 5
});
```

## ✨ 主要特性

- **连接复用** - 支持 Keep-Alive，提升性能
- **自动降级** - HTTPDNS 失败时降级到系统 DNS
- **故障转移** - 支持多 IP 自动切换
- **错误重试** - 连接失败时自动重试

## 💡 使用场景

- OSS 文件操作
- API 网关调用
- CDN 资源访问
- 高频网络请求