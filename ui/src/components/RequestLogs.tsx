import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RefreshCw, Eye, Clock, Zap, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface RequestLogEntry {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  originalRequest: {
    headers: Record<string, any>;
    body: any;
  };
  routing: {
    tokenCount: number;
    selectedModel: string;
    routingReason: string;
  };
  transformedRequest?: {
    url: string;
    method: string;
    headers: Record<string, any>;
    body: any;
    provider: string;
  };
  providerResponse?: {
    status: number;
    headers: Record<string, any>;
    body: any;
    duration: number;
  };
  response?: {
    status: number;
    headers: Record<string, any>;
    body: any;
    duration: number;
  };
  error?: {
    message: string;
    stack?: string;
  };
}

export function RequestLogs() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<RequestLogEntry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ logs: RequestLogEntry[] }>('/logs?limit=50');
      setLogs(response.logs || []);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // 每30秒自动刷新
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'bg-gray-500';
    if (status >= 200 && status < 300) return 'bg-green-500';
    if (status >= 400 && status < 500) return 'bg-yellow-500';
    if (status >= 500) return 'bg-red-500';
    return 'bg-blue-500';
  };

  const openDetail = (log: RequestLogEntry) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  return (
    <>
      <Card className="flex h-full flex-col rounded-lg border shadow-sm">
        <CardHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">请求日志</CardTitle>
            <Button
              onClick={fetchLogs}
              disabled={loading}
              size="sm"
              variant="outline"
              className="transition-all-ease hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto p-0">
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500">
              暂无请求日志
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => openDetail(log)}
                >
                  <div className="flex items-center space-x-3">
                    <Badge className={`${getStatusColor(log.response?.status)} text-white`}>
                      {log.response?.status || 'PENDING'}
                    </Badge>
                    <div>
                      <div className="font-medium text-sm">
                        {log.routing.selectedModel || '未知模型'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {log.routing.routingReason}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Zap className="h-3 w-3" />
                      <span>{log.routing.tokenCount} tokens</span>
                    </div>
                    {log.response && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{log.response.duration}ms</span>
                      </div>
                    )}
                    {log.error && (
                      <div className="flex items-center space-x-1 text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        <span>错误</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                    <Eye className="h-4 w-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 详情对话框 */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>请求详情 - {selectedLog?.id}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">基本信息</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>时间:</strong> {formatTimestamp(selectedLog.timestamp)}</div>
                    <div><strong>方法:</strong> {selectedLog.method}</div>
                    <div><strong>URL:</strong> {selectedLog.url}</div>
                    <div><strong>状态:</strong> 
                      <Badge className={`ml-2 ${getStatusColor(selectedLog.response?.status)} text-white`}>
                        {selectedLog.response?.status || 'PENDING'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">路由信息</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>选择模型:</strong> {selectedLog.routing.selectedModel}</div>
                    <div><strong>路由原因:</strong> {selectedLog.routing.routingReason}</div>
                    <div><strong>Token数量:</strong> {selectedLog.routing.tokenCount}</div>
                    {selectedLog.response && (
                      <div><strong>响应时间:</strong> {selectedLog.response.duration}ms</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 错误信息 */}
              {selectedLog.error && (
                <div>
                  <h4 className="font-medium mb-2 text-red-600">错误信息</h4>
                  <div className="bg-red-50 p-3 rounded border text-sm">
                    <div><strong>消息:</strong> {selectedLog.error.message}</div>
                    {selectedLog.error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">堆栈跟踪</summary>
                        <pre className="mt-2 text-xs overflow-auto">{selectedLog.error.stack}</pre>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* 原始请求体 */}
              <div>
                <h4 className="font-medium mb-2">原始请求体</h4>
                <pre className="bg-gray-50 p-3 rounded border text-xs overflow-y-auto max-h-40 whitespace-pre-wrap break-words">
                  {JSON.stringify(selectedLog.originalRequest.body, null, 2)}
                </pre>
              </div>

              {/* 转换后的请求 */}
              {selectedLog.transformedRequest && (
                <div>
                  <h4 className="font-medium mb-2">转换后的请求 (发送给 {selectedLog.transformedRequest.provider})</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">URL: </span>
                      <span className="text-sm">{selectedLog.transformedRequest.url}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">方法: </span>
                      <span className="text-sm">{selectedLog.transformedRequest.method}</span>
                    </div>
                    <pre className="bg-blue-50 p-3 rounded border text-xs overflow-y-auto max-h-40 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedLog.transformedRequest.body, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Provider 原始响应 */}
              {selectedLog.providerResponse && (
                <div>
                  <h4 className="font-medium mb-2">Provider 原始响应</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600">状态码: </span>
                      <span className={`text-sm px-2 py-1 rounded ${
                        selectedLog.providerResponse.status >= 200 && selectedLog.providerResponse.status < 300
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedLog.providerResponse.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">响应时间: </span>
                      <span className="text-sm">{selectedLog.providerResponse.duration}ms</span>
                    </div>
                    <pre className="bg-yellow-50 p-3 rounded border text-xs overflow-y-auto max-h-40 whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedLog.providerResponse.body, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* 最终响应体 */}
              {selectedLog.response && (
                <div>
                  <h4 className="font-medium mb-2">最终响应体 (返回给客户端)</h4>
                  <pre className="bg-green-50 p-3 rounded border text-xs overflow-y-auto max-h-40 whitespace-pre-wrap break-words">
                    {JSON.stringify(selectedLog.response.body, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
