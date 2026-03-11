import { useEffect, useMemo, useState } from 'react';
import { Folder, Users, Loader2, ChevronRight, Archive, ArchiveRestore } from 'lucide-react';
import { Project } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';
import { httpClient } from '@/lib/httpClient';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { appStorage } from '@/lib/appStorage';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlassSearchInput } from '@/components/ui/glass-search-input';
import { cn } from '@/lib/utils';
import { GlassIconButton, GlassPage, GlassPanel, GlassSection, glassPanelStrongClass } from '@/components/ui/glass';
import { toast } from '@/lib/toast';

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
  waiting: number;      // Not started: notbegin + spite
  inProgress: number;   // In progress: open + wontfix + stalled
  completed: number;    // Completed: resolved + excluded
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
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
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
    let filtered = projects.filter(p => !archivedProjectIds.has(p.id));
      
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.fields.name.toLowerCase().includes(query));
    }
    
    return filtered;
  }, [projects, archivedProjectIds, searchQuery]);

  const archivedProjects = useMemo(() => {
    const projectMap = new Map(projects.map((project) => [project.id, project] as const));
    return Array.from(archivedProjectIds)
      .sort((a, b) => b - a)
      .map((projectId) => ({ projectId, project: projectMap.get(projectId) }));
  }, [projects, archivedProjectIds]);

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
    toast.success(`Project P${projectId} archived`);
  };

  const unarchiveProject = (projectId: number) => {
    setArchivedProjectIds(prev => {
      if (!prev.has(projectId)) return prev;
      const next = new Set(prev);
      next.delete(projectId);
      return next;
    });
    toast.success(`Project P${projectId} restored from archive`);
  };

  return (
    <GlassPage showOrbs={false} className="h-full">
    <div className="h-full overflow-auto">
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col space-y-5 p-5">
      <GlassPanel className={cn(glassPanelStrongClass, 'rounded-3xl p-4 md:p-5')}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/55 bg-white/52 shadow-[0_12px_28px_rgba(37,99,235,0.14)] backdrop-blur-lg">
              <Folder className="h-4.5 w-4.5 text-sky-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">Projects</h1>
            </div>
          </div>
          <GlassSearchInput
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            containerClassName="w-full md:w-[460px] lg:w-[560px]"
            actions={
              <GlassIconButton
                onClick={() => setArchiveDialogOpen(true)}
                title="Archived Projects"
                tone="warning"
                className="relative"
                aria-label="Archived Projects"
              >
                <Archive className="h-3.5 w-3.5" />
                {archivedProjectIds.size > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] leading-4 text-center">
                    {archivedProjectIds.size > 99 ? '∞' : archivedProjectIds.size}
                  </span>
                )}
              </GlassIconButton>
            }
          />
        </div>
      </GlassPanel>

      {/* Loading Spinner */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/50" />
        </div>
      )}

      {/* Projects Grid */}
      {!loading && (
        <GlassSection className="flex-1 overflow-y-auto min-h-0 p-4 md:p-5">
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
                  className="glass-interactive group relative cursor-pointer overflow-hidden border border-white/58 border-t-4 bg-white/62 shadow-[0_12px_28px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50 transition-all duration-200 hover:border-sky-200/80 hover:bg-white/72"
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
                          archiveProject(project.id);
                        }}
                        className={cn(
                          "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity",
                          "text-muted-foreground hover:text-amber-700 hover:bg-amber-50"
                        )}
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
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
                Load more
              </Button>
            </div>
          )}

          {/* Empty State */}
          {displayedProjects.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground/50">
              <Folder className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No projects found</p>
            </div>
          )}
        </GlassSection>
      )}

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className={cn("max-w-3xl rounded-3xl border border-white/70 bg-[#f8fbff]/92 p-5 shadow-[0_28px_66px_rgba(15,23,42,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78")}>
          <DialogHeader className="pb-1">
            <DialogTitle className="text-slate-900">Archived Projects ({archivedProjectIds.size})</DialogTitle>
          </DialogHeader>
          {archivedProjects.length === 0 ? (
            <GlassSection className="glass-interactive border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
              No archived projects.
            </GlassSection>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-2xl border border-white/70 bg-white/48 p-2.5 backdrop-blur-xl supports-[backdrop-filter]:bg-white/34">
              <div className="space-y-2.5 pr-1">
                {archivedProjects.map(({ projectId, project }) => (
                  <div
                    key={`archived-project-${projectId}`}
                    className="glass-interactive flex items-center justify-between gap-3 rounded-2xl border border-white/58 bg-white/62 px-3.5 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {project?.fields.name || `Project #${projectId}`}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        P{projectId}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => unarchiveProject(projectId)}
                      className="h-8 rounded-xl border border-amber-200/80 bg-white/70 px-3 text-xs text-amber-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800"
                    >
                      <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Project Detail Modal */}
      <Dialog open={!!selectedProject && isProjectModalOpen} onOpenChange={(open) => !open && handleCloseProjectModal()}>
        <DialogContent showCloseButton={false} className="h-[88vh] max-w-[calc(100%-2rem)] sm:max-w-6xl rounded-3xl border border-white/70 bg-[#f8fbff]/92 p-0 shadow-[0_30px_70px_rgba(15,23,42,0.22)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#f8fbff]/78 flex flex-col gap-0 overflow-hidden">
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
    </div>
    </GlassPage>
  );
}
