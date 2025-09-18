"use strict";
/**
 * 认证和签名模块
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSignature = exports.AuthManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * 认证管理器
 */
class AuthManager {
    constructor(secretKey) {
        this.secretKey = secretKey;
    }
    /**
     * 生成单域名解析签名
     * 签名算法: MD5(host-secret-timestamp)
     */
    generateSignature(host, timestamp) {
        return generateSignature(this.secretKey, host, timestamp);
    }
}
exports.AuthManager = AuthManager;
/**
 * 生成单域名解析签名
 * 签名算法: MD5(host-secret-timestamp)
 */
function generateSignature(secretKey, host, timestamp) {
    const signString = `${host}-${secretKey}-${timestamp}`;
    return crypto_1.default.createHash('md5').update(signString).digest('hex');
}
exports.generateSignature = generateSignature;
//# sourceMappingURL=auth.js.map