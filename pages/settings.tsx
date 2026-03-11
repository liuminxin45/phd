import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Settings, Bot, Server, Route } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TabId } from '@/lib/settings/types';
import { LlmTab } from '@/components/settings/LlmTab';
import { EnvTab } from '@/components/settings/EnvTab';
import { RoadmapTab } from '@/components/settings/RoadmapTab';
import { GlassPage, GlassPanel, GlassToolbar, glassPanelStrongClass } from '@/components/ui/glass';

const TABS: { id: TabId; label: string; icon: typeof Bot }[] = [
  { id: 'llm', label: 'AI / LLM', icon: Bot },
  { id: 'env', label: 'Environment', icon: Server },
  { id: 'roadmap', label: 'Roadmap', icon: Route },
];

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('llm');

  useEffect(() => {
    if (!router.isReady) return;
    const rawTab = Array.isArray(router.query.tab) ? router.query.tab[0] : router.query.tab;
    if (rawTab === 'llm' || rawTab === 'env' || rawTab === 'roadmap') {
      setActiveTab(rawTab);
    }
  }, [router.isReady, router.query.tab]);

  return (
    <GlassPage showOrbs={false} className="h-full">
      <div className="h-full overflow-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <GlassPanel className={cn(glassPanelStrongClass, 'rounded-3xl p-5')}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/60 bg-white/62 shadow-[0_12px_28px_rgba(37,99,235,0.14)]">
                <Settings className="h-5 w-5 text-sky-700" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">Settings</h1>
              </div>
            </div>
          </GlassPanel>

          <GlassToolbar className="rounded-2xl p-1.5">
            <nav className="flex flex-wrap gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'border border-white/65 bg-white/82 text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.14)]'
                        : 'border border-transparent text-slate-600 hover:border-white/50 hover:bg-white/56 hover:text-slate-900'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </GlassToolbar>

          <GlassPanel className="rounded-3xl p-4 md:p-5">
            {activeTab === 'llm' && <LlmTab />}
            {activeTab === 'env' && <EnvTab />}
            {activeTab === 'roadmap' && <RoadmapTab />}
          </GlassPanel>
        </div>
      </div>
    </GlassPage>
  );
}
