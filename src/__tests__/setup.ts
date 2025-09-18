/**
 * Jest测试环境设置
 */

beforeAll(() => {
  // 设置测试超时时间
  jest.setTimeout(30000);

  // 测试配置现在通过 test-config.ts 文件管理
  // 不再依赖环境变量，但仍支持环境变量覆盖
});

afterAll(() => {
  // 清理全局资源
});

// 添加空的export使其成为模块
export {};
