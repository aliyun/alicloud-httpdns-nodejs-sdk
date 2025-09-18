/**
 * 测试配置文件
 * 包含测试用的HTTPDNS账户信息
 */

export const TEST_CONFIG = {
  // 测试用的HTTPDNS账户ID
  accountId: 'your-test-account-id',

  // 测试用的密钥（可选，用于签名测试）
  secretKey: 'your-test-secret-key',

  // 测试用的引导IP列表
  bootstrapIPs: ['203.107.1.1', '203.107.1.33'],

  // 测试超时配置
  timeout: 10000,

  // 测试重试配置
  maxRetries: 2,
};

/**
 * 获取测试配置
 */
export function getTestConfig() {
  return {
    ...TEST_CONFIG,
    // 如果环境变量存在，优先使用环境变量
    accountId: process.env.HTTPDNS_ACCOUNT_ID || TEST_CONFIG.accountId,
    secretKey: process.env.HTTPDNS_SECRET_KEY || TEST_CONFIG.secretKey,
  };
}
