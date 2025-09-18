/**
 * 配置管理模块
 */

import { HTTPDNSConfig, Logger } from './types';
import { createConfigError } from './errors';

/**
 * 默认EMAS HTTPDNS启动IP（中国内地）
 */
export const DEFAULT_BOOTSTRAP_IPS = [
  '203.107.1.1',
  '203.107.1.97',
  '203.107.1.100',
  '203.119.238.240',
  '106.11.25.239',
  '59.82.99.47',
];

/**
 * 默认启动域名（兜底）
 */
export const DEFAULT_BOOTSTRAP_DOMAIN = 'resolvers-cn.httpdns.aliyuncs.com';

/**
 * 默认HTTPS SNI域名（根据官方文档，HTTPS证书校验Host需要指定为resolvers.httpdns.aliyuncs.com）
 */
export const DEFAULT_HTTPS_SNI = 'resolvers.httpdns.aliyuncs.com';

/**
 * 签名过期时间（固定5分钟）
 */
export const SIGNATURE_EXPIRE_TIME = 300000;

/**
 * 获取默认配置
 */
export function getDefaultConfig(): Required<
  Omit<HTTPDNSConfig, 'accountId' | 'secretKey' | 'logger'>
> {
  return {
    bootstrapIPs: DEFAULT_BOOTSTRAP_IPS,
    timeout: 5000, // 5秒超时
    maxRetries: 0, // 默认不重试，避免频率限制
    enableHTTPS: false, // 默认HTTP
    httpsSNIHost: DEFAULT_HTTPS_SNI,
    enableCache: true, // 默认启用缓存
  };
}

/**
 * 验证配置
 */
export function validateConfig(config: HTTPDNSConfig): void {
  if (!config.accountId || typeof config.accountId !== 'string' || config.accountId.trim() === '') {
    throw createConfigError('accountId must be a non-empty string');
  }

  if (config.secretKey !== undefined) {
    if (typeof config.secretKey !== 'string' || config.secretKey.trim() === '') {
      throw createConfigError('secretKey must be a non-empty string when provided');
    }
  }

  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number' || config.timeout <= 0) {
      throw createConfigError('timeout must be a positive number');
    }
  }

  if (config.maxRetries !== undefined) {
    if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
      throw createConfigError('maxRetries must be a non-negative number');
    }
  }

  if (config.bootstrapIPs !== undefined) {
    if (!Array.isArray(config.bootstrapIPs) || config.bootstrapIPs.length === 0) {
      throw createConfigError('bootstrapIPs must be a non-empty array');
    }
    for (const ip of config.bootstrapIPs) {
      if (typeof ip !== 'string' || ip.trim() === '') {
        throw createConfigError('all bootstrapIPs must be non-empty strings');
      }
    }
  }

  if (config.httpsSNIHost !== undefined) {
    if (typeof config.httpsSNIHost !== 'string' || config.httpsSNIHost.trim() === '') {
      throw createConfigError('httpsSNIHost must be a non-empty string when provided');
    }
  }
}

/**
 * 合并配置接口（包含可选字段）
 */
export interface MergedConfig extends Omit<HTTPDNSConfig, 'secretKey' | 'logger'> {
  accountId: string;
  secretKey?: string;
  bootstrapIPs: string[];
  timeout: number;
  maxRetries: number;
  enableHTTPS: boolean;
  httpsSNIHost: string;
  enableCache: boolean;
  logger?: Logger;
}

/**
 * 合并配置
 */
export function mergeConfig(userConfig: HTTPDNSConfig): MergedConfig {
  const defaultConfig = getDefaultConfig();

  const result: MergedConfig = {
    accountId: userConfig.accountId,
    bootstrapIPs: userConfig.bootstrapIPs || defaultConfig.bootstrapIPs,
    timeout: userConfig.timeout !== undefined ? userConfig.timeout : defaultConfig.timeout,
    maxRetries:
      userConfig.maxRetries !== undefined ? userConfig.maxRetries : defaultConfig.maxRetries,
    enableHTTPS:
      userConfig.enableHTTPS !== undefined ? userConfig.enableHTTPS : defaultConfig.enableHTTPS,
    httpsSNIHost: userConfig.httpsSNIHost || defaultConfig.httpsSNIHost,
    enableCache:
      userConfig.enableCache !== undefined ? userConfig.enableCache : defaultConfig.enableCache,
  };

  if (userConfig.secretKey !== undefined) {
    result.secretKey = userConfig.secretKey;
  }

  if (userConfig.logger !== undefined) {
    result.logger = userConfig.logger;
  }

  return result;
}
