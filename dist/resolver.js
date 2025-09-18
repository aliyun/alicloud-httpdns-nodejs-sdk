"use strict";
/**
 * 解析器模块 - 整合解析逻辑
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resolver = void 0;
const network_1 = require("./network");
const cache_1 = require("./cache");
const helpers_1 = require("./utils/helpers");
/**
 * 解析器类 - 整合单域名和批量解析逻辑
 */
class Resolver {
    constructor(config) {
        this.config = config;
        this.networkManager = new network_1.NetworkManager(config);
        this.cacheManager = new cache_1.CacheManager();
    }
    /**
     * 同步解析域名（阻塞等待结果）
     */
    async getHttpDnsResultForHostSync(domain, options) {
        // 验证输入参数
        this.validateSingleResolveParams(domain);
        const resolveOptions = this.mergeResolveOptions(options);
        // 检查缓存
        if (this.config.enableCache) {
            const cacheKey = (0, cache_1.generateCacheKey)(domain, resolveOptions.queryType);
            const cachedResult = this.cacheManager.get(cacheKey);
            if (cachedResult) {
                if (this.config.logger) {
                    this.config.logger.debug(`Cache hit for domain: ${domain}`);
                }
                return cachedResult;
            }
        }
        const startTime = Date.now();
        try {
            if (this.config.logger) {
                this.config.logger.debug(`Resolving single domain: ${domain}`, {
                    queryType: resolveOptions.queryType,
                });
            }
            const response = await this.networkManager.resolveSingle(domain, resolveOptions.queryType, resolveOptions.timeout);
            const result = this.convertToResolveResult(response);
            // 存入缓存
            if (this.config.enableCache && result.ttl > 0) {
                const cacheKey = (0, cache_1.generateCacheKey)(domain, resolveOptions.queryType);
                this.cacheManager.set(cacheKey, result, result.ttl);
            }
            if (this.config.logger) {
                const latency = Date.now() - startTime;
                this.config.logger.info(`Successfully resolved ${domain} in ${latency}ms`, {
                    ipv4Count: result.ipv4.length,
                    ipv6Count: result.ipv6.length,
                    ttl: result.ttl,
                });
            }
            return result;
        }
        catch (error) {
            const latency = Date.now() - startTime;
            if (this.config.logger) {
                this.config.logger.error(`Failed to resolve ${domain} after ${latency}ms:`, error);
            }
            // 创建失败的解析结果
            return {
                domain,
                ipv4: [],
                ipv6: [],
                ttl: 0,
                timestamp: new Date(),
                success: false,
                error: error,
            };
        }
    }
    /**
     * 同步非阻塞解析域名（立即返回缓存结果或null）
     */
    getHttpDnsResultForHostSyncNonBlocking(domain, options) {
        // 验证输入参数
        this.validateSingleResolveParams(domain);
        const resolveOptions = this.mergeResolveOptions(options);
        // 只检查缓存
        if (this.config.enableCache) {
            const cacheKey = (0, cache_1.generateCacheKey)(domain, resolveOptions.queryType);
            const cachedResult = this.cacheManager.get(cacheKey);
            if (cachedResult) {
                if (this.config.logger) {
                    this.config.logger.debug(`Non-blocking cache hit for domain: ${domain}`);
                }
                return cachedResult;
            }
        }
        // 缓存未命中，异步发起解析更新缓存
        this._resolveAsync(domain, options).catch(error => {
            if (this.config.logger) {
                this.config.logger.warn(`Async resolve failed for ${domain}:`, error);
            }
        });
        return null;
    }
    /**
     * 私有异步解析方法（用于更新缓存）
     */
    async _resolveAsync(domain, options) {
        const resolveOptions = this.mergeResolveOptions(options);
        try {
            if (this.config.logger) {
                this.config.logger.debug(`Async resolving domain: ${domain}`);
            }
            const response = await this.networkManager.resolveSingle(domain, resolveOptions.queryType, resolveOptions.timeout);
            const result = this.convertToResolveResult(response);
            // 存入缓存
            if (this.config.enableCache && result.ttl > 0) {
                const cacheKey = (0, cache_1.generateCacheKey)(domain, resolveOptions.queryType);
                this.cacheManager.set(cacheKey, result, result.ttl);
                if (this.config.logger) {
                    this.config.logger.debug(`Async resolve completed and cached for domain: ${domain}`);
                }
            }
        }
        catch (error) {
            if (this.config.logger) {
                this.config.logger.warn(`Async resolve failed for ${domain}:`, error);
            }
        }
    }
    /**
     * 获取网络管理器（用于客户端管理）
     */
    getNetworkManager() {
        return this.networkManager;
    }
    /**
     * 获取服务IP列表
     */
    async updateServiceIPs() {
        await this.networkManager.fetchServiceIPs();
    }
    /**
     * 获取当前服务IP列表
     */
    getServiceIPs() {
        return this.networkManager.getServiceIPManager().getServiceIPs();
    }
    /**
     * 检查解析器健康状态
     */
    isHealthy() {
        const serviceIPs = this.getServiceIPs();
        return serviceIPs.length > 0;
    }
    /**
     * 获取缓存管理器
     */
    getCacheManager() {
        return this.cacheManager;
    }
    /**
     * 关闭解析器
     */
    close() {
        if (this.config.logger) {
            this.config.logger.debug('Closing resolver');
        }
        this.networkManager.close();
        this.cacheManager.clear();
    }
    /**
     * 验证单域名解析参数
     */
    validateSingleResolveParams(domain) {
        if (!domain || typeof domain !== 'string') {
            throw new Error('Domain must be a non-empty string');
        }
        if (!(0, helpers_1.isValidDomain)(domain)) {
            throw new Error('Invalid domain format');
        }
    }
    /**
     * 合并解析选项
     */
    mergeResolveOptions(options) {
        return {
            queryType: (0, helpers_1.parseQueryType)(options === null || options === void 0 ? void 0 : options.queryType),
            timeout: (options === null || options === void 0 ? void 0 : options.timeout) || this.config.timeout,
        };
    }
    /**
     * 转换单个响应为解析结果
     */
    convertToResolveResult(response) {
        // 验证响应格式
        if (!response || !response.host) {
            throw new Error('Invalid response format: missing host');
        }
        // 安全地提取IP地址列表
        const ipv4 = [];
        const ipv6 = [];
        if (response.ips && Array.isArray(response.ips)) {
            for (const ip of response.ips) {
                if (ip && typeof ip === 'string') {
                    ipv4.push(ip);
                }
            }
        }
        if (response.ipsv6 && Array.isArray(response.ipsv6)) {
            for (const ip of response.ipsv6) {
                if (ip && typeof ip === 'string') {
                    ipv6.push(ip);
                }
            }
        }
        return {
            domain: response.host,
            ipv4,
            ipv6,
            ttl: response.ttl || 0,
            timestamp: new Date(),
            success: true,
        };
    }
}
exports.Resolver = Resolver;
//# sourceMappingURL=resolver.js.map