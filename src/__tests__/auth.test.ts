/**
 * 认证和签名测试
 */

import { AuthManager, generateSignature } from '../auth';

describe('Auth', () => {
  describe('generateSignature', () => {
    test('should generate correct MD5 signature for single domain', () => {
      const secretKey = 'test-secret-key';
      const host = 'example.com';
      const timestamp = '1640995200';

      const signature = generateSignature(secretKey, host, timestamp);

      // 验证签名格式（32位MD5哈希）
      expect(signature).toMatch(/^[a-f0-9]{32}$/);
      
      // 验证签名一致性
      const signature2 = generateSignature(secretKey, host, timestamp);
      expect(signature).toBe(signature2);
    });

    test('should generate different signatures for different inputs', () => {
      const secretKey = 'test-secret-key';
      const timestamp = '1640995200';

      const signature1 = generateSignature(secretKey, 'example.com', timestamp);
      const signature2 = generateSignature(secretKey, 'google.com', timestamp);

      expect(signature1).not.toBe(signature2);
    });
  });



  describe('AuthManager', () => {
    let authManager: AuthManager;

    beforeEach(() => {
      authManager = new AuthManager('test-secret-key');
    });

    test('should generate signature for single domain', () => {
      const signature = authManager.generateSignature('example.com', '1640995200');

      expect(signature).toMatch(/^[a-f0-9]{32}$/);
    });



    test('should generate consistent signatures', () => {
      const signature1 = authManager.generateSignature('example.com', '1640995200');
      const signature2 = authManager.generateSignature('example.com', '1640995200');

      expect(signature1).toBe(signature2);
    });
  });
});