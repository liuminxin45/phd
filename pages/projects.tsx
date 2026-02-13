import { useEffect, useMemo, useState } from 'react';
import { Folder, Users, Loader2, ChevronRight, Archive, ArchiveRestore, Search, X } from 'lucide-react';
import { Project } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';
import { httpClient } from '@/lib/httpClient';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { appStorage } from '@/lib/appStorage';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  teal: 'bg-teal-500',
  red: 'bg-red-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
  grey: 'bg-slate-500',
  violet: 'bg-violet-500',
  yellow: 'bg-yellow-500',
};

interface ProjectStats {
  total: number;
  waiting: number;      // 未开始: notbegin + spite
  inProgress: number;   // 进行中: open + wontfix + stalled 等
  completed: number;    // 已完成: resolved + excluded
}

const PAGE_SIZE = 100;
const STORAGE_KEY_PROJECT_ARCHIVE_IDS = 'archive.projects.ids.v1';

export default function ProjectsPage() {
  const { user } = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectStats, setProjectStats] = useState<Record<number, ProjectStats>>({});
  const [projectProgress, setProjectProgress] = useState<Record<number, number>>({});
  const [projectMembers, setProjectMembers] = useState<Record<number, number>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Project detail modal
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  const [archivedProjectIds, setArchivedProjectIds] = useState<Set<number>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [archiveStateLoaded, setArchiveStateLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await appStorage.get<number[]>(STORAGE_KEY_PROJECT_ARCHIVE_IDS);
      if (!cancelled && Array.isArray(stored)) {
        setArchivedProjectIds(new Set(stored));
      }
      if (!cancelled) {
        setArchiveStateLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (archiveStateLoaded) {
      void appStorage.set(STORAGE_KEY_PROJECT_ARCHIVE_IDS, [...archivedProjectIds]);
    }
  }, [archivedProjectIds, archiveStateLoaded]);

  const displayedProjects = useMemo(() => {
    let filtered = showArchived
      ? projects.filter(p => archivedProjectIds.has(p.id))
      : projects.filter(p => !archivedProjectIds.has(p.id));
      
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.fields.name.toLowerCase().includes(query));
    }
    
    return filtered;
  }, [projects, archivedProjectIds, showArchived, searchQuery]);

  // Fetch projects for current user
  const fetchProjects = async (page: number = 1, append: boolean = false) => {
    if (!user) return;
    
    // Only show full loading spinner on first page, not when appending
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setLoadingStats(true);
    
    try {
      // Fetch projects for current user
      const response = await httpClient<{ data: Project[]; cursor?: { after?: string } }>(
        `/api/projects?members=${user.phid}&queryKey=active&limit=${PAGE_SIZE}${afterCursor && page > 1 ? `&after=${afterCursor}` : ''}`
      );
      
      const projectList = response.data || [];
      const cursor = response.cursor?.after || null;
      
      if (append) {
        setProjects(prev => [...prev, ...projectList]);
      } else {
        setProjects(projectList);
      }
      
      setAfterCursor(cursor);
      setHasMore(!!cursor);
      setCurrentPage(page);
      setLoading(false);
      setLoadingMore(false);

      // Fetch additional data for each project
      if (projectList.length > 0) {
        const newProgress: Record<number, number> = {};
        const newStats: Record<number, ProjectStats> = {};
        const newMembers: Record<number, number> = {};
        
        // Fetch all data in parallel for each project
        const dataPromises = projectList.map(async (project: Project) => {
          // Fetch progress
          try {
            const progressData = await httpClient<{ progressPercentage: number }>(`/api/projects/${project.id}/progress`);
            newProgress[project.id] = progressData.progressPercentage || 0;
          } catch {
            newProgress[project.id] = 0;
          }
          
          // Fetch task stats
          try {
            const tasksData = await httpClient<{ data: any[] }>(`/api/projects/${project.id}/tasks`);
            const tasks = tasksData.data || [];
            
            newStats[project.id] = {
              total: tasks.length,
              waiting: tasks.filter((t: any) => ['notbegin', 'spite'].includes(t.fields?.status?.value)).length,
              inProgress: tasks.filter((t: any) => ['open', 'wontfix', 'stalled', 'inprogress'].includes(t.fields?.status?.value)).length,
              completed: tasks.filter((t: any) => ['resolved', 'excluded'].includes(t.fields?.status?.value)).length
            };
          } catch {
            newStats[project.id] = { total: 0, waiting: 0, inProgress: 0, completed: 0 };
          }
          
          // Fetch members count from project details
          try {
            const detailData = await httpClient<{ data: any[] }>(`/api/projects/${project.id}`);
            const projectData = detailData.data?.[0];
            const members = projectData?.attachments?.members?.members || [];
            newMembers[project.id] = members.length;
          } catch {
            newMembers[project.id] = 0;
          }
        });
        
        await Promise.all(dataPromises);
        
        if (append) {
          setProjectProgress(prev => ({ ...prev, ...newProgress }));
          setProjectStats(prev => ({ ...prev, ...newStats }));
          setProjectMembers(prev => ({ ...prev, ...newMembers }));
        } else {
          setProjectProgress(newProgress);
          setProjectStats(newStats);
          setProjectMembers(newMembers);
        }
        
        setLoadingStats(false);
      } else {
        setLoadingStats(false);
      }
    } catch (err) {
      setLoading(false);
      setLoadingMore(false);
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    
    setCurrentPage(1);
    setAfterCursor(null);
    fetchProjects(1, false);
  }, [user]);

  const handleProjectClick = (project: Project) => {
    setSelectedProject(project);
    setIsProjectModalOpen(true);
  };

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false);
    setSelectedProject(null);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading && !loadingMore) {
      fetchProjects(currentPage + 1, true);
    }
  };

  const archiveProject = (projectId: number) => {
    setArchivedProjectIds(prev => {
      if (prev.has(projectId)) return prev;
      const next = new Set(prev);
      next.add(projectId);
      return next;
    });
  };

  const unarchiveProject = (projectId: number) => {
    setArchivedProjectIds(prev => {
      if (!prev.has(projectId)) return prev;
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6 h-full flex flex-col overflow-hidden">
      {/* Loading Spinner */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        </div>
      )}

      {/* Projects Grid */}
      {!loading && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="mb-6 flex items-center justify-between">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="搜索项目..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "h-9 gap-1.5",
                showArchived ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-muted-foreground"
              )}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? '显示活跃项目' : `已归档 (${archivedProjectIds.size})`}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-6">
            {displayedProjects.map((project) => {
              const colorKey = project.fields.color?.key || 'blue';
              const colorClass = colorMap[colorKey] || 'bg-blue-500';
              const stats = projectStats[project.id] || { total: 0, waiting: 0, inProgress: 0, completed: 0 };
              const progress = projectProgress[project.id] || 0;
              const memberCount = projectMembers[project.id] || 0;
          
              return (
                <Card 
                  key={project.id} 
                  onClick={() => handleProjectClick(project)}
                  className="group relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border-t-4"
                  style={{ borderTopColor: 'transparent' }} // Reset to allow the color class to take effect if we applied it directly, but let's use a div instead
                >
                  <div className={cn("absolute top-0 left-0 right-0 h-1", colorClass)} />
                  
                  <CardContent className="p-5 pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0 pr-2">
                        <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {project.fields.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5em]">
                          {project.fields.description || 'No description provided'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showArchived) {
                            unarchiveProject(project.id);
                          } else {
                            archiveProject(project.id);
                          }
                        }}
                        className={cn(
                          "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity",
                          showArchived ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-muted-foreground hover:text-foreground"
                        )}
                        title={showArchived ? '取消归档' : '归档'}
                      >
                        {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium text-foreground">{loadingStats ? '...' : `${progress}%`}</span>
                        </div>
                        <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className={cn("h-full transition-all duration-500 ease-out", colorClass)}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-4 border-t text-center">
                        <div className="space-y-0.5">
                          <p className="text-lg font-semibold text-foreground leading-none">{loadingStats ? '-' : stats.total}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-lg font-semibold text-amber-600 leading-none">{loadingStats ? '-' : stats.waiting}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Wait</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-lg font-semibold text-blue-600 leading-none">{loadingStats ? '-' : stats.inProgress}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">WIP</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-lg font-semibold text-green-600 leading-none">{loadingStats ? '-' : stats.completed}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Done</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>{memberCount} members</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full max-w-xs"
              >
                {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                加载更多
              </Button>
            </div>
          )}

          {/* Empty State */}
          {displayedProjects.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
              <Folder className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">没有找到项目</p>
            </div>
          )}
        </div>
      )}

      {/* Project Detail Modal */}
      <Dialog open={!!selectedProject && isProjectModalOpen} onOpenChange={(open) => !open && handleCloseProjectModal()}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-5xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
          {selectedProject && (
            <ProjectDetailPanel 
              project={selectedProject} 
              isModal={true}
              onClose={handleCloseProjectModal}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
