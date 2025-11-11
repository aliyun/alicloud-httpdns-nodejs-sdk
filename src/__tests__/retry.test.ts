/**
 * 重试机制单元测试
 */

import { NetworkManager } from '../network';
import { MergedConfig } from '../config';
import { HTTPDNSError } from '../errors';
import { QueryType } from '../types';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    interceptors: {
      request: {
        use: jest.fn()
      },
      response: {
        use: jest.fn()
      }
    }
  }))
}));

describe('NetworkManager Retry Mechanism', () => {
  let networkManager: NetworkManager;
  let mockConfig: MergedConfig;

  beforeEach(() => {
    mockConfig = {
      accountId: 'test-account',
      bootstrapIPs: ['203.107.1.1'],
      timeout: 5000,
      maxRetries: 2,
      enableHTTPS: false,
      httpsSNIHost: 'httpdns-api.aliyuncs.com',
      enableCache: true,
      enableExpiredIP: false,
    };

    networkManager = new NetworkManager(mockConfig);
  });

  afterEach(() => {
    networkManager.close();
    jest.clearAllMocks();
  });

  describe('成功重试场景', () => {
    it('应该在第一次失败后成功重试', async () => {
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

      // Mock axios to fail first, then succeed
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNRESET'; // Make it a network error
      const mockGet = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: mockResponse });

      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn().mockReturnValue('203.107.1.1'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn().mockReturnValue('203.107.1.1'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      const result = await networkManager.resolve('example.com', QueryType.Both);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledTimes(1);
      expect(mockServiceIPManager.markIPSuccess).toHaveBeenCalledTimes(1);
    });

    it('应该在多次失败后最终成功', async () => {
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

      // Mock axios to fail twice, then succeed
      const networkError1 = new Error('Network error 1');
      (networkError1 as any).code = 'ECONNRESET';
      const networkError2 = new Error('Network error 2');
      (networkError2 as any).code = 'ETIMEDOUT';
      const mockGet = jest.fn()
        .mockRejectedValueOnce(networkError1)
        .mockRejectedValueOnce(networkError2)
        .mockResolvedValueOnce({ data: mockResponse });

      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn().mockReturnValue('203.107.1.1'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn().mockReturnValue('203.107.1.1'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      const result = await networkManager.resolve('example.com', QueryType.Both);

      expect(result).toEqual(mockResponse);
      expect(mockGet).toHaveBeenCalledTimes(3);
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledTimes(2);
      expect(mockServiceIPManager.markIPSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('达到最大重试次数', () => {
    it('应该在达到最大重试次数后抛出错误', async () => {
      // Mock axios to always fail
      const persistentError = new Error('Persistent network error');
      (persistentError as any).code = 'ECONNRESET';
      const mockGet = jest.fn().mockRejectedValue(persistentError);
      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn().mockReturnValue('203.107.1.1'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn().mockReturnValue('203.107.1.1'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      await expect(networkManager.resolve('example.com', QueryType.Both))
        .rejects.toThrow('Persistent network error');

      // Should try maxRetries + 1 times (initial + retries)
      expect(mockGet).toHaveBeenCalledTimes(3); // 1 + 2 retries
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledTimes(3);
      expect(mockServiceIPManager.markIPSuccess).not.toHaveBeenCalled();
    });

    it('应该记录重试过程', async () => {
      const mockLogger = {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      (networkManager as any).logger = mockLogger;

      // Mock axios to always fail
      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNRESET';
      const mockGet = jest.fn().mockRejectedValue(networkError);
      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn().mockReturnValue('203.107.1.1'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn().mockReturnValue('203.107.1.1'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      await expect(networkManager.resolve('example.com', QueryType.Both))
        .rejects.toThrow();

      // Should log retry attempts
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Marked service IP 203.107.1.1 as failed')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Retrying request for example.com')
      );
    });
  });

  describe('不可重试错误的快速失败', () => {
    it('应该对认证失败错误立即失败', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };

      const mockGet = jest.fn().mockRejectedValue(authError);
      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn().mockReturnValue('203.107.1.1'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn().mockReturnValue('203.107.1.1'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      await expect(networkManager.resolve('example.com', QueryType.Both))
        .rejects.toThrow('Authentication failed');

      // Should only try once, no retries
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockServiceIPManager.markIPFailed).not.toHaveBeenCalled();
    });

    it('应该对配置错误立即失败', async () => {
      const configError = new HTTPDNSError('CONFIG_ERROR', 'example.com', new Error('Invalid config'));

      const mockGet = jest.fn().mockRejectedValue(configError);
      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn().mockReturnValue('203.107.1.1'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn().mockReturnValue('203.107.1.1'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      await expect(networkManager.resolve('example.com', QueryType.Both))
        .rejects.toThrow('Invalid config');

      // Should only try once, no retries
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockServiceIPManager.markIPFailed).not.toHaveBeenCalled();
    });
  });

  describe('服务IP切换逻辑', () => {
    it('应该在重试时切换到不同的服务IP', async () => {
      const networkError1 = new Error('Network error 1');
      (networkError1 as any).code = 'ECONNRESET';
      const networkError2 = new Error('Network error 2');
      (networkError2 as any).code = 'ETIMEDOUT';
      const networkError3 = new Error('Network error 3');
      (networkError3 as any).code = 'ECONNREFUSED';
      const mockGet = jest.fn()
        .mockRejectedValueOnce(networkError1)
        .mockRejectedValueOnce(networkError2)
        .mockRejectedValueOnce(networkError3);

      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager to return different IPs
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn()
          .mockReturnValueOnce('203.107.1.1')
          .mockReturnValueOnce('203.107.1.2')
          .mockReturnValueOnce('203.107.1.3'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn()
          .mockReturnValueOnce('203.107.1.1')
          .mockReturnValueOnce('203.107.1.2')
          .mockReturnValueOnce('203.107.1.3'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      await expect(networkManager.resolve('example.com', QueryType.Both))
        .rejects.toThrow();

      // Should mark each IP as failed
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledWith('203.107.1.1');
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledWith('203.107.1.2');
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledWith('203.107.1.3');
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledTimes(3);
    });
  });

  describe('零重试配置', () => {
    it('应该在maxRetries为0时不进行重试', async () => {
      // Update config to disable retries
      mockConfig.maxRetries = 0;
      networkManager = new NetworkManager(mockConfig);

      const networkError = new Error('Network error');
      (networkError as any).code = 'ECONNRESET';
      const mockGet = jest.fn().mockRejectedValue(networkError);
      (networkManager as any).httpClient.get = mockGet;

      // Mock service IP manager
      const mockServiceIPManager = {
        getAvailableServiceIP: jest.fn().mockReturnValue('203.107.1.1'),
        markIPFailed: jest.fn(),
        markIPSuccess: jest.fn(),
        getCurrentIP: jest.fn().mockReturnValue('203.107.1.1'),
      };
      (networkManager as any).serviceIPManager = mockServiceIPManager;

      await expect(networkManager.resolve('example.com', QueryType.Both))
        .rejects.toThrow('Network error');

      // Should only try once
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockServiceIPManager.markIPFailed).toHaveBeenCalledTimes(1);
    });
  });
});