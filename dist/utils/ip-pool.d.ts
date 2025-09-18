/**
 * IP池管理模块
 */
/**
 * 服务IP管理器
 */
export declare class ServiceIPManager {
    private serviceIPs;
    private currentIP;
    private failedIPs;
    constructor();
    /**
     * 更新服务IP列表
     */
    updateServiceIPs(ips: string[]): void;
    /**
     * 获取可用的服务IP
     */
    getAvailableServiceIP(): string | null;
    /**
     * 标记IP失败
     */
    markIPFailed(ip: string): void;
    /**
     * 标记IP成功
     */
    markIPSuccess(ip: string): void;
    /**
     * 检查IP是否可用
     */
    private isIPAvailable;
    /**
     * 获取所有服务IP
     */
    getServiceIPs(): string[];
    /**
     * 获取当前IP
     */
    getCurrentIP(): string | undefined;
    /**
     * 获取失败的IP列表
     */
    getFailedIPs(): string[];
    /**
     * 清理过期的失败记录
     */
    cleanupExpiredFailures(): void;
}
//# sourceMappingURL=ip-pool.d.ts.map