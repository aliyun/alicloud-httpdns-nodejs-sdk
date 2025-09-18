/**
 * HTTPDNS错误处理模块 - 简化版
 */
/**
 * HTTPDNS错误类
 */
export declare class HTTPDNSError extends Error {
    readonly operation: string;
    readonly domain: string;
    readonly originalError?: Error | undefined;
    readonly timestamp: Date;
    constructor(operation: string, domain: string, originalError?: Error);
}
/**
 * 简化的错误类型
 */
export declare const ErrorTypes: {
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly CONFIG_ERROR: "CONFIG_ERROR";
    readonly TIMEOUT_ERROR: "TIMEOUT_ERROR";
    readonly AUTH_ERROR: "AUTH_ERROR";
    readonly PARSE_ERROR: "PARSE_ERROR";
};
/**
 * 创建配置错误
 */
export declare function createConfigError(message: string): HTTPDNSError;
/**
 * 创建网络错误
 */
export declare function createNetworkError(domain: string, originalError: Error): HTTPDNSError;
/**
 * 创建认证失败错误
 */
export declare function createAuthFailedError(domain: string): HTTPDNSError;
/**
 * 创建解析错误
 */
export declare function createParseError(domain: string, originalError: Error): HTTPDNSError;
//# sourceMappingURL=errors.d.ts.map