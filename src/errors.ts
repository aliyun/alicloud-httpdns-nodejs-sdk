/**
 * HTTPDNS错误处理模块 - 简化版
 */

/**
 * HTTPDNS错误类
 */
export class HTTPDNSError extends Error {
  public readonly operation: string;
  public readonly domain: string;
  public readonly originalError?: Error | undefined;
  public readonly timestamp: Date;

  constructor(operation: string, domain: string, originalError?: Error) {
    const message = `httpdns ${operation} ${domain}: ${originalError?.message || 'unknown error'}`;
    super(message);

    this.name = 'HTTPDNSError';
    this.operation = operation;
    this.domain = domain;
    this.originalError = originalError;
    this.timestamp = new Date();

    // 保持堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HTTPDNSError);
    }
  }
}

/**
 * 简化的错误类型
 */
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
} as const;

/**
 * 创建配置错误
 */
export function createConfigError(message: string): HTTPDNSError {
  return new HTTPDNSError(ErrorTypes.CONFIG_ERROR, '', new Error(message));
}

/**
 * 创建网络错误
 */
export function createNetworkError(domain: string, originalError: Error): HTTPDNSError {
  const isTimeout =
    originalError.message.includes('timeout') ||
    originalError.message.includes('ETIMEDOUT') ||
    (originalError as any).code === 'ECONNABORTED';

  const operation = isTimeout ? ErrorTypes.TIMEOUT_ERROR : ErrorTypes.NETWORK_ERROR;
  return new HTTPDNSError(operation, domain, originalError);
}

/**
 * 创建认证失败错误
 */
export function createAuthFailedError(domain: string): HTTPDNSError {
  return new HTTPDNSError(ErrorTypes.AUTH_ERROR, domain, new Error('Authentication failed'));
}

/**
 * 创建解析错误
 */
export function createParseError(domain: string, originalError: Error): HTTPDNSError {
  return new HTTPDNSError(ErrorTypes.PARSE_ERROR, domain, originalError);
}
