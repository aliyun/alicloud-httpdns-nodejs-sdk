module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/examples/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
  // 处理ES模块问题
  transformIgnorePatterns: [
    'node_modules/(?!(axios)/)'
  ],
  // 模块映射
  moduleNameMapper: {
    '^axios$': 'axios/dist/axios.js'
  },
  // 使用测试专用的TypeScript配置
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
};