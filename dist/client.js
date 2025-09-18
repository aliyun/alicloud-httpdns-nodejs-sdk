"use strict";
/**
 * 主客户端实现
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClient = exports.createHTTPDNSClient = exports.HTTPDNSClientImpl = void 0;
const resolver_1 = require("./resolver");
const errors_1 = require("./errors");
const config_1 = require("./config");
const errors_2 = require("./errors");
/**
 * HTTPDNS客户端实现
 */
class HTTPDNSClientImpl {
    constructor(config) {
        this.closed = false;
        // 验证和合并配置
        (0, config_1.validateConfig)(config);
        this.config = (0, config_1.mergeConfig)(config);
        // 创建解析器
        this.resolver = new resolver_1.Resolver(this.config);
        // 启动定时更新
        this.startPeriodicUpdate();
        if (this.config.logger) {
            this.config.logger.info('HTTPDNS client initialized', {
                accountId: this.config.accountId,
                enableHTTPS: this.config.enableHTTPS,
                timeout: this.config.timeout,
            });
        }
    }
    /**
     * 同步解析域名（阻塞等待结果）
     */
    async getHttpDnsResultForHostSync(domain, options) {
        if (this.closed) {
            throw new errors_1.HTTPDNSError(errors_1.ErrorTypes.CONFIG_ERROR, domain, new Error('Client has been stopped'));
        }
        return await this.resolver.getHttpDnsResultForHostSync(domain, options);
    }
    /**
     * 同步非阻塞解析域名（立即返回缓存结果或null）
     */
    getHttpDnsResultForHostSyncNonBlocking(domain, options) {
        if (this.closed) {
            return null;
        }
        return this.resolver.getHttpDnsResultForHostSyncNonBlocking(domain, options);
    }
    /**
     * 关闭客户端
     */
    async close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        // 停止定时更新
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = undefined;
        }
        // 关闭解析器
        this.resolver.close();
        if (this.config.logger) {
            this.config.logger.info('HTTPDNS client closed');
        }
    }
    /**
     * 手动更新服务IP
     */
    async updateServiceIPs() {
        if (this.closed) {
            throw new errors_1.HTTPDNSError(errors_1.ErrorTypes.CONFIG_ERROR, '', new Error('Client has been stopped'));
        }
        try {
            await this.resolver.getNetworkManager().fetchServiceIPs();
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * 获取当前服务IP列表
     */
    getServiceIPs() {
        if (this.closed) {
            return [];
        }
        return this.resolver.getNetworkManager().getServiceIPManager().getServiceIPs();
    }
    /**
     * 检查客户端健康状态
     */
    isHealthy() {
        if (this.closed) {
            return false;
        }
        // 检查是否有可用的服务IP
        const serviceIPs = this.getServiceIPs();
        if (serviceIPs.length === 0) {
            return false;
        }
        return true;
    }
    /**
     * 启动定时更新服务IP
     */
    startPeriodicUpdate() {
        // 每8小时更新一次服务IP
        this.updateTimer = setInterval(async () => {
            if (!this.closed) {
                try {
                    await this.updateServiceIPs();
                }
                catch (error) {
                    // 忽略定时更新错误
                }
            }
        }, 8 * 60 * 60 * 1000);
        // 确保定时器不会阻止进程退出
        if (this.updateTimer.unref) {
            this.updateTimer.unref();
        }
    }
}
exports.HTTPDNSClientImpl = HTTPDNSClientImpl;
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
function createHTTPDNSClient(accountId, secretKey, options) {
    const config = {
        accountId,
        ...options,
    };
    if (secretKey !== undefined) {
        config.secretKey = secretKey;
    }
    return createClient(config);
}
exports.createHTTPDNSClient = createHTTPDNSClient;
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
function createClient(config) {
    // 验证必需的配置参数
    if (!config) {
        throw (0, errors_2.createConfigError)('Configuration is required');
    }
    if (!config.accountId) {
        throw (0, errors_2.createConfigError)('accountId is required');
    }
    if (typeof config.accountId !== 'string' || config.accountId.trim() === '') {
        throw (0, errors_2.createConfigError)('accountId must be a non-empty string');
    }
    // 验证可选参数
    if (config.secretKey !== undefined) {
        if (typeof config.secretKey !== 'string' || config.secretKey.trim() === '') {
            throw (0, errors_2.createConfigError)('secretKey must be a non-empty string when provided');
        }
    }
    if (config.timeout !== undefined) {
        if (typeof config.timeout !== 'number' || config.timeout <= 0) {
            throw (0, errors_2.createConfigError)('timeout must be a positive number');
        }
    }
    if (config.maxRetries !== undefined) {
        if (typeof config.maxRetries !== 'number' || config.maxRetries < 0) {
            throw (0, errors_2.createConfigError)('maxRetries must be a non-negative number');
        }
    }
    if (config.bootstrapIPs !== undefined) {
        if (!Array.isArray(config.bootstrapIPs)) {
            throw (0, errors_2.createConfigError)('bootstrapIPs must be an array');
        }
        if (config.bootstrapIPs.length === 0) {
            throw (0, errors_2.createConfigError)('bootstrapIPs cannot be empty when provided');
        }
        for (const ip of config.bootstrapIPs) {
            if (typeof ip !== 'string' || ip.trim() === '') {
                throw (0, errors_2.createConfigError)('All bootstrap IPs must be non-empty strings');
            }
        }
    }
    if (config.httpsSNIHost !== undefined) {
        if (typeof config.httpsSNIHost !== 'string' || config.httpsSNIHost.trim() === '') {
            throw (0, errors_2.createConfigError)('httpsSNIHost must be a non-empty string when provided');
        }
    }
    // 创建客户端实例
    try {
        return new HTTPDNSClientImpl(config);
    }
    catch (error) {
        // 包装内部错误为配置错误
        if (error instanceof Error) {
            throw (0, errors_2.createConfigError)(`Failed to create client: ${error.message}`);
        }
        throw (0, errors_2.createConfigError)('Failed to create client: Unknown error');
    }
}
exports.createClient = createClient;
//# sourceMappingURL=client.js.map