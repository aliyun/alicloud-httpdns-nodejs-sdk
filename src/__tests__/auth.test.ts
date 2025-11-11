/**
 * 认证和签名测试
 */

import { AuthManager, generateSignature } from '../auth';

describe('Auth', () => {
  describe('generateSignature', () => {
    test('should generate correct HMAC-SHA256 signature', () => {
      const secretKey = 'test-secret-key';
      const signString = 'dn=example.com&exp=1640995200&id=100000&q=4,6';

      const signature = generateSignature(secretKey, signString);

      // 验证签名格式（64位SHA256哈希）
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
      
      // 验证签名一致性
      const signature2 = generateSignature(secretKey, signString);
      expect(signature).toBe(signature2);
    });

    test('should generate different signatures for different inputs', () => {
      const secretKey = 'test-secret-key';

      const signature1 = generateSignature(secretKey, 'dn=example.com&exp=1640995200&id=100000&q=4,6');
      const signature2 = generateSignature(secretKey, 'dn=google.com&exp=1640995200&id=100000&q=4,6');

      expect(signature1).not.toBe(signature2);
    });
  });



  describe('AuthManager', () => {
    let authManager: AuthManager;

    beforeEach(() => {
      authManager = new AuthManager('test-secret-key');
    });

    test('should generate signature', () => {
      const signString = 'dn=example.com&exp=1640995200&id=100000&q=4,6';
      const signature = authManager.generateSignature(signString);

      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });



    test('should generate consistent signatures', () => {
      const signString = 'dn=example.com&exp=1640995200&id=100000&q=4,6';
      const signature1 = authManager.generateSignature(signString);
      const signature2 = authManager.generateSignature(signString);

      expect(signature1).toBe(signature2);
    });
  });
});