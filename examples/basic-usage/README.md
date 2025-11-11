# 基础使用示例

本目录包含 HTTPDNS Node.js SDK 的基础使用示例，快速了解核心 API。

## 📁 文件说明

- **basic-usage.js** - 基础 API 使用（包含所有核心功能）
- **typescript-example.ts** - TypeScript 使用示例

## 🚀 运行示例

```bash
# JavaScript 示例
node examples/basic-usage/basic-usage.js

# TypeScript 示例（需要先编译）
npx ts-node examples/basic-usage/typescript-example.ts
```

## 💡 生产环境集成

基础示例仅用于学习 API，**生产环境请参考 `network-adapters/` 目录**，其中包含：
- Axios 集成（完整的错误处理和重试）
- urllib 集成（高性能）
- OSS 集成（对象存储加速）