/**
 * 缓存管理模块
 */
import { ResolveResult } from './types';
/**
 * 缓存管理器
 */
export declare class CacheManager {
    private cache;
    /**
     * 获取缓存值
     */
    get(key: string): ResolveResult | null;
    /**
     * 设置缓存值
     */
    set(key: string, value: ResolveResult, ttl: number): void;
    /**
     * 清空所有缓存
     */
    clear(): void;
    /**
     * 获取缓存大小
     */
    size(): number;
    /**
     * 检查缓存是否存在且未过期
     */
    has(key: string): boolean;
    /**
     * 删除指定缓存
     */
    delete(key: string): boolean;
    /**
     * 清理过期缓存
     */
    cleanupExpired(): number;
}
/**
 * 生成缓存键
 */
export declare function generateCacheKey(domain: string, queryType?: string): string;
//# sourceMappingURL=cache.d.ts.map