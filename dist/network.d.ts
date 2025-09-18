/**
 * 网络管理模块
 */
import { ServiceIPManager } from './utils/ip-pool';
import { HTTPDNSResponse, QueryType } from './types';
import { MergedConfig } from './config';
/**
 * 网络管理器
 */
export declare class NetworkManager {
    private readonly httpClient;
    private readonly config;
    private readonly authManager?;
    private readonly serviceIPManager;
    private readonly logger?;
    constructor(config: MergedConfig);
    /**
     * 获取服务IP列表
     */
    fetchServiceIPs(): Promise<void>;
    /**
     * 单域名解析
     */
    resolveSingle(domain: string, queryType?: QueryType, timeout?: number): Promise<HTTPDNSResponse>;
    /**
     * 带重试的请求执行
     */
    private executeWithRetry;
    /**
     * 判断错误是否应该重试
     */
    private shouldRetry;
    /**
     * 获取可用的服务IP
     */
    private getAvailableServiceIP;
    /**
     * 构建单域名解析URL
     */
    private buildSingleResolveURL;
    /**
     * 获取服务IP管理器
     */
    getServiceIPManager(): ServiceIPManager;
    /**
     * 判断是否为网络错误
     */
    private isNetworkError;
    /**
     * 增强错误信息
     */
    private enhanceError;
    /**
     * 屏蔽URL中的敏感信息
     */
    private sanitizeUrl;
    /**
     * 关闭网络管理器
     */
    close(): void;
}
//# sourceMappingURL=network.d.ts.map