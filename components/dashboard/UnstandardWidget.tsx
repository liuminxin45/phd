import { useState, useEffect, useCallback } from 'react';
import { ExternalLink, AlertCircle, AlertTriangle } from 'lucide-react';
import { httpClient } from '@/lib/httpClient';
import { useUser } from '@/contexts/UserContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { UnstandardItem, UnstandardResponse } from '@/pages/api/unstandard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent className="max-w-[500px] max-h-[80vh] overflow-y-auto">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  你有 {alertItems.length} 个不规范项目/节点
                </AlertDialogTitle>
                <AlertDialogDescription>
                  以下是你负责的不规范项目和节点，请及时处理：
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <div className="space-y-2 mt-4 mb-4">
                {alertItems.map((item, index) => (
                  <div 
                    key={`${item.type}-${item.id}`}
                    className="p-3 bg-amber-50 border border-amber-200 rounded-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50">
                            {item.type === 'project' ? '项目' : '节点'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-amber-900 truncate">{item.name}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>我知道了</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="overflow-hidden">
        <div className="border-b p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold leading-none">Unstandard</h3>
          </div>
          
          <div className="flex gap-1 rounded-md bg-muted p-1">
            <button
              onClick={() => setActiveTab('project')}
              className={cn(
                "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                activeTab === 'project'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              Projects ({myProjects.length})
            </button>
            <button
              onClick={() => setActiveTab('milestone')}
              className={cn(
                "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                activeTab === 'milestone'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
            >
              Milestones ({myMilestones.length})
            </button>
          </div>
        </div>

        <CardContent className="p-0 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
              <AlertCircle className="mb-2 h-10 w-10 opacity-20" />
              <p className="text-sm">No unstandard items</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => {
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
                    className="group flex cursor-pointer items-start justify-between gap-3 p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        {item.name}
                      </p>
                      {item.reason && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.reason}
                        </p>
                      )}
                    </div>
                    {!shouldUsePanel && (
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
