"use strict";
/**
 * 阿里云HTTPDNS Node.js SDK 主入口文件
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHTTPDNSClient = exports.createClient = void 0;
// 导出主要接口和类型
__exportStar(require("./types"), exports);
__exportStar(require("./errors"), exports);
__exportStar(require("./config"), exports);
// 导出客户端创建函数
var client_1 = require("./client");
Object.defineProperty(exports, "createClient", { enumerable: true, get: function () { return client_1.createClient; } });
Object.defineProperty(exports, "createHTTPDNSClient", { enumerable: true, get: function () { return client_1.createHTTPDNSClient; } });
//# sourceMappingURL=index.js.map