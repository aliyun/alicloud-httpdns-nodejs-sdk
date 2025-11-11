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
  private fetchServiceIPsPromise?: Promise<void>;

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
          this.logger.debug('HTTP Request:', {
            method: requestConfig.method,
            url: requestConfig.url,
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
    // 如果已有正在进行的请求，直接返回
    if (this.fetchServiceIPsPromise) {
      return this.fetchServiceIPsPromise;
    }

    // 创建新的请求Promise
    this.fetchServiceIPsPromise = (async () => {
      const protocol = 'https';
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
              this.logger.info(
                `Successfully fetched ${response.data.service_ip.length} service IPs`
              );
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
    })().finally(() => {
      this.fetchServiceIPsPromise = undefined;
    });

    return this.fetchServiceIPsPromise;
  }

  /**
   * 域名解析（支持单个域名或多个域名用逗号分隔）
   */
  async resolve(
    domain: string,
    queryType: QueryType = QueryType.Both,
    timeout?: number
  ): Promise<HTTPDNSResponse> {
    // 验证域名格式（支持单个域名或逗号分隔的多个域名）
    const domains = domain.split(',');
    for (const d of domains) {
      const trimmedDomain = d.trim();
      if (!isValidDomain(trimmedDomain)) {
        throw createNetworkError(domain, new Error('Invalid domain format'));
      }
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

      // 检查响应码
      if (response.data.code !== 'success') {
        throw createNetworkError(domain, new Error(`Resolve failed: ${response.data.code}`));
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
      // 触发后台获取服务IP
      this.fetchServiceIPs().catch(error => {
        if (this.logger) {
          this.logger.warn('Failed to fetch service IPs in background:', error);
        }
      });

      // 直接使用 bootstrapIP
      const bootstrapIPs = this.config.bootstrapIPs;
      if (bootstrapIPs.length > 0) {
        if (this.logger) {
          this.logger.debug('Service IPs not ready, using bootstrap IP as fallback');
        }
        return bootstrapIPs[0]!;
      }

      throw createNetworkError('', new Error('No bootstrap IPs available'));
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
    const baseURL = `${protocol}://${serviceIP}/v2/d`;

    const params: Record<string, string> = {
      id: this.config.accountId,
      dn: domain,
      q: queryType,
      m: '0', // 加密模式：0=明文, 1=AES-CBC-128, 2=AES-GCM-128
    };

    if (this.authManager) {
      // 鉴权解析
      const exp = Math.floor(Date.now() / 1000) + 300;
      params.exp = exp.toString();

      // 构建签名串（按 ASCII 升序排序）
      const sortedKeys = Object.keys(params).sort();
      const signString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

      const signature = this.authManager.generateSignature(signString);
      params.s = signature;
    }

    return `${baseURL}?${buildQueryParams(params)}`;
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
   * 关闭网络管理器
   */
  close(): void {
    // 清理定时器和连接
    if (this.logger) {
      this.logger.debug('Closing network manager');
    }
  }
}
