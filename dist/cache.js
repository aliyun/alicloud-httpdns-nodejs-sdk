"use strict";
/**
 * 缓存管理模块
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCacheKey = exports.CacheManager = void 0;
/**
 * 缓存管理器
 */
class CacheManager {
    constructor() {
        this.cache = new Map();
    }
    /**
     * 获取缓存值
     */
    get(key) {
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
    set(key, value, ttl) {
        const now = Date.now();
        const entry = {
            value,
            expireTime: now + ttl * 1000,
            createdAt: now,
        };
        this.cache.set(key, entry);
    }
    /**
     * 清空所有缓存
     */
    clear() {
        this.cache.clear();
    }
    /**
     * 获取缓存大小
     */
    size() {
        return this.cache.size;
    }
    /**
     * 检查缓存是否存在且未过期
     */
    has(key) {
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
    delete(key) {
        return this.cache.delete(key);
    }
    /**
     * 清理过期缓存
     */
    cleanupExpired() {
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
exports.CacheManager = CacheManager;
/**
 * 生成缓存键
 */
function generateCacheKey(domain, queryType) {
    return `${domain}:${queryType || 'both'}`;
}
exports.generateCacheKey = generateCacheKey;
//# sourceMappingURL=cache.js.map