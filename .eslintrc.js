module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  plugins: ['prettier'],
  extends: [
    'prettier'
  ],
  rules: {
    'prettier/prettier': 'error'
  },
  env: {
    node: true,
    es6: true
  },
  ignorePatterns: [
    'dist/**/*',
    'node_modules/**/*',
    'examples/**/*',
    'ali-oss-httpdns-test/**/*',
    '**/*.test.ts',
    '**/*.spec.ts',
    '*.js'
  ]
};