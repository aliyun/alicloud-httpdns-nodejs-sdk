# HTTPDNS SDK Electron Demo

这是一个基于 Electron 的 HTTPDNS SDK 可视化演示应用。

## 🚀 快速开始

### 1. 安装依赖

```bash
cd demo
npm install
```

### 2. 配置账户信息

启动应用后，在界面中输入您的 HTTPDNS 账户信息：

- **Account ID**: 您的阿里云 HTTPDNS Account ID（必填）
- **Secret Key**: 您的密钥（可选，用于鉴权解析）

> 💡 如何获取账户信息？
> 
> 1. 登录[阿里云控制台](https://www.aliyun.com/)
> 2. 进入 EMAS HTTPDNS 服务
> 3. 在控制台中获取 Account ID 和 Secret Key

### 3. 运行应用

```bash
# 开发模式
npm start

# 构建 DMG（macOS）
npm run build
```

## ✨ 功能特性

- ✅ 可视化配置 HTTPDNS 参数
- ✅ 实时 DNS 解析测试
- ✅ 支持预解析域名列表
- ✅ 显示详细的解析日志
- ✅ 对比 HTTPDNS 和系统 DNS 性能

## 📦 构建产物

构建后的应用位于 `dist/` 目录：

- `HTTPDNS Demo-1.0.0-x64.dmg` - Intel 芯片版本
- `HTTPDNS Demo-1.0.0-arm64.dmg` - Apple Silicon 版本

## 🔒 安全提示

**请勿在代码中硬编码您的 Account ID 和 Secret Key！**

- 开发环境：使用环境变量或配置文件
- 生产环境：使用密钥管理服务
