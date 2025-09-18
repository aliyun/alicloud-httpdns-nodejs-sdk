"use strict";
/**
 * HTTPDNS错误处理模块 - 简化版
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParseError = exports.createAuthFailedError = exports.createNetworkError = exports.createConfigError = exports.ErrorTypes = exports.HTTPDNSError = void 0;
/**
 * HTTPDNS错误类
 */
class HTTPDNSError extends Error {
    constructor(operation, domain, originalError) {
        const message = `httpdns ${operation} ${domain}: ${(originalError === null || originalError === void 0 ? void 0 : originalError.message) || 'unknown error'}`;
        super(message);
        this.name = 'HTTPDNSError';
        this.operation = operation;
        this.domain = domain;
        this.originalError = originalError;
        this.timestamp = new Date();
        // 保持堆栈跟踪
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, HTTPDNSError);
        }
    }
}
exports.HTTPDNSError = HTTPDNSError;
/**
 * 简化的错误类型
 */
exports.ErrorTypes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    CONFIG_ERROR: 'CONFIG_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
};
/**
 * 创建配置错误
 */
function createConfigError(message) {
    return new HTTPDNSError(exports.ErrorTypes.CONFIG_ERROR, '', new Error(message));
}
exports.createConfigError = createConfigError;
/**
 * 创建网络错误
 */
function createNetworkError(domain, originalError) {
    const isTimeout = originalError.message.includes('timeout') ||
        originalError.message.includes('ETIMEDOUT') ||
        originalError.code === 'ECONNABORTED';
    const operation = isTimeout ? exports.ErrorTypes.TIMEOUT_ERROR : exports.ErrorTypes.NETWORK_ERROR;
    return new HTTPDNSError(operation, domain, originalError);
}
exports.createNetworkError = createNetworkError;
/**
 * 创建认证失败错误
 */
function createAuthFailedError(domain) {
    return new HTTPDNSError(exports.ErrorTypes.AUTH_ERROR, domain, new Error('Authentication failed'));
}
exports.createAuthFailedError = createAuthFailedError;
/**
 * 创建解析错误
 */
function createParseError(domain, originalError) {
    return new HTTPDNSError(exports.ErrorTypes.PARSE_ERROR, domain, originalError);
}
exports.createParseError = createParseError;
//# sourceMappingURL=errors.js.map