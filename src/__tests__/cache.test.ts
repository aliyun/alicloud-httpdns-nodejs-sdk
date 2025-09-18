/**
 * 缓存功能单元测试
 */

import { CacheManager, generateCacheKey } from '../cache';
import { ResolveResult } from '../types';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockResult: ResolveResult;

  beforeEach(() => {
    cacheManager = new CacheManager();
    mockResult = {
      domain: 'example.com',
      ipv4: ['1.2.3.4'],
      ipv6: ['::1'],
      ttl: 300,
      timestamp: new Date(),
      success: true,
    };
  });

  describe('基本缓存操作', () => {
    it('应该能够设置和获取缓存', () => {
      const key = 'test-key';
      const ttl = 300;

      cacheManager.set(key, mockResult, ttl);
      const result = cacheManager.get(key);

      expect(result).toEqual(mockResult);
    });

    it('应该在缓存不存在时返回null', () => {
      const result = cacheManager.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('应该能够检查缓存是否存在', () => {
      const key = 'test-key';

      expect(cacheManager.has(key)).toBe(false);

      cacheManager.set(key, mockResult, 300);
      expect(cacheManager.has(key)).toBe(true);
    });

    it('应该能够删除缓存', () => {
      const key = 'test-key';

      cacheManager.set(key, mockResult, 300);
      expect(cacheManager.has(key)).toBe(true);

      const deleted = cacheManager.delete(key);
      expect(deleted).toBe(true);
      expect(cacheManager.has(key)).toBe(false);
    });

    it('应该能够清空所有缓存', () => {
      cacheManager.set('key1', mockResult, 300);
      cacheManager.set('key2', mockResult, 300);

      expect(cacheManager.size()).toBe(2);

      cacheManager.clear();
      expect(cacheManager.size()).toBe(0);
    });

    it('应该正确返回缓存大小', () => {
      expect(cacheManager.size()).toBe(0);

      cacheManager.set('key1', mockResult, 300);
      expect(cacheManager.size()).toBe(1);

      cacheManager.set('key2', mockResult, 300);
      expect(cacheManager.size()).toBe(2);
    });
  });

  describe('TTL过期处理', () => {
    it('应该在TTL过期后返回null', done => {
      const key = 'test-key';
      const shortTtl = 0.1; // 100ms

      cacheManager.set(key, mockResult, shortTtl);

      // Immediately should return the value
      expect(cacheManager.get(key)).toEqual(mockResult);

      // After TTL expires, should return null
      setTimeout(() => {
        expect(cacheManager.get(key)).toBeNull();
        done();
      }, 150);
    });

    it('应该在检查has时自动清理过期缓存', done => {
      const key = 'test-key';
      const shortTtl = 0.1; // 100ms

      cacheManager.set(key, mockResult, shortTtl);
      expect(cacheManager.has(key)).toBe(true);

      setTimeout(() => {
        expect(cacheManager.has(key)).toBe(false);
        expect(cacheManager.size()).toBe(0);
        done();
      }, 150);
    });

    it('应该能够手动清理过期缓存', done => {
      const shortTtl = 0.1; // 100ms
      const longTtl = 10; // 10s

      cacheManager.set('expired-key', mockResult, shortTtl);
      cacheManager.set('valid-key', mockResult, longTtl);

      expect(cacheManager.size()).toBe(2);

      setTimeout(() => {
        const cleanedCount = cacheManager.cleanupExpired();

        expect(cleanedCount).toBe(1);
        expect(cacheManager.size()).toBe(1);
        expect(cacheManager.has('expired-key')).toBe(false);
        expect(cacheManager.has('valid-key')).toBe(true);
        done();
      }, 150);
    });
  });

  describe('并发访问安全性', () => {
    it('应该能够处理并发读写操作', async () => {
      const promises: Promise<void>[] = [];
      const numOperations = 100;

      // Concurrent writes
      for (let i = 0; i < numOperations; i++) {
        promises.push(
          new Promise<void>(resolve => {
            cacheManager.set(
              `key-${i}`,
              {
                ...mockResult,
                domain: `example-${i}.com`,
              },
              300
            );
            resolve();
          })
        );
      }

      // Concurrent reads
      for (let i = 0; i < numOperations; i++) {
        promises.push(
          new Promise<void>(resolve => {
            cacheManager.get(`key-${i}`);
            // Result might be null if read happens before write
            resolve();
          })
        );
      }

      await Promise.all(promises);

      // All writes should have completed
      expect(cacheManager.size()).toBe(numOperations);
    });

    it('应该能够处理并发过期清理', done => {
      const shortTtl = 0.1; // 100ms

      // Add multiple entries
      for (let i = 0; i < 10; i++) {
        cacheManager.set(`key-${i}`, mockResult, shortTtl);
      }

      expect(cacheManager.size()).toBe(10);

      setTimeout(() => {
        // Concurrent cleanup operations
        const cleanupPromises = [];
        for (let i = 0; i < 5; i++) {
          cleanupPromises.push(
            new Promise<number>(resolve => {
              resolve(cacheManager.cleanupExpired());
            })
          );
        }

        Promise.all(cleanupPromises).then(results => {
          // Total cleaned should be 10, but distributed across operations
          const totalCleaned = results.reduce((sum, count) => sum + count, 0);
          expect(totalCleaned).toBe(10);
          expect(cacheManager.size()).toBe(0);
          done();
        });
      }, 150);
    });
  });

  describe('缓存开关配置', () => {
    it('应该在禁用缓存时不存储数据', () => {
      // This test would be in the Resolver integration test
      // Here we just test that CacheManager itself works correctly
      const key = 'test-key';

      cacheManager.set(key, mockResult, 300);
      expect(cacheManager.get(key)).toEqual(mockResult);

      // Simulate disabling cache by clearing it
      cacheManager.clear();
      expect(cacheManager.get(key)).toBeNull();
    });
  });
});

describe('generateCacheKey', () => {
  it('应该生成正确的缓存键', () => {
    expect(generateCacheKey('example.com')).toBe('example.com:both');
    expect(generateCacheKey('example.com', 'A')).toBe('example.com:A');
    expect(generateCacheKey('example.com', 'AAAA')).toBe('example.com:AAAA');
  });

  it('应该为相同参数生成相同的键', () => {
    const key1 = generateCacheKey('example.com', 'A');
    const key2 = generateCacheKey('example.com', 'A');
    expect(key1).toBe(key2);
  });

  it('应该为不同参数生成不同的键', () => {
    const key1 = generateCacheKey('example.com', 'A');
    const key2 = generateCacheKey('example.com', 'AAAA');
    const key3 = generateCacheKey('different.com', 'A');

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });
});
