import { useState, useEffect } from 'react';
import { ExternalLink, AlertCircle, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { Dropdown } from '@/components/ui/dropdown';
import { httpClient } from '@/lib/httpClient';

interface UnstandardItem {
  type: 'task' | 'project' | 'milestone';
  id: string;
  name: string;
  url: string;
  reason?: string;
}

interface UnstandardResponse {
  tasks: UnstandardItem[];
  projects: UnstandardItem[];
  milestones: UnstandardItem[];
  total: number;
}

interface UnstandardWidgetProps {
  teamId?: string;
  onTaskClick?: (taskId: number) => void;
  onProjectClick?: (projectId: number) => void;
}

export function UnstandardWidget({ teamId = '16', onTaskClick, onProjectClick }: UnstandardWidgetProps) {
  const [data, setData] = useState<UnstandardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'task' | 'project' | 'milestone'>('project');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await httpClient<UnstandardResponse>('/api/unstandard', {
        params: { teamId },
      });
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load unstandard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const getItemsByType = () => {
    if (!data) return [];
    switch (activeTab) {
      case 'task':
        return data.tasks;
      case 'project':
        return data.projects;
      case 'milestone':
        return data.milestones;
      default:
        return [];
    }
  };


  const items = getItemsByType();

  return (
    <div className="bg-white border border-neutral-200 rounded-lg">
      <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <h3 className="text-base font-semibold text-neutral-900">Unstandard Items</h3>
        </div>
        <Dropdown
          options={[
            { value: 'project', label: 'Project' },
            { value: 'milestone', label: 'Milestone' },
            { value: 'task', label: 'Task' },
          ]}
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'task' | 'project' | 'milestone')}
          icon={Filter}
        />
      </div>

      {/* Content */}
      <div className="divide-y divide-neutral-200 h-[346px] overflow-y-auto">
        {loading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-neutral-500">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-neutral-500">No unstandard {activeTab}s found</p>
          </div>
        ) : (
          items.map((item) => {
            const shouldUsePanel = (item.type === 'task' && onTaskClick) || (item.type === 'project' && onProjectClick);

            const handleClick = () => {
              if (item.type === 'task' && onTaskClick) {
                onTaskClick(parseInt(item.id, 10));
              } else if (item.type === 'project' && onProjectClick) {
                onProjectClick(parseInt(item.id, 10));
              } else {
                // For milestone or when no handler, open in new tab
                window.open(item.url, '_blank');
              }
            };

            return (
              <div
                key={`${item.type}-${item.id}`}
                onClick={handleClick}
                className="block p-3 hover:bg-neutral-50 transition-colors group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 truncate">{item.name}</p>
                    {item.reason && (
                      <p className="text-xs text-neutral-500 mt-1">{item.reason}</p>
                    )}
                  </div>
                  {!shouldUsePanel && (
                    <ExternalLink className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
