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
   * 生成签名
   * 签名算法: HMAC-SHA256
   */
  generateSignature(signString: string): string {
    const keyBuffer = Buffer.from(this.secretKey, 'hex');
    return crypto.createHmac('sha256', keyBuffer).update(signString, 'utf8').digest('hex');
  }
}

/**
 * 生成签名
 * 签名算法: HMAC-SHA256
 */
export function generateSignature(secretKey: string, signString: string): string {
  const keyBuffer = Buffer.from(secretKey, 'hex');
  return crypto.createHmac('sha256', keyBuffer).update(signString, 'utf8').digest('hex');
}
