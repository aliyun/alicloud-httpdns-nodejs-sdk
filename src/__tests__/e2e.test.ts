/**
 * 端到端测试套件
 * 测试完整的DNS解析流程和各种场景
 */

import { createClient, HTTPDNSClient } from '../index';

// Mock axios for controlled testing
jest.mock('axios');

describe('端到端测试', () => {
  let client: HTTPDNSClient;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (client) {
      client.close();
      client = null as any;
    }
  });

  describe('基础解析功能', () => {
    it('应该能够解析常见域名', async () => {
      const mockServiceIPResponse = {
        service_ip: ['203.107.1.100', '203.107.1.101'],
      };

      const mockDNSResponse = {
        code: 'success',
        data: {
          answers: [{
            dn: 'baidu.com',
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
        .mockResolvedValueOnce({ data: mockDNSResponse }); // Second call for DNS resolution

      mockAxios.create.mockReturnValue({
        get: mockGet,
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      });

      // Create client after mock setup
      client = createClient({
        accountId: 'test-account',
        secretKey: 'test-secret',
        bootstrapIPs: ['203.107.1.1'],
        timeout: 10000,
        maxRetries: 2,
      });

      const result = await client.getHttpDnsResultForHostSync('baidu.com');


      expect(result).toBeDefined();
      expect(result.domain).toBe('baidu.com');
      expect(result.success).toBe(true);
      expect(result.ipv4).toEqual(['1.2.3.4', '5.6.7.8']);
      expect(result.ipv6).toEqual([]);
      expect(result.ttl).toBe(300);
      expect(result.timestamp).toBeInstanceOf(Date);


    });
  });
});
