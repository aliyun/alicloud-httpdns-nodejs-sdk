/**
 * 错误处理测试
 */

import {
  HTTPDNSError,
  ErrorTypes,
  createConfigError,
  createNetworkError,
  createAuthFailedError,
  createParseError,
} from '../errors';

describe('HTTPDNSError', () => {
  describe('constructor', () => {
    test('should create error with all parameters', () => {
      const originalError = new Error('Original error message');
      const error = new HTTPDNSError('test_operation', 'example.com', originalError);

      expect(error.name).toBe('HTTPDNSError');
      expect(error.operation).toBe('test_operation');
      expect(error.domain).toBe('example.com');
      expect(error.originalError).toBe(originalError);
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.message).toContain('test_operation');
      expect(error.message).toContain('example.com');
    });

    test('should create error with minimal parameters', () => {
      const error = new HTTPDNSError('test_operation', 'example.com');

      expect(error.name).toBe('HTTPDNSError');
      expect(error.operation).toBe('test_operation');
      expect(error.domain).toBe('example.com');
      expect(error.originalError).toBeUndefined();
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    test('should set correct name', () => {
      const error = new HTTPDNSError('test_operation', 'example.com');
      expect(error.name).toBe('HTTPDNSError');
    });

    test('should set correct timestamp', () => {
      const before = new Date();
      const error = new HTTPDNSError('test_operation', 'example.com');
      const after = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should preserve stack trace', () => {
      const error = new HTTPDNSError('test_operation', 'example.com');
      expect(error.stack).toBeDefined();
    });
  });
});

describe('Error factory functions', () => {
  describe('createConfigError', () => {
    test('should create config error', () => {
      const error = createConfigError('Invalid configuration');

      expect(error).toBeInstanceOf(HTTPDNSError);
      expect(error.operation).toBe(ErrorTypes.CONFIG_ERROR);
      expect(error.domain).toBe('');
      expect(error.originalError?.message).toBe('Invalid configuration');
    });
  });

  describe('createNetworkError', () => {
    test('should create HTTP request error', () => {
      const originalError = new Error('Connection failed');
      const error = createNetworkError('example.com', originalError);

      expect(error).toBeInstanceOf(HTTPDNSError);
      expect(error.operation).toBe(ErrorTypes.NETWORK_ERROR);
      expect(error.domain).toBe('example.com');
      expect(error.originalError).toBe(originalError);
    });

    test('should create timeout error for timeout messages', () => {
      const timeoutError = new Error('timeout of 5000ms exceeded');
      const error = createNetworkError('example.com', timeoutError);

      expect(error.operation).toBe(ErrorTypes.TIMEOUT_ERROR);
    });
  });

  describe('createAuthFailedError', () => {
    test('should create auth failed error', () => {
      const error = createAuthFailedError('example.com');

      expect(error).toBeInstanceOf(HTTPDNSError);
      expect(error.operation).toBe(ErrorTypes.AUTH_ERROR);
      expect(error.domain).toBe('example.com');
      expect(error.originalError?.message).toBe('Authentication failed');
    });
  });

  describe('createParseError', () => {
    test('should create parse error', () => {
      const originalError = new Error('Invalid JSON');
      const error = createParseError('example.com', originalError);

      expect(error).toBeInstanceOf(HTTPDNSError);
      expect(error.operation).toBe(ErrorTypes.PARSE_ERROR);
      expect(error.domain).toBe('example.com');
      expect(error.originalError).toBe(originalError);
    });
  });
});
