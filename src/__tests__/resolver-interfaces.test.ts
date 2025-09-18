/**
 * 重构后解析接口单元测试
 */

import { Resolver } from '../resolver';
import { MergedConfig } from '../config';
import { QueryType } from '../types';


// Mock NetworkManager
jest.mock('../network');

describe('Resolver Interfaces', () => {
  let resolver: Resolver;
  let mockConfig: MergedConfig;
  let mockNetworkManager: any;

  beforeEach(() => {
    mockConfig = {
      accountId: 'test-account',
      bootstrapIPs: ['203.107.1.1'],
      timeout: 5000,
      maxRetries: 2,
      enableHTTPS: false,
      httpsSNIHost: 'httpdns-api.aliyuncs.com',
      enableCache: true,
    };

    // Mock NetworkManager
    mockNetworkManager = {
      resolveSingle: jest.fn(),
      close: jest.fn(),
    };

    resolver = new Resolver(mockConfig);
    (resolver as any).networkManager = mockNetworkManager;
  });

  afterEach(() => {
    resolver.close();
    jest.clearAllMocks();
  });

  describe('resolveSync - 同步阻塞解析', () => {
    it('应该在缓存命中时立即返回缓存结果', async () => {
      const mockResult = {
        domain: 'example.com',
        ipv4: ['1.2.3.4'],
        ipv6: [],
        ttl: 300,
        timestamp: new Date(),
        success: true,
      };

      // Pre-populate cache
      const cacheManager = resolver.getCacheManager();
      cacheManager.set('example.com:4,6', mockResult, 300);

      const result = await resolver.getHttpDnsResultForHostSync('example.com');

      expect(result).toEqual(mockResult);
      expect(mockNetworkManager.resolveSingle).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时发起网络解析', async () => {
      const mockNetworkResponse = {
        host: 'example.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

      const result = await resolver.getHttpDnsResultForHostSync('example.com');

      expect(mockNetworkManager.resolveSingle).toHaveBeenCalledWith(
        'example.com',
        QueryType.Both,
        5000 // Default timeout from config
      );
      expect(result.domain).toBe('example.com');
      expect(result.ipv4).toEqual(['1.2.3.4']);
      expect(result.success).toBe(true);
    });

    it('应该在解析成功后更新缓存', async () => {
      const mockNetworkResponse = {
        host: 'example.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

      await resolver.getHttpDnsResultForHostSync('example.com');

      // Check cache was updated
      const cacheManager = resolver.getCacheManager();
      const cachedResult = cacheManager.get('example.com:4,6');

      expect(cachedResult).toBeDefined();
      expect(cachedResult!.domain).toBe('example.com');
      expect(cachedResult!.ipv4).toEqual(['1.2.3.4']);
    });

    it('应该支持自定义超时', async () => {
      const mockNetworkResponse = {
        host: 'example.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

      await resolver.getHttpDnsResultForHostSync('example.com', { timeout: 10000 });

      expect(mockNetworkManager.resolveSingle).toHaveBeenCalledWith(
        'example.com',
        QueryType.Both,
        10000
      );
    });

    it('应该支持不同的查询类型', async () => {
      const mockNetworkResponse = {
        host: 'example.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

      await resolver.getHttpDnsResultForHostSync('example.com', { queryType: QueryType.IPv4 });

      expect(mockNetworkManager.resolveSingle).toHaveBeenCalledWith(
        'example.com',
        QueryType.IPv4,
        5000 // Default timeout from config
      );
    });

    it('应该在网络解析失败时返回失败结果', async () => {
      const networkError = new Error('Network failed');
      mockNetworkManager.resolveSingle.mockRejectedValue(networkError);

      const result = await resolver.getHttpDnsResultForHostSync('example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe(networkError);
      expect(result.domain).toBe('example.com');
      expect(result.ipv4).toEqual([]);
      expect(result.ipv6).toEqual([]);
    });
  });

  describe('resolveNonBlocking - 同步非阻塞解析', () => {
    it('应该在缓存命中时立即返回缓存结果', () => {
      const mockResult = {
        domain: 'example.com',
        ipv4: ['1.2.3.4'],
        ipv6: [],
        ttl: 300,
        timestamp: new Date(),
        success: true,
      };

      // Pre-populate cache
      const cacheManager = resolver.getCacheManager();
      cacheManager.set('example.com:4,6', mockResult, 300);

      const result = resolver.getHttpDnsResultForHostSyncNonBlocking('example.com');

      expect(result).toEqual(mockResult);
      expect(mockNetworkManager.resolveSingle).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时返回null并异步发起解析', (done) => {
      const mockNetworkResponse = {
        host: 'example.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

      const result = resolver.getHttpDnsResultForHostSyncNonBlocking('example.com');

      expect(result).toBeNull();

      // Wait for async resolution to complete
      setTimeout(() => {
        expect(mockNetworkManager.resolveSingle).toHaveBeenCalledWith(
          'example.com',
          QueryType.Both,
          5000 // Default timeout from config
        );

        // Check cache was updated
        const cacheManager = resolver.getCacheManager();
        const cachedResult = cacheManager.get('example.com:4,6');
        expect(cachedResult).toBeDefined();
        expect(cachedResult!.domain).toBe('example.com');
        done();
      }, 100);
    });

    it('应该在缓存过期时返回null并异步更新', (done) => {
      const expiredResult = {
        domain: 'example.com',
        ipv4: ['1.2.3.4'],
        ipv6: [],
        ttl: 300,
        timestamp: new Date(),
        success: true,
      };

      // Add expired cache entry
      const cacheManager = resolver.getCacheManager();
      cacheManager.set('example.com:4,6', expiredResult, 0.01); // 10ms TTL

      setTimeout(() => {
        const mockNetworkResponse = {
          host: 'example.com',
          ips: ['5.6.7.8'], // Different IP
          ttl: 300,
        };

        mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

        const result = resolver.getHttpDnsResultForHostSyncNonBlocking('example.com');
        expect(result).toBeNull(); // Cache expired

        // Wait for async resolution
        setTimeout(() => {
          const updatedResult = cacheManager.get('example.com:4,6');
          expect(updatedResult).toBeDefined();
          expect(updatedResult!.ipv4).toEqual(['5.6.7.8']);
          done();
        }, 100);
      }, 50); // Wait for cache to expire
    });

    it('应该支持不同的查询类型', () => {
      const mockResult = {
        domain: 'example.com',
        ipv4: ['1.2.3.4'],
        ipv6: [],
        ttl: 300,
        timestamp: new Date(),
        success: true,
      };

      // Pre-populate cache with IPv4 specific key
      const cacheManager = resolver.getCacheManager();
      cacheManager.set('example.com:4', mockResult, 300);

      const result = resolver.getHttpDnsResultForHostSyncNonBlocking('example.com', { queryType: QueryType.IPv4 });

      expect(result).toEqual(mockResult);
    });

    it('应该在异步解析失败时不影响缓存', (done) => {
      const networkError = new Error('Network failed');
      mockNetworkManager.resolveSingle.mockRejectedValue(networkError);

      const result = resolver.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result).toBeNull();

      // Wait for async resolution to fail
      setTimeout(() => {
        const cacheManager = resolver.getCacheManager();
        const cachedResult = cacheManager.get('example.com:4,6');
        expect(cachedResult).toBeNull(); // Should not cache failed results
        done();
      }, 100);
    });
  });

  describe('缓存禁用场景', () => {
    beforeEach(() => {
      // Disable cache
      mockConfig.enableCache = false;
      resolver = new Resolver(mockConfig);
      (resolver as any).networkManager = mockNetworkManager;
    });

    it('应该在禁用缓存时不使用缓存', async () => {
      const mockNetworkResponse = {
        host: 'example.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

      // First call
      await resolver.getHttpDnsResultForHostSync('example.com');
      expect(mockNetworkManager.resolveSingle).toHaveBeenCalledTimes(1);

      // Second call should also hit network (no cache)
      await resolver.getHttpDnsResultForHostSync('example.com');
      expect(mockNetworkManager.resolveSingle).toHaveBeenCalledTimes(2);
    });

    it('应该在禁用缓存时resolveNonBlocking总是返回null', () => {
      const result = resolver.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result).toBeNull();
    });
  });

  describe('移除的接口验证', () => {
    it('应该不再有resolve方法', () => {
      expect((resolver as any).resolve).toBeUndefined();
    });

    it('应该不再有resolveBatch方法', () => {
      expect((resolver as any).resolveBatch).toBeUndefined();
    });

    it('应该不再有resolveAsync方法', () => {
      expect((resolver as any).resolveAsync).toBeUndefined();
    });
  });

  describe('错误处理', () => {
    it('应该在resolveSync中正确处理网络错误', async () => {
      const networkError = new Error('Connection failed');
      mockNetworkManager.resolveSingle.mockRejectedValue(networkError);

      const result = await resolver.getHttpDnsResultForHostSync('example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe(networkError);
      expect(result.domain).toBe('example.com');
      expect(result.ipv4).toEqual([]);
      expect(result.ipv6).toEqual([]);
      expect(result.ttl).toBe(0);
    });

    it('应该在resolveNonBlocking异步解析失败时不抛出错误', (done) => {
      const networkError = new Error('Connection failed');
      mockNetworkManager.resolveSingle.mockRejectedValue(networkError);

      // Should not throw
      const result = resolver.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result).toBeNull();

      // Wait to ensure async operation completes without throwing
      setTimeout(() => {
        // If we get here, the async operation didn't throw
        done();
      }, 100);
    });
  });

  describe('缓存键生成', () => {
    it('应该为不同查询类型生成不同的缓存键', async () => {
      const mockNetworkResponse = {
        host: 'example.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValue(mockNetworkResponse);

      // Resolve with IPv4
      await resolver.getHttpDnsResultForHostSync('example.com', { queryType: QueryType.IPv4 });

      // Resolve with IPv6
      await resolver.getHttpDnsResultForHostSync('example.com', { queryType: QueryType.IPv6 });

      const cacheManager = resolver.getCacheManager();

      // Should have separate cache entries
      expect(cacheManager.has('example.com:4')).toBe(true);
      expect(cacheManager.has('example.com:6')).toBe(true);
      expect(cacheManager.size()).toBe(2);
    });
  });
});