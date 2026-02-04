import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, AlertCircle, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { httpClient } from '@/lib/httpClient';
import { useUser } from '@/contexts/UserContext';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { UnstandardItem, UnstandardResponse } from '@/pages/api/unstandard';

interface UnstandardWidgetProps {
  teamId?: string;
  onTaskClick?: (taskId: number) => void;
  onProjectClick?: (projectId: number) => void;
}

export function UnstandardWidget({ teamId = '16', onTaskClick, onProjectClick }: UnstandardWidgetProps) {
  const { user } = useUser();
  const [myProjects, setMyProjects] = useState<UnstandardItem[]>([]);
  const [myMilestones, setMyMilestones] = useState<UnstandardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'project' | 'milestone'>('project');
  const [showAlert, setShowAlert] = useState(false);
  const [alertItems, setAlertItems] = useState<UnstandardItem[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await httpClient<UnstandardResponse>('/api/unstandard', {
        params: { teamId },
      });
      
      if (user?.realName) {
        const userName = user.realName;
        
        const userProjects = result.projects.filter(project => 
          project.owner && project.owner.includes(userName)
        );
        setMyProjects(userProjects);
        
        const userMilestones = result.milestones.filter(milestone => 
          milestone.owner && milestone.owner.includes(userName)
        );
        setMyMilestones(userMilestones);
        
        const alertItems = [...userProjects, ...userMilestones];
        if (alertItems.length > 0) {
          setAlertItems(alertItems);
          setShowAlert(true);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load unstandard data');
    } finally {
      setLoading(false);
    }
  }, [teamId, user?.realName]);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 minutes
    const intervalId = setInterval(() => {
      fetchData();
    }, 30 * 60 * 1000); // 30 minutes in milliseconds
    
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const getItemsByType = () => {
    switch (activeTab) {
      case 'project':
        return myProjects;
      case 'milestone':
        return myMilestones;
      default:
        return [];
    }
  };

  const items = getItemsByType();

  return (
    <>
      <AlertDialog.Root open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-[9999]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-white rounded-lg shadow-xl p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-start gap-4 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <AlertDialog.Title className="text-lg font-semibold text-neutral-900 mb-2">
                  你有 {alertItems.length} 个不规范项目/节点
                </AlertDialog.Title>
                <AlertDialog.Description className="text-sm text-neutral-600 mb-4">
                  以下是你负责的不规范项目和节点，请及时处理：
                </AlertDialog.Description>
                <div className="space-y-2 mb-4">
                  {alertItems.map((item, index) => (
                    <div 
                      key={`${item.type}-${item.id}`}
                      className="p-3 bg-amber-50 border border-amber-200 rounded-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-amber-700 uppercase">
                              {item.type === 'project' ? '项目不规范' : '节点不规范'}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-900 font-medium">{item.name}</p>
                        </div>
                        <button
                          onClick={() => window.open(item.url, '_blank')}
                          className="text-amber-600 hover:text-amber-700 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors">
                  我知道了
                </button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <div className="bg-white border border-neutral-200 rounded-lg">
        <div className="p-4 border-b border-neutral-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-base font-semibold text-neutral-900">Unstandard</h3>
          </div>
          
          <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('project')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'project'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Projects ({myProjects.length})
            </button>
            <button
              onClick={() => setActiveTab('milestone')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'milestone'
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Milestones ({myMilestones.length})
            </button>
          </div>
        </div>

      <div className="divide-y divide-neutral-200 max-h-[400px] overflow-y-auto">
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
            <p className="text-sm text-neutral-500">No unstandard items</p>
          </div>
        ) : (
          items.map((item) => {
            const shouldUsePanel = item.type === 'project' && onProjectClick;

            const handleClick = () => {
              if (item.type === 'project' && onProjectClick) {
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
    </>
  );
}
