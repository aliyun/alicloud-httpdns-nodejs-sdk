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
      resolveSingle: jest.fn(),
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
        host: 'baidu.com',
        ips: ['1.2.3.4', '5.6.7.8'],
        ipsv6: ['2001:db8::1'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValueOnce(mockResponse);

      const result = await resolver.getHttpDnsResultForHostSync('baidu.com');

      expect(result).toEqual({
        domain: 'baidu.com',
        success: true,
        ipv4: ['1.2.3.4', '5.6.7.8'],
        ipv6: ['2001:db8::1'],
        ttl: 300,
        timestamp: expect.any(Date),
      });

      expect(mockNetworkManager.resolveSingle).toHaveBeenCalledWith(
        'baidu.com',
        QueryType.Both,
        5000
      );
    });

    test('should resolve with different query types', async () => {
      const mockResponse = {
        host: 'baidu.com',
        ips: ['1.2.3.4'],
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValueOnce(mockResponse);

      await resolver.getHttpDnsResultForHostSync('baidu.com', {
        queryType: QueryType.IPv4,
      });

      expect(mockNetworkManager.resolveSingle).toHaveBeenCalledWith(
        'baidu.com',
        QueryType.IPv4,
        5000
      );
    });

    test('should handle resolution failure', async () => {
      const error = new HTTPDNSError('HTTP_REQUEST', 'baidu.com', new Error('Network error'));
      mockNetworkManager.resolveSingle.mockRejectedValueOnce(error);

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
        host: 'baidu.com',
        ttl: 300,
      };

      mockNetworkManager.resolveSingle.mockResolvedValueOnce(mockResponse);

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
});