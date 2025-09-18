/**
 * 缓存管理模块
 */

import { ResolveResult } from './types';

/**
 * 缓存条目接口
 */
interface CacheEntry {
  value: ResolveResult;
  expireTime: number;
  createdAt: number;
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * 获取缓存值
   */
  get(key: string): ResolveResult | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expireTime) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: string, value: ResolveResult, ttl: number): void {
    const now = Date.now();
    const entry: CacheEntry = {
      value,
      expireTime: now + ttl * 1000, // TTL以秒为单位，转换为毫秒
      createdAt: now,
    };

    this.cache.set(key, entry);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (Date.now() > entry.expireTime) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 删除指定缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清理过期缓存
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expireTime) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

/**
 * 生成缓存键
 */
export function generateCacheKey(domain: string, queryType?: string): string {
  return `${domain}:${queryType || 'both'}`;
}
