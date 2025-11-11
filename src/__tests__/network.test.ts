/**
 * 网络管理测试
 */

import axios from 'axios';
import { NetworkManager } from '../network';
import { QueryType } from '../types';
import { mergeConfig } from '../config';
import { HTTPDNSError } from '../errors';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NetworkManager', () => {
  let networkManager: NetworkManager;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();

    // 创建mock axios实例
    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // 创建测试配置
    const config = mergeConfig({
      accountId: 'test-account-id',
      timeout: 5000,
      maxRetries: 2, // 设置重试次数
    });

    networkManager = new NetworkManager(config);
  });

  describe('fetchServiceIPs', () => {
    test('should fetch service IPs from first bootstrap IP', async () => {
      const mockResponse = {
        data: {
          service_ip: ['192.168.1.1', '192.168.1.2'],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      await networkManager.fetchServiceIPs();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'http://203.107.1.1/test-account-id/ss?region=global'
      );
      expect(networkManager.getServiceIPManager().getServiceIPs()).toEqual([
        '192.168.1.1',
        '192.168.1.2',
      ]);
    });

    test('should try next bootstrap IP if first fails', async () => {
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            service_ip: ['192.168.1.3', '192.168.1.4'],
          },
        });

      await networkManager.fetchServiceIPs();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
        1,
        'http://203.107.1.1/test-account-id/ss?region=global'
      );
      expect(mockAxiosInstance.get).toHaveBeenNthCalledWith(
        2,
        'http://203.107.1.97/test-account-id/ss?region=global'
      );
    });

    test('should try bootstrap domain if all IPs fail', async () => {
      // 所有启动IP都失败，但是启动域名成功
      mockAxiosInstance.get
        .mockRejectedValueOnce(new Error('Network error')) // 第一个启动IP失败
        .mockRejectedValueOnce(new Error('Network error')) // 第二个启动IP失败
        .mockRejectedValueOnce(new Error('Network error')) // 第三个启动IP失败
        .mockRejectedValueOnce(new Error('Network error')) // 第四个启动IP失败
        .mockRejectedValueOnce(new Error('Network error')) // 第五个启动IP失败
        .mockRejectedValueOnce(new Error('Network error')) // 第六个启动IP失败
        .mockResolvedValueOnce({
          // 启动域名成功
          data: {
            service_ip: ['192.168.1.5'],
          },
        });

      await networkManager.fetchServiceIPs();

      // 应该调用启动域名
      expect(mockAxiosInstance.get).toHaveBeenLastCalledWith(
        'http://resolvers-cn.httpdns.aliyuncs.com/test-account-id/ss?region=global'
      );
    });

    test('should throw error if all sources fail', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(networkManager.fetchServiceIPs()).rejects.toThrow(HTTPDNSError);
    });

    test('should use HTTPS when enabled', async () => {
      const config = mergeConfig({
        accountId: 'test-account-id',
        enableHTTPS: true,
      });

      const httpsNetworkManager = new NetworkManager(config);
      const mockResponse = {
        data: {
          service_ip: ['192.168.1.1'],
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      await httpsNetworkManager.fetchServiceIPs();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'https://203.107.1.1/test-account-id/ss?region=global'
      );
    });
  });

  describe('resolve', () => {
    beforeEach(async () => {
      // 先设置服务IP
      const mockResponse = {
        data: {
          service_ip: ['192.168.1.1'],
        },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);
      await networkManager.fetchServiceIPs();
      jest.clearAllMocks();
    });

    test('should resolve single domain', async () => {
      const mockResponse = {
        data: {
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
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await networkManager.resolve('example.com');

      expect(result).toEqual(mockResponse.data);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'http://192.168.1.1/v2/d?id=test-account-id&dn=example.com&q=4,6',
        {}
      );
    });

    test('should resolve with different query types', async () => {
      const mockResponse = {
        data: {
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
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      await networkManager.resolve('example.com', QueryType.IPv4);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'http://192.168.1.1/v2/d?id=test-account-id&dn=example.com&q=4',
        {}
      );
    });

    test('should resolve without client IP', async () => {
      const mockResponse = {
        data: {
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
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      await networkManager.resolve('example.com');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        'http://192.168.1.1/v2/d?id=test-account-id&dn=example.com&q=4,6',
        {}
      );
    });

    test('should throw error for invalid domain', async () => {
      await expect(networkManager.resolve('invalid..domain')).rejects.toThrow(
        HTTPDNSError
      );
    });

    test('should mark IP failed on network error', async () => {
      const networkError = Object.assign(new Error('Network error'), { code: 'ECONNRESET' });
      mockAxiosInstance.get.mockRejectedValue(networkError);

      // Spy on the markIPFailed method
      const serviceIPManager = networkManager.getServiceIPManager();
      const markIPFailedSpy = jest.spyOn(serviceIPManager, 'markIPFailed');

      await expect(networkManager.resolve('example.com')).rejects.toThrow('NETWORK_ERROR');

      // IP应该被标记为失败
      expect(markIPFailedSpy).toHaveBeenCalledWith('192.168.1.1');
      
      // 清理spy
      markIPFailedSpy.mockRestore();
    });
  });



  describe('authenticated requests', () => {
    let authNetworkManager: NetworkManager;

    beforeEach(async () => {
      const config = mergeConfig({
        accountId: 'test-account-id',
        secretKey: 'test-secret-key',
      });

      authNetworkManager = new NetworkManager(config);

      // 设置服务IP
      const mockResponse = {
        data: {
          service_ip: ['192.168.1.1'],
        },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);
      await authNetworkManager.fetchServiceIPs();
      jest.clearAllMocks();
    });

    test('should make authenticated single resolve request', async () => {
      const mockResponse = {
        data: {
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
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      await authNetworkManager.resolve('example.com');

      const callUrl = mockAxiosInstance.get.mock.calls[0][0];
      expect(callUrl).toContain('/v2/d?');
      expect(callUrl).toContain('dn=example.com');
      expect(callUrl).toContain('exp=');
      expect(callUrl).toContain('s=');
    });


  });



  describe('close', () => {
    test('should close network manager', () => {
      expect(() => networkManager.close()).not.toThrow();
    });
  });
});