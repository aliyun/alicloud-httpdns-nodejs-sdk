/**
 * 解析器模块 - 整合解析逻辑
 */
import { NetworkManager } from './network';
import { CacheManager } from './cache';
import { ResolveResult, ResolveOptions } from './types';
import { MergedConfig } from './config';
/**
 * 解析器类 - 整合单域名和批量解析逻辑
 */
export declare class Resolver {
    private readonly networkManager;
    private readonly config;
    private readonly cacheManager;
    constructor(config: MergedConfig);
    /**
     * 同步解析域名（阻塞等待结果）
     */
    getHttpDnsResultForHostSync(domain: string, options?: ResolveOptions): Promise<ResolveResult>;
    /**
     * 同步非阻塞解析域名（立即返回缓存结果或null）
     */
    getHttpDnsResultForHostSyncNonBlocking(domain: string, options?: ResolveOptions): ResolveResult | null;
    /**
     * 私有异步解析方法（用于更新缓存）
     */
    private _resolveAsync;
    /**
     * 获取网络管理器（用于客户端管理）
     */
    getNetworkManager(): NetworkManager;
    /**
     * 获取服务IP列表
     */
    updateServiceIPs(): Promise<void>;
    /**
     * 获取当前服务IP列表
     */
    getServiceIPs(): string[];
    /**
     * 检查解析器健康状态
     */
    isHealthy(): boolean;
    /**
     * 获取缓存管理器
     */
    getCacheManager(): CacheManager;
    /**
     * 关闭解析器
     */
    close(): void;
    /**
     * 验证单域名解析参数
     */
    private validateSingleResolveParams;
    /**
     * 合并解析选项
     */
    private mergeResolveOptions;
    /**
     * 转换单个响应为解析结果
     */
    private convertToResolveResult;
}
//# sourceMappingURL=resolver.d.ts.map