import { useEffect, useMemo, useState } from 'react';
import { Folder, Users, Loader2, ChevronRight, Archive, ArchiveRestore } from 'lucide-react';
import { Project } from '@/lib/api';
import { useUser } from '@/contexts/UserContext';
import { httpClient } from '@/lib/httpClient';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';
import { appStorage } from '@/lib/appStorage';

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  teal: 'bg-teal-500',
  red: 'bg-red-500',
  pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
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
    return showArchived
      ? projects.filter(p => archivedProjectIds.has(p.id))
      : projects.filter(p => !archivedProjectIds.has(p.id));
  }, [projects, archivedProjectIds, showArchived]);

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
    <div className="p-6">
      {/* Loading Spinner */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      )}

      {/* Projects Grid */}
      {!loading && (
        <>
          <div className="mb-4 flex items-center justify-end">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-1 text-sm ${
                showArchived ? 'text-amber-600' : 'text-neutral-500 hover:text-neutral-700'
              }`}
              title={showArchived ? '显示活跃项目' : '显示已归档项目'}
            >
              <Archive className="h-4 w-4" />
              {showArchived ? '显示活跃项目' : `已归档 (${archivedProjectIds.size})`}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedProjects.map((project) => {
              const colorKey = project.fields.color?.key || 'blue';
              const colorClass = colorMap[colorKey] || 'bg-blue-500';
              const stats = projectStats[project.id] || { total: 0, waiting: 0, inProgress: 0, completed: 0 };
              const progress = projectProgress[project.id] || 0;
              const memberCount = projectMembers[project.id] || 0;
          
              return (
                <div 
                  key={project.id} 
                  onClick={() => handleProjectClick(project)}
                  className="bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className={`h-2 ${colorClass}`} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-neutral-900">{project.fields.name}</h3>
                        <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{project.fields.description || 'No description'}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (showArchived) {
                            unarchiveProject(project.id);
                          } else {
                            archiveProject(project.id);
                          }
                        }}
                        className={`p-1 rounded hover:bg-neutral-100 transition-colors flex-shrink-0 ml-2 ${
                          showArchived ? 'text-amber-600' : 'text-neutral-400 hover:text-neutral-600'
                        }`}
                        title={showArchived ? '取消归档' : '归档'}
                      >
                        {showArchived ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    <div className="space-y-3 mt-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-700">Progress</span>
                          <span className="text-neutral-900 font-medium">{loadingStats ? '...' : `${progress}%`}</span>
                        </div>
                        <div className="h-2 w-full bg-neutral-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-neutral-900 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-neutral-200">
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div>
                            <p className="text-lg font-semibold text-neutral-900">{loadingStats ? '-' : stats.total}</p>
                            <p className="text-xs text-neutral-500">总任务</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-amber-600">{loadingStats ? '-' : stats.waiting}</p>
                            <p className="text-xs text-neutral-500">未开始</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-blue-600">{loadingStats ? '-' : stats.inProgress}</p>
                            <p className="text-xs text-neutral-500">进行中</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-green-600">{loadingStats ? '-' : stats.completed}</p>
                            <p className="text-xs text-neutral-500">已完成</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-neutral-200 flex items-center">
                        <div className="flex items-center gap-2 text-sm text-neutral-600">
                          <Users className="h-4 w-4" />
                          <span>{memberCount} members</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                加载更多
              </button>
            </div>
          )}

          {/* Empty State */}
          {displayedProjects.length === 0 && (
            <div className="text-center py-12">
              <p className="text-neutral-500">没有找到项目</p>
            </div>
          )}
        </>
      )}

      {/* Project Detail Modal */}
      {selectedProject && isProjectModalOpen && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          style={{ margin: 0, padding: 0 }}
          onClick={handleCloseProjectModal}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ProjectDetailPanel 
              project={selectedProject} 
              isModal={true}
              onClose={handleCloseProjectModal}
              defaultFullscreen={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
