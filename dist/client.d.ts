/**
 * 主客户端实现
 */
import { HTTPDNSClient, HTTPDNSConfig, ResolveResult, ResolveOptions } from './types';
/**
 * HTTPDNS客户端实现
 */
export declare class HTTPDNSClientImpl implements HTTPDNSClient {
    private readonly resolver;
    private readonly config;
    private updateTimer?;
    private closed;
    constructor(config: HTTPDNSConfig);
    /**
     * 同步解析域名（阻塞等待结果）
     */
    getHttpDnsResultForHostSync(domain: string, options?: ResolveOptions): Promise<ResolveResult>;
    /**
     * 同步非阻塞解析域名（立即返回缓存结果或null）
     */
    getHttpDnsResultForHostSyncNonBlocking(domain: string, options?: ResolveOptions): ResolveResult | null;
    /**
     * 关闭客户端
     */
    close(): Promise<void>;
    /**
     * 手动更新服务IP
     */
    updateServiceIPs(): Promise<void>;
    /**
     * 获取当前服务IP列表
     */
    getServiceIPs(): string[];
    /**
     * 检查客户端健康状态
     */
    isHealthy(): boolean;
    /**
     * 启动定时更新服务IP
     */
    private startPeriodicUpdate;
}
/**
 * 创建HTTPDNS客户端（便捷方法）
 *
 * @param accountId 账户ID（必填）
 * @param secretKey 密钥（可选，用于鉴权解析）
 * @param options 可选配置
 * @returns HTTPDNSClient 客户端实例
 *
 * @example
 * ```typescript
 * // 基础使用
 * const client = createHTTPDNSClient('your-account-id');
 *
 * // 带鉴权
 * const client = createHTTPDNSClient('your-account-id', 'your-secret-key');
 *
 * // 自定义配置
 * const client = createHTTPDNSClient('your-account-id', 'your-secret-key', {
 *   enableHTTPS: true,
 *   maxRetries: 3,
 *   logger: myLogger
 * });
 *
 * const result = await client.resolve('example.com');
 * await client.close();
 * ```
 */
export declare function createHTTPDNSClient(accountId: string, secretKey?: string, options?: Partial<Omit<HTTPDNSConfig, 'accountId' | 'secretKey'>>): HTTPDNSClient;
/**
 * 创建HTTPDNS客户端
 *
 * @param config 客户端配置
 * @returns HTTPDNSClient 客户端实例
 *
 * @example
 * ```typescript
 * // 基础配置
 * const client = createClient({
 *   accountId: 'your-account-id'
 * });
 *
 * // 完整配置
 * const client = createClient({
 *   accountId: 'your-account-id',
 *   secretKey: 'your-secret-key',
 *   enableHTTPS: true,

 *   maxRetries: 3,
 *   timeout: 5000,
 *   logger: console
 * });
 *
 * // 使用客户端
 * const result = await client.resolve('example.com');
 * console.log('IPv4 addresses:', result.ipv4);
 *
 * // 关闭客户端
 * await client.close();
 * ```
 */
export declare function createClient(config: HTTPDNSConfig): HTTPDNSClient;
//# sourceMappingURL=client.d.ts.map