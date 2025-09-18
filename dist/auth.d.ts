/**
 * 认证和签名模块
 */
/**
 * 认证管理器
 */
export declare class AuthManager {
    private readonly secretKey;
    constructor(secretKey: string);
    /**
     * 生成单域名解析签名
     * 签名算法: MD5(host-secret-timestamp)
     */
    generateSignature(host: string, timestamp: string): string;
}
/**
 * 生成单域名解析签名
 * 签名算法: MD5(host-secret-timestamp)
 */
export declare function generateSignature(secretKey: string, host: string, timestamp: string): string;
//# sourceMappingURL=auth.d.ts.map