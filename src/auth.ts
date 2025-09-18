/**
 * 认证和签名模块
 */

import crypto from 'crypto';

/**
 * 认证管理器
 */
export class AuthManager {
  private readonly secretKey: string;

  constructor(secretKey: string) {
    this.secretKey = secretKey;
  }

  /**
   * 生成单域名解析签名
   * 签名算法: MD5(host-secret-timestamp)
   */
  generateSignature(host: string, timestamp: string): string {
    return generateSignature(this.secretKey, host, timestamp);
  }
}

/**
 * 生成单域名解析签名
 * 签名算法: MD5(host-secret-timestamp)
 */
export function generateSignature(secretKey: string, host: string, timestamp: string): string {
  const signString = `${host}-${secretKey}-${timestamp}`;
  return crypto.createHash('md5').update(signString).digest('hex');
}
