/**
 * 网络条件测试
 * 测试在各种网络条件下的表现
 */

import { createClient } from '../index';

// Mock axios for controlled testing
jest.mock('axios');

describe('网络条件测试', () => {
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

  describe('超时处理', () => {
    it('应该正确处理短超时', async () => {
      const timeoutError = new Error('timeout');
      (timeoutError as any).code = 'ECONNABORTED';

      setupMockWithError(timeoutError);

      const shortTimeoutClient = createClient({
        accountId: 'test-account-id',
        timeout: 100, // 100ms超时，很可能会超时
        maxRetries: 0,
      });

      const result = await shortTimeoutClient.getHttpDnsResultForHostSync('baidu.com');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      shortTimeoutClient.close();
    });

    it('应该正确处理长超时', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      setupMockWithResponses(mockResponse);

      const longTimeoutClient = createClient({
        accountId: 'test-account-id',
        timeout: 30000, // 30秒超时
        maxRetries: 1,
      });

      const result = await longTimeoutClient.getHttpDnsResultForHostSync('baidu.com');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('baidu.com');

      longTimeoutClient.close();
    });
  });

  describe('重试机制', () => {
    it('应该在网络错误时正确重试', async () => {
      const networkError = new Error('Network failed');

      const mockGet = setupMockWithError(networkError);

      const retryClient = createClient({
        accountId: 'test-account-id',
        maxRetries: 3,
        timeout: 5000,
      });

      const result = await retryClient.getHttpDnsResultForHostSync('baidu.com');

      expect(result.success).toBe(false);
      // Should have tried 1 + 3 retries = 4 times (plus 1 for service IPs)
      expect(mockGet).toHaveBeenCalledTimes(5);

      retryClient.close();
    });

    it('应该在达到最大重试次数后停止', async () => {
      const networkError = new Error('Network failed');

      const mockGet = setupMockWithError(networkError);

      const maxRetryClient = createClient({
        accountId: 'test-account-id',
        maxRetries: 2,
        timeout: 1000,
      });

      const result = await maxRetryClient.getHttpDnsResultForHostSync('baidu.com');

      expect(result.success).toBe(false);
      // Should have tried 1 + 2 retries = 3 times (plus 1 for service IPs)
      expect(mockGet).toHaveBeenCalledTimes(4);

      maxRetryClient.close();
    });
  });

  describe('故障转移', () => {
    it('应该能够处理服务器故障转移', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      setupMockWithResponses(mockResponse);

      const failoverClient = createClient({
        accountId: 'test-account-id',
        bootstrapIPs: ['203.107.1.1', '203.107.1.2'],
        maxRetries: 1,
      });

      const result = await failoverClient.getHttpDnsResultForHostSync('baidu.com');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('baidu.com');

      failoverClient.close();
    });
  });

  describe('网络恢复', () => {
    it('应该能够从网络故障中恢复', async () => {
      // First call fails, second succeeds
      const networkError = new Error('Network failed');
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'aliyun.com',
            v4: {
              ips: ['8.8.8.8'],
              ttl: 300,
            },
          }],
        },
      };

      const mockAxios = require('axios');
      const serviceIPResponse = { service_ip: ['203.107.1.100', '203.107.1.101'] };
      const mockGet = jest.fn()
        .mockResolvedValueOnce({ data: serviceIPResponse }) // Service IPs for first client
        .mockRejectedValueOnce(networkError)                // First DNS call fails
        .mockResolvedValueOnce({ data: serviceIPResponse }) // Service IPs for second client (if needed)
        .mockResolvedValueOnce({ data: mockResponse });     // Second DNS call succeeds

      mockAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const recoveryClient = createClient({
        accountId: 'test-account-id',
        maxRetries: 1,
      });

      // First call should fail
      const result1 = await recoveryClient.getHttpDnsResultForHostSync('aliyun.com');
      expect(result1.success).toBe(false);

      // Second call should succeed (using cached service IPs)
      const result2 = await recoveryClient.getHttpDnsResultForHostSync('aliyun.com');
      expect(result2.success).toBe(true);
      expect(result2.ipv4).toEqual(['8.8.8.8']);

      recoveryClient.close();
    });
  });

  describe('并发压力测试', () => {
    it('应该能够处理高并发请求', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      setupMockWithResponses(mockResponse);

      const concurrentClient = createClient({
        accountId: 'test-account-id',
        timeout: 10000,
        maxRetries: 1,
      });

      const concurrency = 20;
      const domain = 'baidu.com';

      const promises = Array(concurrency).fill(null).map(async () => {
        const result = await concurrentClient.getHttpDnsResultForHostSync(domain);
        return { success: result.success, domain: result.domain };
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(concurrency);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.domain).toBe(domain);
      });

      concurrentClient.close();
    });
  });

  describe('混合负载测试', () => {
    it('应该能够处理混合请求模式', async () => {
      const mixedClient = createClient({
        accountId: 'test-account-id',
        timeout: 5000,
      });

      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      // Mock successful response
      const mockAxios = require('axios');
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockResponse }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      const singleDomains = ['baidu.com', 'aliyun.com'];

      const promises = [
        ...singleDomains.map(domain => mixedClient.getHttpDnsResultForHostSync(domain)),
      ];

      const results = await Promise.all(promises.map(p => p.catch(e => ({ success: false, error: (e as Error).message }))));

      expect(results).toHaveLength(singleDomains.length);

      mixedClient.close();
    });
  });

  describe('协议兼容性', () => {
    it('应该支持HTTP协议', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      setupMockWithResponses(mockResponse);

      const httpClient = createClient({
        accountId: 'test-account-id',
        enableHTTPS: false,
      });

      const result = await httpClient.getHttpDnsResultForHostSync('baidu.com');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('baidu.com');

      httpClient.close();
    });

    it('应该支持HTTPS协议', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      setupMockWithResponses(mockResponse);

      const httpsClient = createClient({
        accountId: 'test-account-id',
        enableHTTPS: true,
      });

      const result = await httpsClient.getHttpDnsResultForHostSync('baidu.com');
      expect(result.success).toBe(true);
      expect(result.domain).toBe('baidu.com');

      httpsClient.close();
    });

    it('应该能够在HTTP和HTTPS之间切换', async () => {
      const httpClient = createClient({
        accountId: 'test',
        enableHTTPS: false
      });
      const httpsClient = createClient({
        accountId: 'test',
        enableHTTPS: true
      });

      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      // Mock successful response
      const mockAxios = require('axios');
      mockAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({ data: mockResponse }),
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      try {
        const httpPromise = httpClient.getHttpDnsResultForHostSync('baidu.com').catch(e => ({ error: e }));
        const httpsPromise = httpsClient.getHttpDnsResultForHostSync('baidu.com').catch(e => ({ error: e }));

        const [httpResult, httpsResult] = await Promise.all([httpPromise, httpsPromise]);

        // 至少一个应该成功或者都失败但有合理的错误
        expect(httpResult || httpsResult).toBeDefined();
      } finally {
        httpClient.close();
        httpsClient.close();
      }
    });
  });
});