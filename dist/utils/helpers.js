"use strict";
/**
 * 工具函数模块
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTimestamp = exports.parseQueryType = exports.isValidDomain = exports.buildQueryParams = void 0;
const types_1 = require("../types");
/**
 * 构建查询参数字符串（兼容Node.js 12+）
 */
function buildQueryParams(params) {
    const paramPairs = [];
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            paramPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    }
    return paramPairs.join('&');
}
exports.buildQueryParams = buildQueryParams;
/**
 * 验证域名格式
 */
function isValidDomain(domain) {
    if (!domain || typeof domain !== 'string') {
        return false;
    }
    // 基本的域名格式检查
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain) && domain.length <= 253;
}
exports.isValidDomain = isValidDomain;
/**
 * 解析查询类型
 */
function parseQueryType(queryType) {
    if (!queryType) {
        return types_1.QueryType.Both;
    }
    switch (queryType) {
        case types_1.QueryType.IPv4:
        case types_1.QueryType.IPv6:
        case types_1.QueryType.Both:
            return queryType;
        default:
            return types_1.QueryType.Both;
    }
}
exports.parseQueryType = parseQueryType;
const config_1 = require("../config");
/**
 * 生成时间戳字符串（当前时间 + 固定5分钟有效期）
 */
function generateTimestamp() {
    const currentTime = Math.floor(Date.now() / 1000);
    const expireTime = Math.floor(config_1.SIGNATURE_EXPIRE_TIME / 1000); // 使用配置的过期时间
    return (currentTime + expireTime).toString();
}
exports.generateTimestamp = generateTimestamp;
//# sourceMappingURL=helpers.js.map