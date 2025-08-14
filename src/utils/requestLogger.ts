import fs from "node:fs";
import path from "node:path";
import { HOME_DIR } from "../constants";

const REQUEST_LOG_FILE = path.join(HOME_DIR, "requests.jsonl");

// 确保日志目录存在
if (!fs.existsSync(HOME_DIR)) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
}

export interface RequestLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  // 原始请求（客户端发送的）
  originalRequest: {
    headers: Record<string, any>;
    body: any;
  };
  // 路由阶段
  routing: {
    tokenCount: number;
    selectedModel: string;
    routingReason: string;
  };
  // 转换后的请求（发送给provider的）
  transformedRequest?: {
    url: string;
    method: string;
    headers: Record<string, any>;
    body: any;
    provider: string;
  };
  // Provider原始响应
  providerResponse?: {
    status: number;
    headers: Record<string, any>;
    body: any;
    duration: number;
  };
  // 最终响应（转换后返回给客户端的）
  response?: {
    status: number;
    headers: Record<string, any>;
    body: any;
    duration: number;
  };
  // 错误信息
  error?: {
    message: string;
    stack?: string;
  };
}

class RequestLogger {
  private logs: Map<string, RequestLogEntry> = new Map();
  private maxLogs = 1000; // 最多保存1000条日志

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  logRequest(id: string, req: any): void {
    // 检查是否启用请求日志记录
    if (process.env.REQUEST_LOG === "false") {
      return;
    }

    const entry: RequestLogEntry = {
      id,
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      originalRequest: {
        headers: this.sanitizeHeaders(req.headers),
        body: this.sanitizeBody(req.body),
      },
      routing: {
        tokenCount: 0,
        selectedModel: '',
        routingReason: '',
      },
    };

    this.logs.set(id, entry);
    this.cleanup();
  }

  logRouting(id: string, tokenCount: number, selectedModel: string, reason: string): void {
    if (process.env.REQUEST_LOG === "false") {
      return;
    }

    const entry = this.logs.get(id);
    if (entry) {
      entry.routing = {
        tokenCount,
        selectedModel,
        routingReason: reason,
      };
    }
  }

  logTransformedRequest(id: string, url: string, method: string, headers: any, body: any, provider: string): void {
    if (process.env.REQUEST_LOG === "false") {
      return;
    }

    const entry = this.logs.get(id);
    if (entry) {
      entry.transformedRequest = {
        url,
        method,
        headers: this.sanitizeHeaders(headers),
        body: this.sanitizeBody(body),
        provider,
      };
    }
  }

  logProviderResponse(id: string, status: number, headers: any, body: any, startTime: number): void {
    if (process.env.REQUEST_LOG === "false") {
      return;
    }

    const entry = this.logs.get(id);
    if (entry) {
      entry.providerResponse = {
        status,
        headers: this.sanitizeHeaders(headers),
        body: this.sanitizeBody(body),
        duration: Date.now() - startTime,
      };
    }
  }

  logResponse(id: string, status: number, headers: any, body: any, startTime: number): void {
    const entry = this.logs.get(id);
    if (entry) {
      entry.response = {
        status,
        headers: this.sanitizeHeaders(headers),
        body: this.sanitizeBody(body),
        duration: Date.now() - startTime,
      };
      
      // 写入文件
      this.writeToFile(entry);
    }
  }

  logError(id: string, error: Error): void {
    const entry = this.logs.get(id);
    if (entry) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
      
      // 写入文件
      this.writeToFile(entry);
    }
  }

  private sanitizeHeaders(headers: any): Record<string, any> {
    const sanitized = { ...headers };
    // 移除敏感信息
    if (sanitized.authorization) {
      sanitized.authorization = '[REDACTED]';
    }
    if (sanitized['x-api-key']) {
      sanitized['x-api-key'] = '[REDACTED]';
    }
    return sanitized;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    // 对于大型响应，只保留前1000个字符
    if (typeof body === 'string' && body.length > 1000) {
      return body.substring(0, 1000) + '... [TRUNCATED]';
    }
    
    if (typeof body === 'object') {
      try {
        const str = JSON.stringify(body);
        if (str.length > 1000) {
          return JSON.stringify(body, null, 2).substring(0, 1000) + '... [TRUNCATED]';
        }
      } catch (e) {
        return '[UNPARSEABLE OBJECT]';
      }
    }
    
    return body;
  }

  private writeToFile(entry: RequestLogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(REQUEST_LOG_FILE, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write request log:', error);
    }
  }

  private cleanup(): void {
    if (this.logs.size > this.maxLogs) {
      const entries = Array.from(this.logs.entries());
      entries.sort((a, b) => a[1].timestamp.localeCompare(b[1].timestamp));
      
      // 删除最旧的条目
      const toDelete = entries.slice(0, entries.length - this.maxLogs);
      toDelete.forEach(([id]) => this.logs.delete(id));
    }
  }

  getRecentLogs(limit: number = 100): RequestLogEntry[] {
    const entries = Array.from(this.logs.values());
    return entries
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  getLogById(id: string): RequestLogEntry | undefined {
    return this.logs.get(id);
  }
}

export const requestLogger = new RequestLogger();
