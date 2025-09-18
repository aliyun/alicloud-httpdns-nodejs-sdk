"use strict";
/**
 * IP池管理模块
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceIPManager = void 0;
/**
 * 服务IP管理器
 */
class ServiceIPManager {
    constructor() {
        this.serviceIPs = [];
        this.currentIP = undefined;
        this.failedIPs = new Map();
    }
    /**
     * 更新服务IP列表
     */
    updateServiceIPs(ips) {
        this.serviceIPs = ips;
        // 如果当前IP不在新列表中，重置为第一个IP
        if (this.currentIP && ips.length > 0 && !ips.includes(this.currentIP)) {
            this.currentIP = ips[0];
        }
        else if (ips.length > 0 && !this.currentIP) {
            this.currentIP = ips[0];
        }
        else if (ips.length === 0) {
            this.currentIP = undefined;
        }
    }
    /**
     * 获取可用的服务IP
     */
    getAvailableServiceIP() {
        // 如果服务IP列表为空，返回null
        if (this.serviceIPs.length === 0) {
            return null;
        }
        // 检查当前IP是否在有效列表中且可用
        if (this.currentIP &&
            this.serviceIPs.includes(this.currentIP) &&
            this.isIPAvailable(this.currentIP)) {
            return this.currentIP;
        }
        // 按顺序寻找其他可用IP
        for (const ip of this.serviceIPs) {
            if (this.isIPAvailable(ip)) {
                this.currentIP = ip;
                return ip;
            }
        }
        // 如果所有IP都失败，返回第一个IP（可能已经恢复）
        const firstIP = this.serviceIPs[0];
        this.currentIP = firstIP;
        return firstIP;
    }
    /**
     * 标记IP失败
     */
    markIPFailed(ip) {
        this.failedIPs.set(ip, new Date());
        if (this.currentIP === ip) {
            this.currentIP = undefined;
        }
    }
    /**
     * 标记IP成功
     */
    markIPSuccess(ip) {
        this.failedIPs.delete(ip);
    }
    /**
     * 检查IP是否可用
     */
    isIPAvailable(ip) {
        const failTime = this.failedIPs.get(ip);
        if (!failTime) {
            return true;
        }
        // 5分钟后重试失败的IP
        const now = new Date();
        return now.getTime() - failTime.getTime() > 5 * 60 * 1000;
    }
    /**
     * 获取所有服务IP
     */
    getServiceIPs() {
        return [...this.serviceIPs];
    }
    /**
     * 获取当前IP
     */
    getCurrentIP() {
        return this.currentIP;
    }
    /**
     * 获取失败的IP列表
     */
    getFailedIPs() {
        return Array.from(this.failedIPs.keys());
    }
    /**
     * 清理过期的失败记录
     */
    cleanupExpiredFailures() {
        const now = new Date();
        for (const [ip, failTime] of this.failedIPs.entries()) {
            if (now.getTime() - failTime.getTime() > 5 * 60 * 1000) {
                this.failedIPs.delete(ip);
            }
        }
    }
}
exports.ServiceIPManager = ServiceIPManager;
//# sourceMappingURL=ip-pool.js.map