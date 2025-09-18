/**
 * 解析器模块 - 整合解析逻辑
 */

import { NetworkManager } from './network';
import { CacheManager, generateCacheKey } from './cache';
import { parseQueryType, isValidDomain } from './utils/helpers';
import { ResolveResult, ResolveOptions, HTTPDNSResponse } from './types';
import { MergedConfig } from './config';

/**
 * 解析器类 - 整合单域名和批量解析逻辑
 */
export class Resolver {
  private readonly networkManager: NetworkManager;
  private readonly config: MergedConfig;
  private readonly cacheManager: CacheManager;

  constructor(config: MergedConfig) {
    this.config = config;
    this.networkManager = new NetworkManager(config);
    this.cacheManager = new CacheManager();
  }

  /**
   * 同步解析域名（阻塞等待结果）
   */
  async getHttpDnsResultForHostSync(domain: string, options?: ResolveOptions): Promise<ResolveResult> {
    // 验证输入参数
    this.validateSingleResolveParams(domain);

    const resolveOptions = this.mergeResolveOptions(options);

    // 检查缓存
    if (this.config.enableCache) {
      const cacheKey = generateCacheKey(domain, resolveOptions.queryType);
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

      const response = await this.networkManager.resolveSingle(
        domain,
        resolveOptions.queryType,
        resolveOptions.timeout
      );

      const result = this.convertToResolveResult(response);

      // 存入缓存
      if (this.config.enableCache && result.ttl > 0) {
        const cacheKey = generateCacheKey(domain, resolveOptions.queryType);
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
    } catch (error) {
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
        error: error as Error,
      };
    }
  }

  /**
   * 同步非阻塞解析域名（立即返回缓存结果或null）
   */
  getHttpDnsResultForHostSyncNonBlocking(domain: string, options?: ResolveOptions): ResolveResult | null {
    // 验证输入参数
    this.validateSingleResolveParams(domain);

    const resolveOptions = this.mergeResolveOptions(options);

    // 只检查缓存
    if (this.config.enableCache) {
      const cacheKey = generateCacheKey(domain, resolveOptions.queryType);
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
  private async _resolveAsync(domain: string, options?: ResolveOptions): Promise<void> {
    const resolveOptions = this.mergeResolveOptions(options);

    try {
      if (this.config.logger) {
        this.config.logger.debug(`Async resolving domain: ${domain}`);
      }

      const response = await this.networkManager.resolveSingle(
        domain,
        resolveOptions.queryType,
        resolveOptions.timeout
      );

      const result = this.convertToResolveResult(response);

      // 存入缓存
      if (this.config.enableCache && result.ttl > 0) {
        const cacheKey = generateCacheKey(domain, resolveOptions.queryType);
        this.cacheManager.set(cacheKey, result, result.ttl);

        if (this.config.logger) {
          this.config.logger.debug(`Async resolve completed and cached for domain: ${domain}`);
        }
      }
    } catch (error) {
      if (this.config.logger) {
        this.config.logger.warn(`Async resolve failed for ${domain}:`, error);
      }
    }
  }

  /**
   * 获取网络管理器（用于客户端管理）
   */
  getNetworkManager(): NetworkManager {
    return this.networkManager;
  }

  /**
   * 获取服务IP列表
   */
  async updateServiceIPs(): Promise<void> {
    await this.networkManager.fetchServiceIPs();
  }

  /**
   * 获取当前服务IP列表
   */
  getServiceIPs(): string[] {
    return this.networkManager.getServiceIPManager().getServiceIPs();
  }

  /**
   * 检查解析器健康状态
   */
  isHealthy(): boolean {
    const serviceIPs = this.getServiceIPs();
    return serviceIPs.length > 0;
  }

  /**
   * 获取缓存管理器
   */
  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * 关闭解析器
   */
  close(): void {
    if (this.config.logger) {
      this.config.logger.debug('Closing resolver');
    }
    this.networkManager.close();
    this.cacheManager.clear();
  }

  /**
   * 验证单域名解析参数
   */
  private validateSingleResolveParams(domain: string): void {
    if (!domain || typeof domain !== 'string') {
      throw new Error('Domain must be a non-empty string');
    }

    if (!isValidDomain(domain)) {
      throw new Error('Invalid domain format');
    }
  }

  /**
   * 合并解析选项
   */
  private mergeResolveOptions(options?: ResolveOptions): Required<ResolveOptions> {
    return {
      queryType: parseQueryType(options?.queryType),
      timeout: options?.timeout || this.config.timeout,
    };
  }

  /**
   * 转换单个响应为解析结果
   */
  private convertToResolveResult(response: HTTPDNSResponse): ResolveResult {
    // 验证响应格式
    if (!response || !response.host) {
      throw new Error('Invalid response format: missing host');
    }

    // 安全地提取IP地址列表
    const ipv4: string[] = [];
    const ipv6: string[] = [];

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
