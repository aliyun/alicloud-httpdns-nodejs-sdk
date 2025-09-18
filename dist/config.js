"use strict";
/**
 * 配置管理模块
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeConfig = exports.validateConfig = exports.getDefaultConfig = exports.SIGNATURE_EXPIRE_TIME = exports.DEFAULT_HTTPS_SNI = exports.DEFAULT_BOOTSTRAP_DOMAIN = exports.DEFAULT_BOOTSTRAP_IPS = void 0;
const errors_1 = require("./errors");
/**
 * 默认EMAS HTTPDNS启动IP（中国内地）
 */
exports.DEFAULT_BOOTSTRAP_IPS = [
    '203.107.1.1',
    '203.107.1.97',
    '203.107.1.100',
    '203.119.238.240',
    '106.11.25.239',
    '59.82.99.47',
];
/**
 * 默认启动域名（兜底）
 */
exports.DEFAULT_BOOTSTRAP_DOMAIN = 'resolvers-cn.httpdns.aliyuncs.com';
/**
 * 默认HTTPS SNI域名（根据官方文档，HTTPS证书校验Host需要指定为resolvers.httpdns.aliyuncs.com）
 */
exports.DEFAULT_HTTPS_SNI = 'resolvers.httpdns.aliyuncs.com';
/**
 * 签名过期时间（固定5分钟）
 */
exports.SIGNATURE_EXPIRE_TIME = 300000;
/**
 * 获取默认配置
 */
function getDefaultConfig() {
    return {
        bootstrapIPs: exports.DEFAULT_BOOTSTRAP_IPS,
        timeout: 5000,
        maxRetries: 0,
        enableHTTPS: false,
        httpsSNIHost: exports.DEFAULT_HTTPS_SNI,
        enableCache: true, // 默认启用缓存
    };
}
exports.getDefaultConfig = getDefaultConfig;
/**
 * 验证配置
 */
function validateConfig(config) {
    if (!config.accountId || typeof config.accountId !== 'string' || config.accountId.trim() === '') {
        throw (0, errors_1.createConfigError)('accountId must be a non-empty string');
    }
    if (config.secretKey !== undefined) {
        if (typeof config.secretKey !== 'string' || config.secretKey.trim() === '') {
            throw (0, errors_1.createConfigError)('secretKey must be a non-empty string when provided');
        }
    }
    if (config.timeout !== undefined) {
        if (typeof config.timeout !== 'number' || config.timeout <= 0) {
            throw (0, errors_1.createConfigError)('timeout must be a positive number');
        }
    }
    if (config.maxRetries !== undefined) {
        if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
            throw (0, errors_1.createConfigError)('maxRetries must be a non-negative number');
        }
    }
    if (config.bootstrapIPs !== undefined) {
        if (!Array.isArray(config.bootstrapIPs) || config.bootstrapIPs.length === 0) {
            throw (0, errors_1.createConfigError)('bootstrapIPs must be a non-empty array');
        }
        for (const ip of config.bootstrapIPs) {
            if (typeof ip !== 'string' || ip.trim() === '') {
                throw (0, errors_1.createConfigError)('all bootstrapIPs must be non-empty strings');
            }
        }
    }
    if (config.httpsSNIHost !== undefined) {
        if (typeof config.httpsSNIHost !== 'string' || config.httpsSNIHost.trim() === '') {
            throw (0, errors_1.createConfigError)('httpsSNIHost must be a non-empty string when provided');
        }
    }
}
exports.validateConfig = validateConfig;
/**
 * 合并配置
 */
function mergeConfig(userConfig) {
    const defaultConfig = getDefaultConfig();
    const result = {
        accountId: userConfig.accountId,
        bootstrapIPs: userConfig.bootstrapIPs || defaultConfig.bootstrapIPs,
        timeout: userConfig.timeout !== undefined ? userConfig.timeout : defaultConfig.timeout,
        maxRetries: userConfig.maxRetries !== undefined ? userConfig.maxRetries : defaultConfig.maxRetries,
        enableHTTPS: userConfig.enableHTTPS !== undefined ? userConfig.enableHTTPS : defaultConfig.enableHTTPS,
        httpsSNIHost: userConfig.httpsSNIHost || defaultConfig.httpsSNIHost,
        enableCache: userConfig.enableCache !== undefined ? userConfig.enableCache : defaultConfig.enableCache,
    };
    if (userConfig.secretKey !== undefined) {
        result.secretKey = userConfig.secretKey;
    }
    if (userConfig.logger !== undefined) {
        result.logger = userConfig.logger;
    }
    return result;
}
exports.mergeConfig = mergeConfig;
//# sourceMappingURL=config.js.map