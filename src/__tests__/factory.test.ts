/**
 * 客户端工厂函数测试
 */

import {
  createClient,
} from '../client';
import { HTTPDNSError } from '../errors';

describe('Client Factory Functions', () => {
  describe('createClient', () => {
    test('should create client with valid config', () => {
      const client = createClient({
        accountId: 'test-account-id',
      });

      expect(client).toBeDefined();
      expect(typeof client.getHttpDnsResultForHostSync).toBe('function');
      expect(typeof client.getHttpDnsResultForHostSyncNonBlocking).toBe('function');
      expect(typeof client.close).toBe('function');
    });

    test('should throw error when config is missing', () => {
      expect(() => createClient(null as any)).toThrow('Configuration is required');
      expect(() => createClient(undefined as any)).toThrow('Configuration is required');
    });

    test('should throw error when accountId is missing', () => {
      expect(() => createClient({} as any)).toThrow('accountId is required');
      expect(() => createClient({ accountId: '' })).toThrow('accountId is required');
      expect(() => createClient({ accountId: '   ' })).toThrow('accountId must be a non-empty string');
      expect(() => createClient({ accountId: 123 as any })).toThrow('accountId must be a non-empty string');
    });

    test('should validate secretKey when provided', () => {
      expect(() => createClient({
        accountId: 'test',
        secretKey: '',
      })).toThrow('secretKey must be a non-empty string when provided');

      expect(() => createClient({
        accountId: 'test',
        secretKey: '   ',
      })).toThrow('secretKey must be a non-empty string when provided');

      expect(() => createClient({
        accountId: 'test',
        secretKey: 123 as any,
      })).toThrow('secretKey must be a non-empty string when provided');
    });

    test('should validate timeout when provided', () => {
      expect(() => createClient({
        accountId: 'test',
        timeout: 0,
      })).toThrow('timeout must be a positive number');

      expect(() => createClient({
        accountId: 'test',
        timeout: -1,
      })).toThrow('timeout must be a positive number');

      expect(() => createClient({
        accountId: 'test',
        timeout: 'invalid' as any,
      })).toThrow('timeout must be a positive number');
    });

    test('should validate maxRetries when provided', () => {
      expect(() => createClient({
        accountId: 'test',
        maxRetries: -1,
      })).toThrow('maxRetries must be a non-negative number');

      expect(() => createClient({
        accountId: 'test',
        maxRetries: 'invalid' as any,
      })).toThrow('maxRetries must be a non-negative number');

      // maxRetries = 0 should be valid
      expect(() => createClient({
        accountId: 'test',
        maxRetries: 0,
      })).not.toThrow();
    });

    test('should validate bootstrapIPs when provided', () => {
      expect(() => createClient({
        accountId: 'test',
        bootstrapIPs: 'invalid' as any,
      })).toThrow('bootstrapIPs must be an array');

      expect(() => createClient({
        accountId: 'test',
        bootstrapIPs: [],
      })).toThrow('bootstrapIPs cannot be empty when provided');

      expect(() => createClient({
        accountId: 'test',
        bootstrapIPs: ['', '1.2.3.4'],
      })).toThrow('All bootstrap IPs must be non-empty strings');

      expect(() => createClient({
        accountId: 'test',
        bootstrapIPs: [123 as any],
      })).toThrow('All bootstrap IPs must be non-empty strings');
    });



    test('should validate httpsSNIHost when provided', () => {
      expect(() => createClient({
        accountId: 'test',
        httpsSNIHost: '',
      })).toThrow('httpsSNIHost must be a non-empty string when provided');

      expect(() => createClient({
        accountId: 'test',
        httpsSNIHost: '   ',
      })).toThrow('httpsSNIHost must be a non-empty string when provided');
    });

    test('should create client with valid optional parameters', () => {
      const client = createClient({
        accountId: 'test-account-id',
        secretKey: 'test-secret-key',
        timeout: 5000,
        maxRetries: 3,
        bootstrapIPs: ['1.2.3.4', '5.6.7.8'],
        enableHTTPS: true,
        httpsSNIHost: 'example.com',
        logger: console,
      });

      expect(client).toBeDefined();
    });
  });





  describe('error handling', () => {
    test('should wrap internal errors as config errors', () => {
      // This test verifies that internal errors are properly wrapped
      // The actual error wrapping is tested implicitly through other tests
      expect(() => createClient({
        accountId: 'test',
        timeout: -1, // This will cause a validation error
      })).toThrow(HTTPDNSError);
    });
  });

  afterEach(() => {
    // Clean up any created clients if needed
    // In a real scenario, you might want to track and close clients
  });
});