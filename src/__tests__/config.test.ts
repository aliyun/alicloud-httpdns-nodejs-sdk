/**
 * 配置管理测试
 */

import {
  getDefaultConfig,
  validateConfig,
  mergeConfig,
  DEFAULT_BOOTSTRAP_IPS,
  DEFAULT_HTTPS_SNI,
} from '../config';
import { HTTPDNSConfig } from '../types';
import { HTTPDNSError } from '../errors';

describe('Config', () => {
  describe('getDefaultConfig', () => {
    test('should return correct default config', () => {
      const defaultConfig = getDefaultConfig();

      expect(defaultConfig.bootstrapIPs).toEqual(DEFAULT_BOOTSTRAP_IPS);
      expect(defaultConfig.timeout).toBe(5000);
      expect(defaultConfig.maxRetries).toBe(0);
      expect(defaultConfig.enableHTTPS).toBe(false);

      expect(defaultConfig.httpsSNIHost).toBe(DEFAULT_HTTPS_SNI);
    });
  });

  describe('validateConfig', () => {
    test('should pass validation with valid config', () => {
      const config: HTTPDNSConfig = {
        accountId: 'test-account-id',
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    test('should throw error when accountId is missing', () => {
      const config = {} as HTTPDNSConfig;

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow('accountId must be a non-empty string');
    });

    test('should throw error when accountId is empty string', () => {
      const config: HTTPDNSConfig = {
        accountId: '',
      };

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow('accountId must be a non-empty string');
    });

    test('should throw error when secretKey is empty string', () => {
      const config: HTTPDNSConfig = {
        accountId: 'test-account-id',
        secretKey: '',
      };

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow(
        'secretKey must be a non-empty string when provided'
      );
    });

    test('should throw error when timeout is invalid', () => {
      const config: HTTPDNSConfig = {
        accountId: 'test-account-id',
        timeout: -1,
      };

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow('timeout must be a positive number');
    });

    test('should throw error when maxRetries is invalid', () => {
      const config: HTTPDNSConfig = {
        accountId: 'test-account-id',
        maxRetries: -1,
      };

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow('maxRetries must be a non-negative number');
    });

    test('should throw error when bootstrapIPs is empty array', () => {
      const config: HTTPDNSConfig = {
        accountId: 'test-account-id',
        bootstrapIPs: [],
      };

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow('bootstrapIPs must be a non-empty array');
    });

    test('should throw error when bootstrapIPs contains empty string', () => {
      const config: HTTPDNSConfig = {
        accountId: 'test-account-id',
        bootstrapIPs: ['203.107.1.1', ''],
      };

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow('all bootstrapIPs must be non-empty strings');
    });



    test('should throw error when httpsSNIHost is empty string', () => {
      const config: HTTPDNSConfig = {
        accountId: 'test-account-id',
        httpsSNIHost: '',
      };

      expect(() => validateConfig(config)).toThrow(HTTPDNSError);
      expect(() => validateConfig(config)).toThrow(
        'httpsSNIHost must be a non-empty string when provided'
      );
    });
  });

  describe('mergeConfig', () => {
    test('should merge user config with defaults', () => {
      const userConfig: HTTPDNSConfig = {
        accountId: 'test-account-id',
        secretKey: 'test-secret-key',
        timeout: 10000,
      };

      const mergedConfig = mergeConfig(userConfig);

      expect(mergedConfig.accountId).toBe('test-account-id');
      expect(mergedConfig.secretKey).toBe('test-secret-key');
      expect(mergedConfig.timeout).toBe(10000);
      expect(mergedConfig.bootstrapIPs).toEqual(DEFAULT_BOOTSTRAP_IPS);
      expect(mergedConfig.maxRetries).toBe(0);
      expect(mergedConfig.enableHTTPS).toBe(false);
      expect(mergedConfig.httpsSNIHost).toBe(DEFAULT_HTTPS_SNI);
      expect(mergedConfig.logger).toBeUndefined();
    });

    test('should use user config values when provided', () => {
      const userConfig: HTTPDNSConfig = {
        accountId: 'test-account-id',
        bootstrapIPs: ['192.168.1.1'],
        timeout: 8000,
        maxRetries: 3,
        enableHTTPS: true,
        httpsSNIHost: 'custom-sni.example.com',
      };

      const mergedConfig = mergeConfig(userConfig);

      expect(mergedConfig.bootstrapIPs).toEqual(['192.168.1.1']);
      expect(mergedConfig.timeout).toBe(8000);
      expect(mergedConfig.maxRetries).toBe(3);
      expect(mergedConfig.enableHTTPS).toBe(true);
      expect(mergedConfig.httpsSNIHost).toBe('custom-sni.example.com');
    });

    test('should handle undefined logger', () => {
      const userConfig: HTTPDNSConfig = {
        accountId: 'test-account-id',
      };

      const mergedConfig = mergeConfig(userConfig);

      expect(mergedConfig.logger).toBeUndefined();
    });
  });
});