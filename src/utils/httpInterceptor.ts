import http from 'http';
import https from 'https';
import { URL } from 'url';
import { requestLogger } from './requestLogger';

interface InterceptedRequest {
  requestId?: string;
  startTime: number;
  url: string;
  method: string;
  headers: any;
  body?: any;
  provider?: string;
}

class HTTPInterceptor {
  private originalHttpRequest: typeof http.request;
  private originalHttpsRequest: typeof https.request;
  private activeRequests: Map<any, InterceptedRequest> = new Map();
  private installed = false;

  constructor() {
    this.originalHttpRequest = http.request;
    this.originalHttpsRequest = https.request;
  }

  install(): void {
    if (this.installed) return;
    
    // 拦截 HTTP 请求
    http.request = this.createInterceptor(this.originalHttpRequest, false);
    
    // 拦截 HTTPS 请求
    https.request = this.createInterceptor(this.originalHttpsRequest, true);
    
    this.installed = true;
    console.log('🔍 HTTP拦截器已安装，开始记录请求转换过程');
  }

  uninstall(): void {
    if (!this.installed) return;
    
    http.request = this.originalHttpRequest;
    https.request = this.originalHttpsRequest;
    
    this.installed = false;
    console.log('🔍 HTTP拦截器已卸载');
  }

  private createInterceptor(originalRequest: any, isHttps: boolean) {
    return (options: any, callback?: any) => {
      // 解析请求选项
      const url = this.parseUrl(options, isHttps);
      const method = options.method || 'GET';
      const headers = options.headers || {};

      // 检查是否是发送给 LLM provider 的请求
      if (!this.isProviderRequest(url)) {
        return originalRequest.call(isHttps ? https : http, options, callback);
      }

      // 创建拦截的请求对象
      const interceptedReq: InterceptedRequest = {
        startTime: Date.now(),
        url,
        method,
        headers: { ...headers },
        provider: this.extractProvider(url),
      };

      // 尝试从当前上下文获取请求ID
      const requestId = this.getCurrentRequestId();
      if (requestId) {
        interceptedReq.requestId = requestId;
      }

      // 调用原始请求方法
      const req = originalRequest.call(isHttps ? https : http, options, (res: any) => {
        this.handleResponse(res, interceptedReq);
        if (callback) callback(res);
      });

      // 保存请求信息
      this.activeRequests.set(req, interceptedReq);

      // 拦截请求体
      const originalWrite = req.write;
      const originalEnd = req.end;
      let body = '';

      req.write = function(chunk: any, encoding?: any, callback?: any) {
        if (chunk) {
          body += chunk.toString();
        }
        return originalWrite.call(this, chunk, encoding, callback);
      };

      req.end = (chunk?: any, encoding?: any, callback?: any) => {
        if (chunk) {
          body += chunk.toString();
        }
        
        // 记录转换后的请求
        interceptedReq.body = body;
        if (interceptedReq.requestId) {
          try {
            const parsedBody = body ? JSON.parse(body) : null;
            requestLogger.logTransformedRequest(
              interceptedReq.requestId,
              interceptedReq.url,
              interceptedReq.method,
              interceptedReq.headers,
              parsedBody,
              interceptedReq.provider || 'unknown'
            );
          } catch (error) {
            console.warn('Failed to log transformed request:', error);
          }
        }
        
        return originalEnd.call(req, chunk, encoding, callback);
      };

      return req;
    };
  }

  private handleResponse(res: any, interceptedReq: InterceptedRequest): void {
    let responseBody = '';

    res.on('data', (chunk: any) => {
      responseBody += chunk.toString();
    });

    res.on('end', () => {
      if (interceptedReq.requestId) {
        try {
          const parsedBody = responseBody ? JSON.parse(responseBody) : null;
          requestLogger.logProviderResponse(
            interceptedReq.requestId,
            res.statusCode,
            res.headers,
            parsedBody,
            interceptedReq.startTime
          );
        } catch (error) {
          console.warn('Failed to log provider response:', error);
        }
      }
    });
  }

  private parseUrl(options: any, isHttps: boolean): string {
    if (typeof options === 'string') {
      return options;
    }
    
    const protocol = isHttps ? 'https:' : 'http:';
    const hostname = options.hostname || options.host || 'localhost';
    const port = options.port ? `:${options.port}` : '';
    const path = options.path || '/';
    
    return `${protocol}//${hostname}${port}${path}`;
  }

  private isProviderRequest(url: string): boolean {
    // 检查是否是发送给 LLM provider 的请求
    const providerDomains = [
      'api.openai.com',
      'openrouter.ai',
      'api.deepseek.com',
      'generativelanguage.googleapis.com',
      'api.anthropic.com',
      'httpbin.org', // 测试用
    ];

    try {
      const urlObj = new URL(url);
      return providerDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  private extractProvider(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      if (hostname.includes('openrouter.ai')) return 'openrouter';
      if (hostname.includes('api.deepseek.com')) return 'deepseek';
      if (hostname.includes('api.openai.com')) return 'openai';
      if (hostname.includes('generativelanguage.googleapis.com')) return 'gemini';
      if (hostname.includes('api.anthropic.com')) return 'anthropic';
      if (hostname.includes('httpbin.org')) return 'test';
      
      return hostname;
    } catch {
      return 'unknown';
    }
  }

  private getCurrentRequestId(): string | undefined {
    // 尝试从异步上下文获取当前请求ID
    // 这里我们使用一个简单的方法：从全局变量获取
    return (global as any).currentRequestId;
  }

  // 设置当前请求ID的方法
  static setCurrentRequestId(id: string): void {
    (global as any).currentRequestId = id;
  }

  static clearCurrentRequestId(): void {
    delete (global as any).currentRequestId;
  }
}

export const httpInterceptor = new HTTPInterceptor();
