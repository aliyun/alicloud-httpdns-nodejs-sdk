/**
 * 解析器测试
 */

import { Resolver } from '../resolver';
import { NetworkManager } from '../network';
import { mergeConfig } from '../config';
import { QueryType } from '../types';
import { HTTPDNSError } from '../errors';

// Mock NetworkManager
jest.mock('../network');
const MockedNetworkManager = NetworkManager as jest.MockedClass<typeof NetworkManager>;

describe('Resolver', () => {
  let resolver: Resolver;
  let mockNetworkManager: jest.Mocked<NetworkManager>;

  beforeEach(() => {
    // 清除所有mock
    jest.clearAllMocks();

    // 创建mock网络管理器
    mockNetworkManager = {
      resolve: jest.fn(),
      getServiceIPManager: jest.fn(),
      close: jest.fn(),
    } as any;

    MockedNetworkManager.mockImplementation(() => mockNetworkManager);

    // 创建解析器
    const config = mergeConfig({
      accountId: 'test-account-id',
    });
    resolver = new Resolver(config);
  });

  afterEach(() => {
    resolver.close();
  });

  describe('resolveSync', () => {
    test('should resolve single domain successfully', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: ['1.2.3.4', '5.6.7.8'],
              ttl: 300,
            },
            v6: {
              ips: ['2001:db8::1'],
              ttl: 300,
            },
          }],
        },
      };

      mockNetworkManager.resolve.mockResolvedValueOnce(mockResponse);

      const result = await resolver.getHttpDnsResultForHostSync('baidu.com');

      expect(result).toEqual({
        domain: 'baidu.com',
        success: true,
        ipv4: ['1.2.3.4', '5.6.7.8'],
        ipv6: ['2001:db8::1'],
        ttl: 300,
        timestamp: expect.any(Date),
      });

      expect(mockNetworkManager.resolve).toHaveBeenCalledWith(
        'baidu.com',
        QueryType.Both,
        5000
      );
    });

    test('should resolve with different query types', async () => {
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

      mockNetworkManager.resolve.mockResolvedValueOnce(mockResponse);

      await resolver.getHttpDnsResultForHostSync('baidu.com', {
        queryType: QueryType.IPv4,
      });

      expect(mockNetworkManager.resolve).toHaveBeenCalledWith(
        'baidu.com',
        QueryType.IPv4,
        5000
      );
    });

    test('should handle resolution failure', async () => {
      const error = new HTTPDNSError('HTTP_REQUEST', 'baidu.com', new Error('Network error'));
      mockNetworkManager.resolve.mockRejectedValueOnce(error);

      const result = await resolver.getHttpDnsResultForHostSync('baidu.com');

      expect(result).toEqual({
        domain: 'baidu.com',
        success: false,
        ipv4: [],
        ipv6: [],
        ttl: 0,
        timestamp: expect.any(Date),
        error: error,
      });
    });

    test('should handle empty response', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
            v4: {
              ips: [],
              ttl: 300,
            },
          }],
        },
      };

      mockNetworkManager.resolve.mockResolvedValueOnce(mockResponse);

      const result = await resolver.getHttpDnsResultForHostSync('baidu.com');

      expect(result.ipv4).toEqual([]);
      expect(result.ipv6).toEqual([]);
    });
  });

  describe('getNetworkManager', () => {
    test('should return network manager', () => {
      const networkManager = resolver.getNetworkManager();
      expect(networkManager).toBe(mockNetworkManager);
    });
  });

  describe('parameter validation', () => {
    test('should throw error for invalid domain', async () => {
      await expect(resolver.getHttpDnsResultForHostSync('')).rejects.toThrow('Domain must be a non-empty string');
      await expect(resolver.getHttpDnsResultForHostSync('invalid..domain')).rejects.toThrow('Invalid domain format');
    });
  });

  describe('close', () => {
    test('should close resolver', () => {
      resolver.close();
      expect(mockNetworkManager.close).toHaveBeenCalled();
    });
  });

  describe('预解析功能', () => {
    test('应该能够预解析域名列表', async () => {
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

      mockNetworkManager.resolve.mockResolvedValue(mockResponse);

      resolver.setPreResolveHosts(['example.com', 'test.com']);

      // 等待异步解析完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 应该调用了resolve
      expect(mockNetworkManager.resolve).toHaveBeenCalled();
    });

    test('应该拒绝超过100个域名的预解析', () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const config = mergeConfig({
        accountId: 'test-account-id',
        logger: mockLogger,
      });
      const resolverWithLogger = new Resolver(config);

      const domains = Array.from({ length: 101 }, (_, i) => `example${i}.com`);
      resolverWithLogger.setPreResolveHosts(domains);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('exceeds limit')
      );

      resolverWithLogger.close();
    });

    test('应该过滤无效域名', async () => {
      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'valid.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 300,
            },
          }],
        },
      };

      mockNetworkManager.resolve.mockResolvedValue(mockResponse);

      resolver.setPreResolveHosts([
        'valid.com',
        'invalid..domain',
        '1.2.3.4', // IP地址应该被过滤
        '',
      ]);

      await new Promise(resolve => setTimeout(resolve, 100));

      // 只有valid.com应该被解析
      expect(mockNetworkManager.resolve).toHaveBeenCalledTimes(1);
    });

    test('应该跳过已有缓存的域名', async () => {
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

      mockNetworkManager.resolve.mockResolvedValue(mockResponse);

      // 先解析一次，建立缓存
      await resolver.getHttpDnsResultForHostSync('example.com');
      expect(mockNetworkManager.resolve).toHaveBeenCalledTimes(1);

      // 预解析相同域名，应该跳过
      resolver.setPreResolveHosts(['example.com', 'new.com']);

      await new Promise(resolve => setTimeout(resolve, 100));

      // 只应该解析new.com，总共2次调用
      expect(mockNetworkManager.resolve).toHaveBeenCalledTimes(2);
    });

    test('应该记录解析失败的日志', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const config = mergeConfig({
        accountId: 'test-account-id',
        logger: mockLogger,
      });
      const resolverWithLogger = new Resolver(config);

      // 批量预解析会将两个域名拼成一个字符串请求
      mockNetworkManager.resolve.mockRejectedValueOnce(new Error('Network error'));

      resolverWithLogger.setPreResolveHosts(['success.com', 'fail.com']);

      // 等待足够长的时间让Promise.allSettled完成
      await new Promise(resolve => setTimeout(resolve, 500));

      // 检查info日志被调用（预解析完成统计）
      expect(mockLogger.info).toHaveBeenCalled();
      const infoCalls = mockLogger.info.mock.calls;
      
      // 打印所有info调用，用于调试
      // console.log('Info calls:', infoCalls);
      
      const hasPreResolveLog = infoCalls.some(call =>
        call[0] && call[0].includes && call[0].includes('Pre-resolve')
      );
      expect(hasPreResolveLog).toBe(true);
      
      // 检查失败统计（可能是 "0/1 batches succeeded, 1 failed" 或其他格式）
      const hasFailedInfo = infoCalls.some(call =>
        call[0] && call[0].includes && (
          call[0].includes('failed') || 
          call[0].includes('0/1 batches succeeded')
        )
      );
      expect(hasFailedInfo).toBe(true);

      resolverWithLogger.close();
    });
  });

  describe('过期IP功能', () => {
    test('应该在enableExpiredIP=false时不返回过期缓存', async () => {
      const config = mergeConfig({
        accountId: 'test-account-id',
        enableExpiredIP: false,
      });
      const resolverWithoutExpiredIP = new Resolver(config);

      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 0.1, // 100ms
            },
          }],
        },
      };

      mockNetworkManager.resolve.mockResolvedValue(mockResponse);

      // 先解析一次
      await resolverWithoutExpiredIP.getHttpDnsResultForHostSync('example.com');

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 再次解析，应该发起新请求
      await resolverWithoutExpiredIP.getHttpDnsResultForHostSync('example.com');

      // 应该调用了2次resolve
      expect(mockNetworkManager.resolve).toHaveBeenCalledTimes(2);

      resolverWithoutExpiredIP.close();
    });

    test('应该在enableExpiredIP=true时返回过期缓存', async () => {
      const config = mergeConfig({
        accountId: 'test-account-id',
        enableExpiredIP: true,
      });
      const resolverWithExpiredIP = new Resolver(config);

      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 0.1, // 100ms
            },
          }],
        },
      };

      mockNetworkManager.resolve.mockResolvedValue(mockResponse);

      // 先解析一次
      const result1 = await resolverWithExpiredIP.getHttpDnsResultForHostSync('example.com');
      expect(result1.ipv4).toEqual(['1.2.3.4']);

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 再次解析，应该返回过期缓存
      const result2 = await resolverWithExpiredIP.getHttpDnsResultForHostSync('example.com');
      expect(result2.ipv4).toEqual(['1.2.3.4']);

      // 应该调用了2次resolve（第一次正常解析，第二次后台更新）
      // 但由于后台更新是异步的，可能还没完成，所以至少调用了1次
      expect(mockNetworkManager.resolve).toHaveBeenCalledTimes(2);

      resolverWithExpiredIP.close();
    });

    test('应该在返回过期缓存后触发后台更新', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const config = mergeConfig({
        accountId: 'test-account-id',
        enableExpiredIP: true,
        logger: mockLogger,
      });
      const resolverWithExpiredIP = new Resolver(config);

      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 0.1, // 100ms
            },
          }],
        },
      };

      mockNetworkManager.resolve.mockResolvedValue(mockResponse);

      // 先解析一次
      await resolverWithExpiredIP.getHttpDnsResultForHostSync('example.com');

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 再次解析，应该返回过期缓存并触发后台更新
      await resolverWithExpiredIP.getHttpDnsResultForHostSync('example.com');

      // 应该记录使用过期缓存的日志
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('expired cache')
      );

      // 等待后台更新
      await new Promise(resolve => setTimeout(resolve, 100));

      // 应该调用了2次resolve（第一次正常解析，第二次后台更新）
      expect(mockNetworkManager.resolve).toHaveBeenCalledTimes(2);

      resolverWithExpiredIP.close();
    });

    test('应该在非阻塞模式下返回过期缓存', async () => {
      const config = mergeConfig({
        accountId: 'test-account-id',
        enableExpiredIP: true,
      });
      const resolverWithExpiredIP = new Resolver(config);

      const mockResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'example.com',
            v4: {
              ips: ['1.2.3.4'],
              ttl: 0.1, // 100ms
            },
          }],
        },
      };

      mockNetworkManager.resolve.mockResolvedValue(mockResponse);

      // 先解析一次
      await resolverWithExpiredIP.getHttpDnsResultForHostSync('example.com');

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 非阻塞模式获取，应该返回过期缓存
      const result = resolverWithExpiredIP.getHttpDnsResultForHostSyncNonBlocking('example.com');
      expect(result).not.toBeNull();
      expect(result?.ipv4).toEqual(['1.2.3.4']);

      resolverWithExpiredIP.close();
    });
  });
});