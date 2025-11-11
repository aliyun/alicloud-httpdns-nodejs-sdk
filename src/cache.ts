/**
 * 缓存管理模块
 */

import { ResolveResult, QueryType } from './types';

/**
 * 缓存条目类
 */
export class CacheEntry {
  domain: string;
  ipv4: string[];
  ipv4Ttl: number;
  ipv4ExpireTime: number;
  ipv4Timestamp: Date;
  ipv6: string[];
  ipv6Ttl: number;
  ipv6ExpireTime: number;
  ipv6Timestamp: Date;

  constructor(result: ResolveResult) {
    const now = Date.now();
    this.domain = result.domain;
    this.ipv4 = result.ipv4;
    this.ipv4Ttl = result.ipv4Ttl;
    this.ipv4ExpireTime = now + result.ipv4Ttl * 1000;
    this.ipv4Timestamp = result.ipv4Timestamp;
    this.ipv6 = result.ipv6;
    this.ipv6Ttl = result.ipv6Ttl;
    this.ipv6ExpireTime = now + result.ipv6Ttl * 1000;
    this.ipv6Timestamp = result.ipv6Timestamp;
  }

  /**
   * 判断是否过期
   */
  isExpired(queryType: QueryType): boolean {
    const now = Date.now();
    if (queryType === QueryType.IPv4) {
      return now > this.ipv4ExpireTime;
    } else if (queryType === QueryType.IPv6) {
      return now > this.ipv6ExpireTime;
    } else {
      return now > this.ipv4ExpireTime || now > this.ipv6ExpireTime;
    }
  }

  /**
   * 转换为 ResolveResult
   */
  toResolveResult(queryType: QueryType): ResolveResult {
    return {
      domain: this.domain,
      ipv4: queryType === QueryType.IPv6 ? [] : this.ipv4,
      ipv4Ttl: this.ipv4Ttl,
      ipv4Timestamp: this.ipv4Timestamp,
      ipv6: queryType === QueryType.IPv4 ? [] : this.ipv6,
      ipv6Ttl: this.ipv6Ttl,
      ipv6Timestamp: this.ipv6Timestamp,
    };
  }

  /**
   * 部分更新
   */
  update(queryType: QueryType, result: ResolveResult): void {
    const now = Date.now();

    if (queryType === QueryType.IPv4 || queryType === QueryType.Both) {
      if (result.ipv4Ttl > 0) {
        this.ipv4 = result.ipv4;
        this.ipv4Ttl = result.ipv4Ttl;
        this.ipv4ExpireTime = now + result.ipv4Ttl * 1000;
        this.ipv4Timestamp = result.ipv4Timestamp;
      }
    }

    if (queryType === QueryType.IPv6 || queryType === QueryType.Both) {
      if (result.ipv6Ttl > 0) {
        this.ipv6 = result.ipv6;
        this.ipv6Ttl = result.ipv6Ttl;
        this.ipv6ExpireTime = now + result.ipv6Ttl * 1000;
        this.ipv6Timestamp = result.ipv6Timestamp;
      }
    }
  }

  /**
   * 获取过期的类型
   */
  getExpiredTypes(): QueryType {
    const now = Date.now();
    const v4Expired = now > this.ipv4ExpireTime;
    const v6Expired = now > this.ipv6ExpireTime;

    if (v4Expired && v6Expired) return QueryType.Both;
    if (v4Expired) return QueryType.IPv4;
    if (v6Expired) return QueryType.IPv6;
    return QueryType.Both;
  }
}

/**
 * 缓存管理器
 */
export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();

  /**
   * 获取缓存值（支持过期缓存）
   * @param domain 域名
   * @param queryType 查询类型
   * @param enableExpiredIP 是否允许返回过期缓存
   */
  get(domain: string, queryType: QueryType, enableExpiredIP: boolean = false): CacheEntry | null {
    const entry = this.cache.get(domain);

    if (!entry) {
      return null;
    }

    // 如果过期
    if (entry.isExpired(queryType)) {
      if (!enableExpiredIP) {
        // 不允许使用过期IP：删除并返回null
        this.cache.delete(domain);
        return null;
      }
      // 允许使用过期IP：继续返回
    }

    return entry;
  }

  /**
   * 设置缓存值
   */
  set(domain: string, queryType: QueryType, result: ResolveResult): void {
    let entry = this.cache.get(domain);

    if (!entry) {
      entry = new CacheEntry(result);
    } else {
      entry.update(queryType, result);
    }

    // 只有至少一个有效才存储
    if (entry.ipv4Ttl > 0 || entry.ipv6Ttl > 0) {
      this.cache.set(domain, entry);
    }
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
  has(domain: string, queryType: QueryType): boolean {
    const entry = this.cache.get(domain);
    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (entry.isExpired(queryType)) {
      this.cache.delete(domain);
      return false;
    }

    return true;
  }

  /**
   * 删除指定缓存
   */
  delete(domain: string): boolean {
    return this.cache.delete(domain);
  }

  /**
   * 清理过期缓存条目
   */
  cleanupExpiredEntries(): number {
    let cleanedCount = 0;

    for (const [domain, entry] of this.cache.entries()) {
      // 如果 IPv4 和 IPv6 都过期，删除整个条目
      if (entry.isExpired(QueryType.IPv4) && entry.isExpired(QueryType.IPv6)) {
        this.cache.delete(domain);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}
