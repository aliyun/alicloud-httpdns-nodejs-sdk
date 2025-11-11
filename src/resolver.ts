/**
 * 解析器模块 - 整合解析逻辑
 */

import { NetworkManager } from './network';
import { CacheManager, CacheEntry } from './cache';
import { parseQueryType, isValidDomain } from './utils/helpers';
import { ResolveResult, ResolveOptions, HTTPDNSResponse, QueryType } from './types';
import { MergedConfig } from './config';

/**
 * 解析器类 - 整合单域名和批量解析逻辑
 */
export class Resolver {
  private readonly networkManager: NetworkManager;
  private readonly config: MergedConfig;
  private readonly cacheManager: CacheManager;
  private readonly MAX_PRERESOLVE_HOSTS = 100;

  constructor(config: MergedConfig) {
    this.config = config;
    this.networkManager = new NetworkManager(config);
    this.cacheManager = new CacheManager();
  }

  /**
   * 同步解析域名（阻塞等待结果）
   */
  async getHttpDnsResultForHostSync(
    domain: string,
    options?: ResolveOptions
  ): Promise<ResolveResult> {
    // 验证输入参数
    this.validateSingleResolveParams(domain);

    const resolveOptions = this.mergeResolveOptions(options);

    // 检查缓存
    if (this.config.enableCache) {
      // 获取缓存（根据enableExpiredIP决定是否接受过期缓存）
      const cacheEntry = this.cacheManager.get(
        domain,
        resolveOptions.queryType,
        this.config.enableExpiredIP
      );

      if (cacheEntry) {
        // 检查缓存是否过期，如果过期则触发后台更新
        if (cacheEntry.isExpired(resolveOptions.queryType)) {
          // 使用过期缓存，触发后台更新
          if (this.config.logger) {
            this.config.logger.debug(`Using expired cache for domain: ${domain}`);
          }

          // 智能判断需要更新哪些类型
          const expiredTypes = cacheEntry.getExpiredTypes();
          this._resolveAsync(domain, { queryType: expiredTypes }).catch(error => {
            if (this.config.logger) {
              this.config.logger.warn(`Background update failed for ${domain}:`, error);
            }
          });
        }

        return cacheEntry.toResolveResult(resolveOptions.queryType);
      }
    }

    const startTime = Date.now();

    try {
      if (this.config.logger) {
        this.config.logger.debug(`Resolving single domain: ${domain}`, {
          queryType: resolveOptions.queryType,
        });
      }

      const response = await this.networkManager.resolve(
        domain,
        resolveOptions.queryType,
        resolveOptions.timeout
      );

      const results = this.convertToResolveResults(response);
      const result = results[0]; // 单域名解析，取第一个结果

      // 存入缓存
      if (this.config.enableCache) {
        if (result.ipv4Ttl > 0 || result.ipv6Ttl > 0) {
          this.cacheManager.set(domain, resolveOptions.queryType, result);
        }
      }

      if (this.config.logger) {
        const latency = Date.now() - startTime;
        this.config.logger.info(`Successfully resolved ${domain} in ${latency}ms`, {
          ipv4Count: result.ipv4.length,
          ipv6Count: result.ipv6.length,
          ipv4Ttl: result.ipv4Ttl,
          ipv6Ttl: result.ipv6Ttl,
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
        ipv4Ttl: 0,
        ipv4Timestamp: new Date(),
        ipv6: [],
        ipv6Ttl: 0,
        ipv6Timestamp: new Date(),
      };
    }
  }

  /**
   * 同步非阻塞解析域名（立即返回缓存结果或null）
   */
  getHttpDnsResultForHostSyncNonBlocking(
    domain: string,
    options?: ResolveOptions
  ): ResolveResult | null {
    // 验证输入参数
    this.validateSingleResolveParams(domain);

    const resolveOptions = this.mergeResolveOptions(options);

    // 检查缓存
    if (this.config.enableCache) {
      // 获取缓存（根据enableExpiredIP决定是否接受过期缓存）
      const cacheEntry = this.cacheManager.get(
        domain,
        resolveOptions.queryType,
        this.config.enableExpiredIP
      );

      if (cacheEntry) {
        // 检查缓存是否过期，如果过期则触发后台更新
        if (cacheEntry.isExpired(resolveOptions.queryType)) {
          // 使用过期缓存，触发后台更新
          if (this.config.logger) {
            this.config.logger.debug(`Using expired cache for domain: ${domain}`);
          }

          // 智能判断需要更新哪些类型
          const expiredTypes = cacheEntry.getExpiredTypes();
          this._resolveAsync(domain, { queryType: expiredTypes }).catch(error => {
            if (this.config.logger) {
              this.config.logger.warn(`Background update failed for ${domain}:`, error);
            }
          });
        }

        return cacheEntry.toResolveResult(resolveOptions.queryType);
      }
    }

    // 缓存未命中，异步发起解析
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

      const response = await this.networkManager.resolve(
        domain,
        resolveOptions.queryType,
        resolveOptions.timeout
      );

      // 转换响应为结果数组（支持单个和批量）
      const results = this.convertToResolveResults(response);

      // 缓存所有结果
      let cachedCount = 0;
      for (const result of results) {
        if (this.config.enableCache) {
          if (result.ipv4Ttl > 0 || result.ipv6Ttl > 0) {
            this.cacheManager.set(result.domain, resolveOptions.queryType, result);
            cachedCount++;
          }
        }
      }

      if (this.config.logger) {
        this.config.logger.debug(`Async resolve completed and cached ${cachedCount} domain(s)`);
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
   * 预解析域名列表
   * @param domains 域名列表（最多100个）
   */
  setPreResolveHosts(domains: string[]): void {
    if (!domains || domains.length === 0) {
      return;
    }

    // 检查数量限制
    if (domains.length > this.MAX_PRERESOLVE_HOSTS) {
      if (this.config.logger) {
        this.config.logger.warn(
          `Pre-resolve: domain count ${domains.length} exceeds limit ${this.MAX_PRERESOLVE_HOSTS}`
        );
      }
      return;
    }

    // 智能过滤
    const validDomains = this.filterDomainsForPreResolve(domains);
    if (validDomains.length === 0) {
      return;
    }

    // 分批处理：每批5个域名
    const BATCH_SIZE = 5;
    const batches: string[][] = [];
    for (let i = 0; i < validDomains.length; i += BATCH_SIZE) {
      batches.push(validDomains.slice(i, i + BATCH_SIZE));
    }

    if (this.config.logger) {
      this.config.logger.info(
        `Pre-resolve: ${validDomains.length} domains split into ${batches.length} batches`
      );
    }

    // 异步执行每一批（不等待）
    Promise.allSettled(
      batches.map(batch => {
        const domainString = batch.join(',');
        return this._resolveAsync(domainString, { queryType: QueryType.Both });
      })
    ).then(results => {
      if (this.config.logger) {
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.length - successCount;
        this.config.logger.info(
          `Pre-resolve completed: ${successCount}/${batches.length} batches succeeded, ${failedCount} failed`
        );
      }
    });
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
   * 过滤预解析域名
   */
  private filterDomainsForPreResolve(domains: string[]): string[] {
    const valid: string[] = [];
    const queryType = QueryType.Both;

    for (const domain of domains) {
      // 过滤无效域名
      if (!isValidDomain(domain)) {
        continue;
      }

      // 过滤IP地址
      if (this.isIPAddress(domain)) {
        continue;
      }

      // 过滤已有有效缓存（未过期）
      const cacheEntry = this.cacheManager.get(domain, queryType, false);
      if (cacheEntry && !cacheEntry.isExpired(queryType)) {
        continue;
      }

      valid.push(domain);
    }

    return valid;
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
   * 判断是否为IP地址
   */
  private isIPAddress(domain: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Regex.test(domain) || ipv6Regex.test(domain);
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
   * 转换响应为解析结果数组（支持单个和批量）
   */
  private convertToResolveResults(response: HTTPDNSResponse): ResolveResult[] {
    // 验证响应格式
    if (
      !response ||
      !response.data ||
      !response.data.answers ||
      response.data.answers.length === 0
    ) {
      throw new Error('Invalid response format: missing answers');
    }

    // 转换所有 answers
    const results: ResolveResult[] = [];
    for (const answer of response.data.answers) {
      // 打印 no_ip_code 日志
      if (answer.v4?.no_ip_code && this.config.logger) {
        this.config.logger.warn(`IPv4 no_ip_code for ${answer.dn}: ${answer.v4.no_ip_code}`);
      }
      if (answer.v6?.no_ip_code && this.config.logger) {
        this.config.logger.warn(`IPv6 no_ip_code for ${answer.dn}: ${answer.v6.no_ip_code}`);
      }

      results.push({
        domain: answer.dn,
        ipv4: answer.v4?.ips || [],
        ipv4Ttl: answer.v4?.ttl || 0,
        ipv4Timestamp: new Date(),
        ipv6: answer.v6?.ips || [],
        ipv6Ttl: answer.v6?.ttl || 0,
        ipv6Timestamp: new Date(),
      });
    }

    return results;
  }
}
