/**
 * 配置管理模块
 */
import { HTTPDNSConfig, Logger } from './types';
/**
 * 默认EMAS HTTPDNS启动IP（中国内地）
 */
export declare const DEFAULT_BOOTSTRAP_IPS: string[];
/**
 * 默认启动域名（兜底）
 */
export declare const DEFAULT_BOOTSTRAP_DOMAIN = "resolvers-cn.httpdns.aliyuncs.com";
/**
 * 默认HTTPS SNI域名（根据官方文档，HTTPS证书校验Host需要指定为resolvers.httpdns.aliyuncs.com）
 */
export declare const DEFAULT_HTTPS_SNI = "resolvers.httpdns.aliyuncs.com";
/**
 * 签名过期时间（固定5分钟）
 */
export declare const SIGNATURE_EXPIRE_TIME = 300000;
/**
 * 获取默认配置
 */
export declare function getDefaultConfig(): Required<Omit<HTTPDNSConfig, 'accountId' | 'secretKey' | 'logger'>>;
/**
 * 验证配置
 */
export declare function validateConfig(config: HTTPDNSConfig): void;
/**
 * 合并配置接口（包含可选字段）
 */
export interface MergedConfig extends Omit<HTTPDNSConfig, 'secretKey' | 'logger'> {
    accountId: string;
    secretKey?: string;
    bootstrapIPs: string[];
    timeout: number;
    maxRetries: number;
    enableHTTPS: boolean;
    httpsSNIHost: string;
    enableCache: boolean;
    logger?: Logger;
}
/**
 * 合并配置
 */
export declare function mergeConfig(userConfig: HTTPDNSConfig): MergedConfig;
//# sourceMappingURL=config.d.ts.map