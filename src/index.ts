/**
 * 阿里云HTTPDNS Node.js SDK 主入口文件
 */

// 导出主要接口和类型
export * from './types';
export * from './errors';
export * from './config';

// 导出客户端创建函数
export { createClient, createHTTPDNSClient } from './client';
