/**
 * 网络管理模块
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { AuthManager } from './auth';
import { ServiceIPManager } from './utils/ip-pool';
import { buildQueryParams, generateTimestamp, isValidDomain } from './utils/helpers';
import { HTTPDNSResponse, ServiceIPResponse, QueryType, Logger } from './types';
import {
  HTTPDNSError,
  createNetworkError,
  createParseError,
  createAuthFailedError,
} from './errors';

import { DEFAULT_BOOTSTRAP_DOMAIN, MergedConfig } from './config';

/**
 * 网络管理器
 */
export class NetworkManager {
  private readonly httpClient: AxiosInstance;
  private readonly config: MergedConfig;
  private readonly authManager?: AuthManager;
  private readonly serviceIPManager: ServiceIPManager;
  private readonly logger?: Logger | undefined;
  constructor(config: MergedConfig) {
    this.config = config;
    this.serviceIPManager = new ServiceIPManager();
    this.logger = config.logger;

    if (config.secretKey) {
      this.authManager = new AuthManager(config.secretKey);
    }

    // 创建HTTP客户端
    this.httpClient = axios.create({
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
    this.httpClient.interceptors.request.use(
      requestConfig => {
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
      },
      error => {
        if (this.logger) {
          this.logger.error('HTTP Request Error:', error.message);
        }
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    this.httpClient.interceptors.response.use(
      response => {
        if (this.logger) {
          this.logger.debug('HTTP Response:', {
            status: response.status,
            statusText: response.statusText,
            // 在debug级别记录响应数据，但避免记录敏感信息
            dataSize: JSON.stringify(response.data || {}).length,
          });
        }
        return response;
      },
      error => {
        if (this.logger) {
          this.logger.error('HTTP Response Error:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            // 不记录完整的响应数据，避免泄露敏感信息
          });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * 获取服务IP列表
   */
  async fetchServiceIPs(): Promise<void> {
    const protocol = this.config.enableHTTPS ? 'https' : 'http';
    const bootstrapIPs = this.config.bootstrapIPs;

    // 遍历所有启动IP
    for (const bootstrapIP of bootstrapIPs) {
      try {
        const url = `${protocol}://${bootstrapIP}/${this.config.accountId}/ss?region=global`;

        if (this.logger) {
          this.logger.debug(`Fetching service IPs from: ${url}`);
        }

        const response: AxiosResponse<ServiceIPResponse> = await this.httpClient.get(url);

        if (response.data && response.data.service_ip && response.data.service_ip.length > 0) {
          this.serviceIPManager.updateServiceIPs(response.data.service_ip);

          if (this.logger) {
            this.logger.info(`Successfully fetched ${response.data.service_ip.length} service IPs`);
          }

          return;
        }
      } catch (error) {
        if (this.logger) {
          this.logger.warn(`Failed to fetch service IPs from ${bootstrapIP}:`, error);
        }
        // 继续尝试下一个启动IP
        continue;
      }
    }

    // 如果所有启动IP都失败，尝试使用启动域名
    try {
      const url = `${protocol}://${DEFAULT_BOOTSTRAP_DOMAIN}/${this.config.accountId}/ss?region=global`;

      if (this.logger) {
        this.logger.debug(`Fetching service IPs from bootstrap domain: ${url}`);
      }

      const response: AxiosResponse<ServiceIPResponse> = await this.httpClient.get(url);

      if (response.data && response.data.service_ip && response.data.service_ip.length > 0) {
        this.serviceIPManager.updateServiceIPs(response.data.service_ip);

        if (this.logger) {
          this.logger.info(
            `Successfully fetched ${response.data.service_ip.length} service IPs from bootstrap domain`
          );
        }

        return;
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error('Failed to fetch service IPs from bootstrap domain:', error);
      }
    }

    throw createNetworkError('', new Error('Service unavailable'));
  }

  /**
   * 单域名解析
   */
  async resolveSingle(
    domain: string,
    queryType: QueryType = QueryType.Both,
    timeout?: number
  ): Promise<HTTPDNSResponse> {
    // 验证域名格式
    if (!isValidDomain(domain)) {
      throw createNetworkError(domain, new Error('Invalid domain format'));
    }

    return this.executeWithRetry(async (currentServiceIP: string) => {
      const url = this.buildSingleResolveURL(currentServiceIP, domain, queryType);

      if (this.logger) {
        this.logger.debug(`Resolving single domain: ${domain} using IP: ${currentServiceIP}`);
      }

      const requestConfig: any = {};
      if (timeout !== undefined) {
        requestConfig.timeout = timeout;
      }

      const response: AxiosResponse<HTTPDNSResponse> = await this.httpClient.get(
        url,
        requestConfig
      );

      // 验证响应数据
      if (!response.data || typeof response.data !== 'object') {
        throw createParseError(domain, new Error('Invalid response format'));
      }

      // 标记IP成功
      this.serviceIPManager.markIPSuccess(currentServiceIP);

      return response.data;
    }, domain);
  }

  /**
   * 带重试的请求执行
   */
  private async executeWithRetry<T>(
    operation: (serviceIP: string) => Promise<T>,
    domain: string
  ): Promise<T> {
    const maxAttempts = this.config.maxRetries + 1; // 至少执行一次请求
    let lastError: Error;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const serviceIP = await this.getAvailableServiceIP();
        const result = await operation(serviceIP);
        return result;
      } catch (error) {
        lastError = error as Error;

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
              this.logger.warn(
                `Marked service IP ${currentServiceIP} as failed, attempt ${
                  attempt + 1
                }/${maxAttempts}`
              );
            }
          }
        }

        // 如果还有重试机会，继续重试
        if (attempt < maxAttempts - 1) {
          if (this.logger) {
            this.logger.debug(
              `Retrying request for ${domain}, attempt ${attempt + 2}/${maxAttempts}`
            );
          }
          continue;
        }
      }
    }

    // 所有重试都失败了
    throw this.enhanceError(lastError!, domain);
  }

  /**
   * 判断错误是否应该重试
   */
  private shouldRetry(error: Error): boolean {
    // 认证失败不重试
    const statusCode = (error as any).response?.status;
    if (statusCode === 401 || statusCode === 403) {
      return false;
    }

    // 配置错误不重试
    if (error instanceof HTTPDNSError && error.operation === 'CONFIG_ERROR') {
      return false;
    }

    // 认证错误不重试
    if (error instanceof HTTPDNSError && error.operation === 'AUTH_ERROR') {
      return false;
    }

    // 其他错误都可以重试
    return true;
  }

  /**
   * 获取可用的服务IP
   */
  private async getAvailableServiceIP(): Promise<string> {
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
          return bootstrapIPs[0]!;
        }

        throw createNetworkError('', new Error('No service IPs available'));
      }
    }

    return serviceIP;
  }

  /**
   * 构建单域名解析URL
   */
  private buildSingleResolveURL(
    serviceIP: string,
    domain: string,
    queryType: QueryType = QueryType.Both
  ): string {
    const protocol = this.config.enableHTTPS ? 'https' : 'http';
    const baseURL = `${protocol}://${serviceIP}/${this.config.accountId}`;

    if (this.authManager) {
      // 鉴权解析
      const timestamp = generateTimestamp();
      const signature = this.authManager.generateSignature(domain, timestamp);

      const params: Record<string, string> = {
        host: domain,
        query: queryType,
        t: timestamp,
        s: signature,
      };

      return `${baseURL}/sign_d?${buildQueryParams(params)}`;
    } else {
      // 非鉴权解析
      const params: Record<string, string> = {
        host: domain,
        query: queryType,
      };

      return `${baseURL}/d?${buildQueryParams(params)}`;
    }
  }

  /**
   * 获取服务IP管理器
   */
  getServiceIPManager(): ServiceIPManager {
    return this.serviceIPManager;
  }

  /**
   * 判断是否为网络错误
   */
  private isNetworkError(error: Error): boolean {
    const networkErrorCodes = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ECONNABORTED',
    ];

    const errorCode = (error as any).code;
    if (errorCode && networkErrorCodes.includes(errorCode)) {
      return true;
    }

    // 检查HTTP状态码
    const statusCode = (error as any).response?.status;
    if (statusCode && (statusCode >= 500 || statusCode === 429 || statusCode === 408)) {
      return true;
    }

    return false;
  }

  /**
   * 增强错误信息
   */
  private enhanceError(error: Error, domain: string): Error {
    if (error instanceof HTTPDNSError) {
      return error;
    }

    // 检查HTTP状态码
    const statusCode = (error as any).response?.status;
    if (statusCode === 401 || statusCode === 403) {
      return createAuthFailedError(domain);
    }

    // 其他错误统一处理为网络错误
    return createNetworkError(domain, error);
  }

  /**
   * 屏蔽URL中的敏感信息
   */
  private sanitizeUrl(url: string): string {
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
    } catch (error) {
      // 如果URL解析失败，返回屏蔽后的字符串
      return url
        .replace(/([?&])s=[^&]*/g, '$1s=[MASKED]')
        .replace(/([?&])t=[^&]*/g, '$1t=[MASKED]');
    }
  }

  /**
   * 关闭网络管理器
   */
  close(): void {
    // 清理定时器和连接
    if (this.logger) {
      this.logger.debug('Closing network manager');
    }
  }
}
