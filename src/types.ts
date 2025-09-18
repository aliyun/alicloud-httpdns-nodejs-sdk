/**
 * 阿里云HTTPDNS Node.js SDK 核心类型定义
 */

/**
 * HTTPDNS客户端主接口
 */
export interface HTTPDNSClient {
  /**
   * 同步解析域名（阻塞等待结果）
   * @param domain 域名
   * @param options 解析选项（可选）
   * @returns Promise<ResolveResult> 解析结果
   */
  getHttpDnsResultForHostSync(domain: string, options?: ResolveOptions): Promise<ResolveResult>;

  /**
   * 同步非阻塞解析域名（立即返回缓存结果或null）
   * @param domain 域名
   * @param options 解析选项（可选）
   * @returns ResolveResult | null 缓存结果或null
   */
  getHttpDnsResultForHostSyncNonBlocking(domain: string, options?: ResolveOptions): ResolveResult | null;

  /**
   * 关闭客户端
   */
  close(): Promise<void>;

  /**
   * 手动更新服务IP
   */
  updateServiceIPs(): Promise<void>;

  /**
   * 获取当前服务IP列表
   */
  getServiceIPs(): string[];

  /**
   * 检查客户端健康状态
   */
  isHealthy(): boolean;
}

/**
 * 客户端配置接口
 */
export interface HTTPDNSConfig {
  /** 账户ID */
  accountId: string;
  /** 密钥（可选，用于鉴权解析） */
  secretKey?: string;

  /** 启动IP列表 */
  bootstrapIPs?: string[];
  /** 请求超时时间（毫秒） */
  timeout?: number;
  /** 最大重试次数 */
  maxRetries?: number;

  /** 是否启用HTTPS */
  enableHTTPS?: boolean;

  /** HTTPS SNI主机名 */
  httpsSNIHost?: string;

  /** 是否启用缓存 */
  enableCache?: boolean;

  /** 日志记录器 */
  logger?: Logger;
}

/**
 * 解析结果
 */
export interface ResolveResult {
  /** 域名 */
  domain: string;
  /** IPv4地址列表 */
  ipv4: string[];
  /** IPv6地址列表 */
  ipv6: string[];
  /** TTL时间（秒） */
  ttl: number;
  /** 解析时间戳 */
  timestamp: Date;
  /** 解析是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: Error;
}

/**
 * 解析选项
 */
export interface ResolveOptions {
  /** 查询类型 */
  queryType?: QueryType;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 查询类型枚举
 */
export enum QueryType {
  IPv4 = '4',
  IPv6 = '6',
  Both = '4,6',
}

/**
 * HTTPDNS API响应结构
 */
export interface HTTPDNSResponse {
  host: string;
  ips?: string[]; // IPv4地址列表
  ipsv6?: string[]; // IPv6地址列表
  ttl: number;
  origin_ttl?: number; // 原始TTL
  client_ip?: string; // 客户端IP（批量解析时返回）
  type?: number; // 1代表IPv4,28代表IPv6（批量解析时返回）
}

/**
 * 服务IP列表响应
 */
export interface ServiceIPResponse {
  service_ip: string[]; // IPv4服务IP列表
  service_ipv6?: string[]; // IPv6服务IP列表
}

/**
 * 日志接口
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}
