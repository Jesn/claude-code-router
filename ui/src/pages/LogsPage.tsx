import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RequestLogs } from '../components/RequestLogs';
import { Button } from '../components/ui/button';
import { ArrowLeft, Settings, FileJson } from 'lucide-react';

export function LogsPage() {
  const navigate = useNavigate();

  const goBack = () => {
    navigate('/dashboard');
  };

  const openMainApp = () => {
    navigate('/dashboard');
  };

  return (
    <div className="h-screen bg-gray-50 font-sans">
      <header className="flex h-16 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goBack}
            className="transition-all-ease hover:scale-110"
            title="返回配置"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold text-gray-800">请求日志</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={openMainApp}
            className="transition-all-ease hover:scale-[1.02] active:scale-[0.98]"
          >
            <Settings className="mr-2 h-4 w-4" />
            配置管理
          </Button>
        </div>
      </header>
      <main className="h-[calc(100vh-4rem)] p-4">
        <RequestLogs />
      </main>
    </div>
  );
}
