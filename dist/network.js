"use strict";
/**
 * 网络管理模块
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkManager = void 0;
const axios_1 = __importDefault(require("axios"));
const auth_1 = require("./auth");
const ip_pool_1 = require("./utils/ip-pool");
const helpers_1 = require("./utils/helpers");
const types_1 = require("./types");
const errors_1 = require("./errors");
const config_1 = require("./config");
/**
 * 网络管理器
 */
class NetworkManager {
    constructor(config) {
        this.config = config;
        this.serviceIPManager = new ip_pool_1.ServiceIPManager();
        this.logger = config.logger;
        if (config.secretKey) {
            this.authManager = new auth_1.AuthManager(config.secretKey);
        }
        // 创建HTTP客户端
        this.httpClient = axios_1.default.create({
            timeout: config.timeout,
            headers: {
                'User-Agent': 'httpdns-nodejs-sdk/1.0.0',
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            // 兼容Node.js 12+的HTTPS配置
            httpsAgent: config.enableHTTPS
                ? new (require('https').Agent)({
                    keepAlive: true,
                    maxSockets: 10,
                    maxFreeSockets: 5,
                    timeout: config.timeout,
                    servername: config.httpsSNIHost,
                })
                : undefined,
            httpAgent: new (require('http').Agent)({
                keepAlive: true,
                maxSockets: 10,
                maxFreeSockets: 5,
                timeout: config.timeout,
            }),
        });
        // 添加请求拦截器
        this.httpClient.interceptors.request.use(requestConfig => {
            if (this.logger) {
                // 屏蔽敏感信息的URL
                const sanitizedUrl = this.sanitizeUrl(requestConfig.url || '');
                this.logger.debug('HTTP Request:', {
                    method: requestConfig.method,
                    url: sanitizedUrl,
                    // 不记录完整headers，避免泄露敏感信息
                });
            }
            return requestConfig;
        }, error => {
            if (this.logger) {
                this.logger.error('HTTP Request Error:', error.message);
            }
            return Promise.reject(error);
        });
        // 添加响应拦截器
        this.httpClient.interceptors.response.use(response => {
            if (this.logger) {
                this.logger.debug('HTTP Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    // 在debug级别记录响应数据，但避免记录敏感信息
                    dataSize: JSON.stringify(response.data || {}).length,
                });
            }
            return response;
        }, error => {
            var _a, _b;
            if (this.logger) {
                this.logger.error('HTTP Response Error:', {
                    message: error.message,
                    status: (_a = error.response) === null || _a === void 0 ? void 0 : _a.status,
                    statusText: (_b = error.response) === null || _b === void 0 ? void 0 : _b.statusText,
                    // 不记录完整的响应数据，避免泄露敏感信息
                });
            }
            return Promise.reject(error);
        });
    }
    /**
     * 获取服务IP列表
     */
    async fetchServiceIPs() {
        const protocol = this.config.enableHTTPS ? 'https' : 'http';
        const bootstrapIPs = this.config.bootstrapIPs;
        // 遍历所有启动IP
        for (const bootstrapIP of bootstrapIPs) {
            try {
                const url = `${protocol}://${bootstrapIP}/${this.config.accountId}/ss?region=global`;
                if (this.logger) {
                    this.logger.debug(`Fetching service IPs from: ${url}`);
                }
                const response = await this.httpClient.get(url);
                if (response.data && response.data.service_ip && response.data.service_ip.length > 0) {
                    this.serviceIPManager.updateServiceIPs(response.data.service_ip);
                    if (this.logger) {
                        this.logger.info(`Successfully fetched ${response.data.service_ip.length} service IPs`);
                    }
                    return;
                }
            }
            catch (error) {
                if (this.logger) {
                    this.logger.warn(`Failed to fetch service IPs from ${bootstrapIP}:`, error);
                }
                // 继续尝试下一个启动IP
                continue;
            }
        }
        // 如果所有启动IP都失败，尝试使用启动域名
        try {
            const url = `${protocol}://${config_1.DEFAULT_BOOTSTRAP_DOMAIN}/${this.config.accountId}/ss?region=global`;
            if (this.logger) {
                this.logger.debug(`Fetching service IPs from bootstrap domain: ${url}`);
            }
            const response = await this.httpClient.get(url);
            if (response.data && response.data.service_ip && response.data.service_ip.length > 0) {
                this.serviceIPManager.updateServiceIPs(response.data.service_ip);
                if (this.logger) {
                    this.logger.info(`Successfully fetched ${response.data.service_ip.length} service IPs from bootstrap domain`);
                }
                return;
            }
        }
        catch (error) {
            if (this.logger) {
                this.logger.error('Failed to fetch service IPs from bootstrap domain:', error);
            }
        }
        throw (0, errors_1.createNetworkError)('', new Error('Service unavailable'));
    }
    /**
     * 单域名解析
     */
    async resolveSingle(domain, queryType = types_1.QueryType.Both, timeout) {
        // 验证域名格式
        if (!(0, helpers_1.isValidDomain)(domain)) {
            throw (0, errors_1.createNetworkError)(domain, new Error('Invalid domain format'));
        }
        return this.executeWithRetry(async (currentServiceIP) => {
            const url = this.buildSingleResolveURL(currentServiceIP, domain, queryType);
            if (this.logger) {
                this.logger.debug(`Resolving single domain: ${domain} using IP: ${currentServiceIP}`);
            }
            const requestConfig = {};
            if (timeout !== undefined) {
                requestConfig.timeout = timeout;
            }
            const response = await this.httpClient.get(url, requestConfig);
            // 验证响应数据
            if (!response.data || typeof response.data !== 'object') {
                throw (0, errors_1.createParseError)(domain, new Error('Invalid response format'));
            }
            // 标记IP成功
            this.serviceIPManager.markIPSuccess(currentServiceIP);
            return response.data;
        }, domain);
    }
    /**
     * 带重试的请求执行
     */
    async executeWithRetry(operation, domain) {
        const maxAttempts = this.config.maxRetries + 1; // 至少执行一次请求
        let lastError;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const serviceIP = await this.getAvailableServiceIP();
                const result = await operation(serviceIP);
                return result;
            }
            catch (error) {
                lastError = error;
                // 检查是否为不可重试的错误
                if (!this.shouldRetry(lastError)) {
                    throw this.enhanceError(lastError, domain);
                }
                // 如果是网络错误，标记当前IP失败
                if (this.isNetworkError(lastError)) {
                    const currentServiceIP = this.serviceIPManager.getCurrentIP();
                    if (currentServiceIP) {
                        this.serviceIPManager.markIPFailed(currentServiceIP);
                        if (this.logger) {
                            this.logger.warn(`Marked service IP ${currentServiceIP} as failed, attempt ${attempt + 1}/${maxAttempts}`);
                        }
                    }
                }
                // 如果还有重试机会，继续重试
                if (attempt < maxAttempts - 1) {
                    if (this.logger) {
                        this.logger.debug(`Retrying request for ${domain}, attempt ${attempt + 2}/${maxAttempts}`);
                    }
                    continue;
                }
            }
        }
        // 所有重试都失败了
        throw this.enhanceError(lastError, domain);
    }
    /**
     * 判断错误是否应该重试
     */
    shouldRetry(error) {
        var _a;
        // 认证失败不重试
        const statusCode = (_a = error.response) === null || _a === void 0 ? void 0 : _a.status;
        if (statusCode === 401 || statusCode === 403) {
            return false;
        }
        // 配置错误不重试
        if (error instanceof errors_1.HTTPDNSError && error.operation === 'CONFIG_ERROR') {
            return false;
        }
        // 认证错误不重试
        if (error instanceof errors_1.HTTPDNSError && error.operation === 'AUTH_ERROR') {
            return false;
        }
        // 其他错误都可以重试
        return true;
    }
    /**
     * 获取可用的服务IP
     */
    async getAvailableServiceIP() {
        let serviceIP = this.serviceIPManager.getAvailableServiceIP();
        if (!serviceIP) {
            // 如果没有可用的服务IP，尝试获取
            await this.fetchServiceIPs();
            serviceIP = this.serviceIPManager.getAvailableServiceIP();
            if (!serviceIP) {
                // 如果服务IP列表为空，使用启动IP作为备用方案
                const bootstrapIPs = this.config.bootstrapIPs;
                if (bootstrapIPs.length > 0) {
                    if (this.logger) {
                        this.logger.warn('No service IPs available, using bootstrap IP as fallback');
                    }
                    return bootstrapIPs[0];
                }
                throw (0, errors_1.createNetworkError)('', new Error('No service IPs available'));
            }
        }
        return serviceIP;
    }
    /**
     * 构建单域名解析URL
     */
    buildSingleResolveURL(serviceIP, domain, queryType = types_1.QueryType.Both) {
        const protocol = this.config.enableHTTPS ? 'https' : 'http';
        const baseURL = `${protocol}://${serviceIP}/${this.config.accountId}`;
        if (this.authManager) {
            // 鉴权解析
            const timestamp = (0, helpers_1.generateTimestamp)();
            const signature = this.authManager.generateSignature(domain, timestamp);
            const params = {
                host: domain,
                query: queryType,
                t: timestamp,
                s: signature,
            };
            return `${baseURL}/sign_d?${(0, helpers_1.buildQueryParams)(params)}`;
        }
        else {
            // 非鉴权解析
            const params = {
                host: domain,
                query: queryType,
            };
            return `${baseURL}/d?${(0, helpers_1.buildQueryParams)(params)}`;
        }
    }
    /**
     * 获取服务IP管理器
     */
    getServiceIPManager() {
        return this.serviceIPManager;
    }
    /**
     * 判断是否为网络错误
     */
    isNetworkError(error) {
        var _a;
        const networkErrorCodes = [
            'ECONNRESET',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN',
            'ECONNABORTED',
        ];
        const errorCode = error.code;
        if (errorCode && networkErrorCodes.includes(errorCode)) {
            return true;
        }
        // 检查HTTP状态码
        const statusCode = (_a = error.response) === null || _a === void 0 ? void 0 : _a.status;
        if (statusCode && (statusCode >= 500 || statusCode === 429 || statusCode === 408)) {
            return true;
        }
        return false;
    }
    /**
     * 增强错误信息
     */
    enhanceError(error, domain) {
        var _a;
        if (error instanceof errors_1.HTTPDNSError) {
            return error;
        }
        // 检查HTTP状态码
        const statusCode = (_a = error.response) === null || _a === void 0 ? void 0 : _a.status;
        if (statusCode === 401 || statusCode === 403) {
            return (0, errors_1.createAuthFailedError)(domain);
        }
        // 其他错误统一处理为网络错误
        return (0, errors_1.createNetworkError)(domain, error);
    }
    /**
     * 屏蔽URL中的敏感信息
     */
    sanitizeUrl(url) {
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            // 屏蔽签名参数
            if (params.has('s')) {
                params.set('s', '[MASKED]');
            }
            // 屏蔽时间戳参数（可能包含敏感信息）
            if (params.has('t')) {
                params.set('t', '[MASKED]');
            }
            urlObj.search = params.toString();
            return urlObj.toString();
        }
        catch (error) {
            // 如果URL解析失败，返回屏蔽后的字符串
            return url
                .replace(/([?&])s=[^&]*/g, '$1s=[MASKED]')
                .replace(/([?&])t=[^&]*/g, '$1t=[MASKED]');
        }
    }
    /**
     * 关闭网络管理器
     */
    close() {
        // 清理定时器和连接
        if (this.logger) {
            this.logger.debug('Closing network manager');
        }
    }
}
exports.NetworkManager = NetworkManager;
//# sourceMappingURL=network.js.map