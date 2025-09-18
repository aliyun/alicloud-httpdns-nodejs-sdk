/**
 * 工具函数模块
 */

import { QueryType } from '../types';

/**
 * 构建查询参数字符串（兼容Node.js 12+）
 */
export function buildQueryParams(params: Record<string, string>): string {
  const paramPairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      paramPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return paramPairs.join('&');
}

/**
 * 验证域名格式
 */
export function isValidDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // 基本的域名格式检查
  const domainRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
}

/**
 * 解析查询类型
 */
export function parseQueryType(queryType?: QueryType): QueryType {
  if (!queryType) {
    return QueryType.Both;
  }

  switch (queryType) {
    case QueryType.IPv4:
    case QueryType.IPv6:
    case QueryType.Both:
      return queryType;
    default:
      return QueryType.Both;
  }
}

import { SIGNATURE_EXPIRE_TIME } from '../config';

/**
 * 生成时间戳字符串（当前时间 + 固定5分钟有效期）
 */
export function generateTimestamp(): string {
  const currentTime = Math.floor(Date.now() / 1000);
  const expireTime = Math.floor(SIGNATURE_EXPIRE_TIME / 1000); // 使用配置的过期时间
  return (currentTime + expireTime).toString();
}
