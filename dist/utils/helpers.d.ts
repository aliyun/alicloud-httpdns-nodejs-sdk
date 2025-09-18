/**
 * 工具函数模块
 */
import { QueryType } from '../types';
/**
 * 构建查询参数字符串（兼容Node.js 12+）
 */
export declare function buildQueryParams(params: Record<string, string>): string;
/**
 * 验证域名格式
 */
export declare function isValidDomain(domain: string): boolean;
/**
 * 解析查询类型
 */
export declare function parseQueryType(queryType?: QueryType): QueryType;
/**
 * 生成时间戳字符串（当前时间 + 固定5分钟有效期）
 */
export declare function generateTimestamp(): string;
//# sourceMappingURL=helpers.d.ts.map