/**
 * 集成测试验证
 */

import { createClient } from '../index';
import { HTTPDNSClient } from '../types';
import { QueryType } from '../types';

// Mock axios for controlled testing
jest.mock('axios');

describe('Integration Tests', () => {
  let client: HTTPDNSClient;
  const mockConfig = {
    accountId: 'test-account',
    secretKey: 'test-secret',
    bootstrapIPs: ['203.107.1.1'],
    enableCache: true,
    maxRetries: 2,
    timeout: 5000,
  };

  // Helper function to setup mock with service IPs and DNS response
  const setupMockWithResponses = (dnsResponse: any, serviceIPResponse = { service_ip: ['203.107.1.100', '203.107.1.101'] }) => {
    const mockAxios = require('axios');
    const mockGet = jest.fn()
      .mockResolvedValueOnce({ data: serviceIPResponse }) // First call for service IPs
      .mockResolvedValue({ data: dnsResponse }); // Subsequent calls for DNS resolution

    mockAxios.create.mockReturnValue({
      get: mockGet,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    });

    return mockGet;
  };

  // Helper function to setup mock with error
  const setupMockWithError = (error: any, serviceIPResponse = { service_ip: ['203.107.1.100', '203.107.1.101'] }) => {
    const mockAxios = require('axios');
    const mockGet = jest.fn()
      .mockResolvedValueOnce({ data: serviceIPResponse }) // First call for service IPs
      .mockRejectedValue(error); // Subsequent calls fail

    mockAxios.create.mockReturnValue({
      get: mockGet,
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    });

    return mockGet;
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (client) {
      client.close();
      client = null as any;
    }
    jest.clearAllMocks();
  });

  describe('端到端解析流程测试', () => {
    it('应该完成完整的解析流程：网络请求 -> 缓存 -> 缓存命中', async () => {
      const mockServiceIPResponse = {
        service_ip: ['203.107.1.100', '203.107.1.101'],
      };

      const mockDNSResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4', '5.6.7.8'],
              ttl: 300,
            },
          }],
        },
      };

      // Mock network response
      const mockAxios = require('axios');
      const mockGet = jest.fn()
        .mockResolvedValueOnce({ data: mockServiceIPResponse }) // First call for service IPs
        .mockResolvedValue({ data: mockDNSResponse }); // Subsequent calls for DNS resolution

      mockAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      client = createClient(mockConfig);

      // First call - should hit network
      const result1 = await client.getHttpDnsResultForHostSync('example.com');
      expect(result1.success).toBe(true);
      expect(result1.ipv4).toEqual(['1.2.3.4', '5.6.7.8']);

      // Second call - should hit cache
      const result2 = await client.getHttpDnsResultForHostSync('example.com');
      expect(result2.success).toBe(true);
      expect(result2.ipv4).toEqual(['1.2.3.4', '5.6.7.8']);

      // Verify network was called twice: once for service IPs, once for DNS resolution
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('应该支持非阻塞解析的完整流程', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      setupMockWithResponses(mockResponse);
      client = createClient(mockConfig);

      // First call - should return null and trigger async resolution
      const result1 = client.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result1).toBeNull();

      // Wait for async resolution to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second call - should return cached result
      const result2 = client.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result2).not.toBeNull();
      expect(result2!.success).toBe(true);
      expect(result2!.ipv4).toEqual(['1.2.3.4']);
    });

    it('应该正确处理不同查询类型', async () => {
      const mockIPv4Response = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      const mockIPv6Response = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v6: {
              ips: ['2001:db8::1'],
              ttl: 300,
            },
          }],
        },
      };

      // Mock network responses
      const mockAxios = require('axios');
      const serviceIPResponse = { service_ip: ['203.107.1.100', '203.107.1.101'] };
      const mockGet = jest.fn()
        .mockResolvedValueOnce({ data: serviceIPResponse }) // Service IPs
        .mockResolvedValueOnce({ data: mockIPv4Response })  // IPv4 response
        .mockResolvedValueOnce({ data: mockIPv6Response }); // IPv6 response

      mockAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      client = createClient(mockConfig);

      // Resolve IPv4
      const ipv4Result = await client.getHttpDnsResultForHostSync('example.com', { queryType: QueryType.IPv4 });
      expect(ipv4Result.success).toBe(true);
      expect(ipv4Result.ipv4).toEqual(['1.2.3.4']);
      expect(ipv4Result.ipv6).toEqual([]);

      // Resolve IPv6
      const ipv6Result = await client.getHttpDnsResultForHostSync('example.com', { queryType: QueryType.IPv6 });
      expect(ipv6Result.success).toBe(true);
      expect(ipv6Result.ipv4).toEqual([]);
      expect(ipv6Result.ipv6).toEqual(['2001:db8::1']);

      // Should have made three network calls: 1 for service IPs + 2 for DNS resolution
      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });

  describe('错误场景处理测试', () => {
    it('应该正确处理网络错误', async () => {
      const networkError = new Error('Network connection failed');

      setupMockWithError(networkError);
      client = createClient(mockConfig);
      const result = await client.getHttpDnsResultForHostSync('example.com');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Network connection failed');
      expect(result.ipv4).toEqual([]);
      expect(result.ipv6).toEqual([]);
      expect(result.domain).toBe('example.com');
    });

    it('应该正确处理超时错误', async () => {
      const timeoutError = new Error('timeout');
      (timeoutError as any).code = 'ECONNABORTED';

      // Mock timeout error
      const mockAxios = require('axios');
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(timeoutError),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      setupMockWithError(timeoutError);
      client = createClient(mockConfig);
      const result = await client.getHttpDnsResultForHostSync('example.com', { timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('应该正确处理认证错误', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };

      // Mock auth error
      const mockAxios = require('axios');
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(authError),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      setupMockWithError(authError);
      client = createClient(mockConfig);
      const result = await client.getHttpDnsResultForHostSync('example.com');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Authentication failed');
    });

    it('应该在非阻塞解析中静默处理错误', async () => {
      const networkError = new Error('Network failed');

      // Mock network error
      const mockAxios = require('axios');
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(networkError),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      setupMockWithError(networkError);
      client = createClient(mockConfig);

      // Should not throw
      const result1 = client.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result1).toBeNull();

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still return null (no cached result due to error)
      const result2 = client.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result2).toBeNull();
    });
  });

  describe('并发安全测试', () => {
    it('应该能够处理并发解析请求', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      setupMockWithResponses(mockResponse);
      client = createClient(mockConfig);

      // Make multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(client.getHttpDnsResultForHostSync(`example${i}.com`));
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.domain).toBe('example.com'); // Mock always returns 'example.com'
        expect(result.ipv4).toEqual(['1.2.3.4']);
      });
    });

    it('应该能够处理并发缓存访问', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      const mockGet = setupMockWithResponses(mockResponse);
      client = createClient(mockConfig);

      // First request to populate cache
      await client.getHttpDnsResultForHostSync('example.com');

      // Multiple concurrent cache reads
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(client.getHttpDnsResultForHostSync('example.com'));
      }

      const results = await Promise.all(promises);

      // All should return cached results
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.ipv4).toEqual(['1.2.3.4']);
      });

      // Network should be called twice: once for service IPs, once for DNS resolution
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('配置项功能测试', () => {
    it('应该在禁用缓存时不使用缓存', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      const mockGet = setupMockWithResponses(mockResponse);

      const clientWithoutCache = createClient({
        ...mockConfig,
        enableCache: false,
      });

      // Multiple calls should all hit network
      await clientWithoutCache.getHttpDnsResultForHostSync('example.com');
      await clientWithoutCache.getHttpDnsResultForHostSync('example.com');

      // Should be called 3 times: 1 for service IPs + 2 for DNS resolution
      expect(mockGet).toHaveBeenCalledTimes(3);

      clientWithoutCache.close();
    });

    it('应该支持自定义超时配置', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      const mockGet = setupMockWithResponses(mockResponse);
      client = createClient(mockConfig);

      await client.getHttpDnsResultForHostSync('example.com', { timeout: 10000 });

      // Verify timeout was passed to axios
      expect(mockGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('应该支持重试配置', async () => {
      const networkError = new Error('Network failed');

      const mockGet = setupMockWithError(networkError);

      const clientWithRetries = createClient({
        ...mockConfig,
        maxRetries: 3,
      });

      const result = await clientWithRetries.getHttpDnsResultForHostSync('example.com');

      expect(result.success).toBe(false);
      // Should have tried 1 + 3 retries = 4 times (plus 1 for service IPs)
      expect(mockGet).toHaveBeenCalledTimes(5);

      clientWithRetries.close();
    });
  });

  describe('资源清理测试', () => {
    it('应该能够正确关闭客户端', () => {
      client = createClient(mockConfig);
      expect(() => {
        client.close();
      }).not.toThrow();
    });

    it('应该在关闭后拒绝新的解析请求', async () => {
      client = createClient(mockConfig);
      client.close();

      await expect(client.getHttpDnsResultForHostSync('example.com')).rejects.toThrow();
    });

    it('应该能够多次调用close而不出错', () => {
      client = createClient(mockConfig);
      expect(() => {
        client.close();
        client.close();
        client.close();
      }).not.toThrow();
    });
  });

  describe('缓存TTL和过期测试', () => {
    it('应该在缓存过期后重新发起网络请求', async () => {
      const mockResponse1 = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 0.1, // 100ms TTL
            },
          }],
        },
      };

      const mockResponse2 = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['5.6.7.8'],
              ttl: 300,
            },
          }],
        },
      };

      // Mock network responses
      const mockAxios = require('axios');
      const serviceIPResponse = { service_ip: ['203.107.1.100', '203.107.1.101'] };
      const mockGet = jest.fn()
        .mockResolvedValueOnce({ data: serviceIPResponse }) // Service IPs
        .mockResolvedValueOnce({ data: mockResponse1 })     // First DNS response
        .mockResolvedValueOnce({ data: mockResponse2 });    // Second DNS response

      mockAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      client = createClient(mockConfig);

      // First request
      const result1 = await client.getHttpDnsResultForHostSync('example.com');
      expect(result1.ipv4).toEqual(['1.2.3.4']);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second request should hit network again
      const result2 = await client.getHttpDnsResultForHostSync('example.com');
      expect(result2.ipv4).toEqual(['5.6.7.8']);

      expect(mockGet).toHaveBeenCalledTimes(3);
    });
  });
});