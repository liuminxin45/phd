import { useState } from 'react';
import { Settings, Bot, Server } from 'lucide-react';
import type { TabId } from '@/lib/settings/types';
import { LlmTab } from '@/components/settings/LlmTab';
import { EnvTab } from '@/components/settings/EnvTab';

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'llm', label: 'AI / LLM', icon: Bot },
  { id: 'env', label: '环境变量', icon: Server },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('llm');

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center">
            <Settings className="h-5 w-5 text-neutral-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">设置</h1>
            <p className="text-sm text-neutral-500">管理 AI 模型配置与环境变量</p>
          </div>
        </div>

        <div className="border-b border-neutral-200">
          <nav className="flex gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    isActive
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {activeTab === 'llm' && <LlmTab />}
        {activeTab === 'env' && <EnvTab />}
      </div>
    </div>
  );
}
