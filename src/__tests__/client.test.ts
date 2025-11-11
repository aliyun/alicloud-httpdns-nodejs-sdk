/**
 * 主客户端测试
 */

import { createClient, HTTPDNSClientImpl } from '../client';
import { HTTPDNSConfig } from '../types';
import { HTTPDNSError } from '../errors';

// Mock dependencies
jest.mock('../resolver', () => {
  return {
    Resolver: jest.fn().mockImplementation(() => {
      return {
        getHttpDnsResultForHostSync: jest.fn(),
        getHttpDnsResultForHostSyncNonBlocking: jest.fn(),
        updateServiceIPs: jest.fn().mockResolvedValue(undefined),
        getNetworkManager: jest.fn().mockReturnValue({
          fetchServiceIPs: jest.fn().mockResolvedValue(undefined),
          getServiceIPManager: jest.fn().mockReturnValue({
            getServiceIPs: jest.fn().mockReturnValue(['1.2.3.4']),
            getAvailableServiceIP: jest.fn().mockReturnValue('1.2.3.4'),
          }),
          close: jest.fn(),
        }),
        getServiceIPs: jest.fn().mockReturnValue(['1.2.3.4']),
        isHealthy: jest.fn().mockReturnValue(true),
        setPreResolveHosts: jest.fn(),
        close: jest.fn(),
      };
    }),
  };
});

describe('HTTPDNSClient', () => {
  let config: HTTPDNSConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      accountId: 'test-account-id',
      timeout: 5000,
    };
  });

  describe('createClient', () => {
    test('should create client with valid config', () => {
      const client = createClient(config);
      expect(client).toBeInstanceOf(HTTPDNSClientImpl);
    });

    test('should throw error with invalid config', () => {
      const invalidConfig = {} as HTTPDNSConfig;
      expect(() => createClient(invalidConfig)).toThrow(HTTPDNSError);
    });
  });

  describe('HTTPDNSClientImpl', () => {
    let client: HTTPDNSClientImpl;

    beforeEach(() => {
      client = new HTTPDNSClientImpl(config);
    });

    afterEach(async () => {
      await client.close();
    });

    describe('resolve', () => {
      test('should resolve domain successfully', async () => {
        // Mock resolver response
        const mockResult = {
          domain: 'baidu.com',
          
          ipv4: ['192.168.1.1'],
          ipv6: [],
          ttl: 300,
          timestamp: new Date(),
        };

        (client as any).resolver.getHttpDnsResultForHostSync = jest.fn().mockResolvedValue(mockResult);

        const result = await client.getHttpDnsResultForHostSync('baidu.com');

        expect(result).toEqual(mockResult);
        expect((client as any).resolver.getHttpDnsResultForHostSync).toHaveBeenCalledWith(
          'baidu.com',
          undefined
        );
      });

      test('should handle resolve error', async () => {
        const error = new Error('Network error');
        (client as any).resolver.getHttpDnsResultForHostSync = jest.fn().mockRejectedValue(error);

        await expect(client.getHttpDnsResultForHostSync('baidu.com')).rejects.toThrow('Network error');
      });

      test('should throw error when client is closed', async () => {
        await client.close();

        await expect(client.getHttpDnsResultForHostSync('baidu.com')).rejects.toThrow(HTTPDNSError);
      });
    });

    describe('updateServiceIPs', () => {
      test('should update service IPs successfully', async () => {
        const mockNetworkManager = {
          fetchServiceIPs: jest.fn().mockResolvedValue(undefined),
        };
        (client as any).resolver.getNetworkManager = jest.fn().mockReturnValue(mockNetworkManager);

        await client.updateServiceIPs();

        expect(mockNetworkManager.fetchServiceIPs).toHaveBeenCalled();
      });

      test('should handle update service IPs error', async () => {
        const error = new Error('Network error');
        const mockNetworkManager = {
          fetchServiceIPs: jest.fn().mockRejectedValue(error),
        };
        (client as any).resolver.getNetworkManager = jest.fn().mockReturnValue(mockNetworkManager);

        await expect(client.updateServiceIPs()).rejects.toThrow('Network error');
      });

      test('should throw error when client is closed', async () => {
        await client.close();

        await expect(client.updateServiceIPs()).rejects.toThrow(HTTPDNSError);
      });
    });

    describe('getServiceIPs', () => {
      test('should return service IPs', () => {
        const mockServiceIPs = ['192.168.1.1', '192.168.1.2'];
        const mockServiceIPManager = {
          getServiceIPs: jest.fn().mockReturnValue(mockServiceIPs),
        };
        const mockNetworkManager = {
          getServiceIPManager: jest.fn().mockReturnValue(mockServiceIPManager),
        };
        (client as any).resolver.getNetworkManager = jest.fn().mockReturnValue(mockNetworkManager);

        const serviceIPs = client.getServiceIPs();

        expect(serviceIPs).toEqual(mockServiceIPs);
      });

      test('should return empty array when client is closed', async () => {
        await client.close();

        const serviceIPs = client.getServiceIPs();

        expect(serviceIPs).toEqual([]);
      });
    });

    describe('isHealthy', () => {
      test('should return true when client is healthy', () => {
        const mockServiceIPManager = {
          getServiceIPs: jest.fn().mockReturnValue(['192.168.1.1']),
        };
        const mockNetworkManager = {
          getServiceIPManager: jest.fn().mockReturnValue(mockServiceIPManager),
        };
        (client as any).resolver.getNetworkManager = jest.fn().mockReturnValue(mockNetworkManager);

        const isHealthy = client.isHealthy();

        expect(isHealthy).toBe(true);
      });

      test('should return false when client is closed', async () => {
        await client.close();

        const isHealthy = client.isHealthy();

        expect(isHealthy).toBe(false);
      });

      test('should return false when no service IPs available', () => {
        const mockServiceIPManager = {
          getServiceIPs: jest.fn().mockReturnValue([]),
        };
        const mockNetworkManager = {
          getServiceIPManager: jest.fn().mockReturnValue(mockServiceIPManager),
        };
        (client as any).resolver.getNetworkManager = jest.fn().mockReturnValue(mockNetworkManager);

        const isHealthy = client.isHealthy();

        expect(isHealthy).toBe(false);
      });
    });



    describe('close', () => {
      test('should close client gracefully', async () => {
        const mockResolver = {
          close: jest.fn(),
        };
        (client as any).resolver = mockResolver;

        await client.close();

        expect(mockResolver.close).toHaveBeenCalled();
      });

      test('should handle multiple close calls', async () => {
        await client.close();
        await client.close(); // Should not throw

        expect(client.isHealthy()).toBe(false);
      });
    });

    describe('setPreResolveHosts', () => {
      test('should call resolver setPreResolveHosts', () => {
        const mockResolver = {
          setPreResolveHosts: jest.fn(),
          getHttpDnsResultForHostSync: jest.fn(),
          getHttpDnsResultForHostSyncNonBlocking: jest.fn(),
          updateServiceIPs: jest.fn().mockResolvedValue(undefined),
          getNetworkManager: jest.fn(),
          close: jest.fn(),
        };
        (client as any).resolver = mockResolver;

        const domains = ['example.com', 'test.com'];
        client.setPreResolveHosts(domains);

        expect(mockResolver.setPreResolveHosts).toHaveBeenCalledWith(domains);
      });

      test('should log error when client is closed', async () => {
        // 创建一个新的 client 用于这个测试
        const mockLogger = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        
        const testClient = new HTTPDNSClientImpl({
          ...config,
          logger: mockLogger,
        });

        await testClient.close();

        testClient.setPreResolveHosts(['example.com']);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cannot pre-resolve: client has been stopped'
        );
      });

      test('should not call resolver when client is closed', async () => {
        const mockResolver = {
          setPreResolveHosts: jest.fn(),
          getHttpDnsResultForHostSync: jest.fn(),
          getHttpDnsResultForHostSyncNonBlocking: jest.fn(),
          updateServiceIPs: jest.fn().mockResolvedValue(undefined),
          getNetworkManager: jest.fn(),
          close: jest.fn(),
        };
        (client as any).resolver = mockResolver;

        await client.close();

        client.setPreResolveHosts(['example.com']);

        expect(mockResolver.setPreResolveHosts).not.toHaveBeenCalled();
      });
    });
  });


});