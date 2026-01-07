import { useEffect, useState } from 'react';
import { Folder, Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { api, Project } from '@/lib/api';
import { httpClient } from '@/lib/httpClient';
import { useRouter } from 'next/router';

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
  open: number;
  inProgress: number;
  completed: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectStats, setProjectStats] = useState<Record<number, ProjectStats>>({});
  const [projectProgress, setProjectProgress] = useState<Record<number, number>>({});
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await api.projects.list();
        const projectList = data.data || [];
        setProjects(projectList);
        setLoading(false);

        // Fetch stats and progress for each project
        if (projectList.length > 0) {
          const statsPromises = projectList.map(async (project: Project) => {
            try {
              const [progressData, tasksData] = await Promise.all([
                httpClient<any>(`/api/projects/${project.id}/progress`),
                httpClient<any>(`/api/projects/${project.id}/tasks`)
              ]);
              
              const tasks = tasksData.data || [];
              const stats: ProjectStats = {
                total: tasks.length,
                open: tasks.filter((t: any) => t.fields.status.value === 'open').length,
                inProgress: tasks.filter((t: any) => ['inprogress', 'stalled'].includes(t.fields.status.value)).length,
                completed: tasks.filter((t: any) => ['resolved', 'excluded'].includes(t.fields.status.value)).length
              };
              
              return {
                projectId: project.id,
                stats,
                progress: progressData.progressPercentage || 0
              };
            } catch (error) {
              return {
                projectId: project.id,
                stats: { total: 0, open: 0, inProgress: 0, completed: 0 },
                progress: 0
              };
            }
          });

          const results = await Promise.all(statsPromises);
          const newStats: Record<number, ProjectStats> = {};
          const newProgress: Record<number, number> = {};
          
          results.forEach(result => {
            newStats[result.projectId] = result.stats;
            newProgress[result.projectId] = result.progress;
          });
          
          setProjectStats(newStats);
          setProjectProgress(newProgress);
          setLoadingStats(false);
        }
      } catch (err) {
        setLoading(false);
        setLoadingStats(false);
      }
    }
    fetchProjects();
  }, []);

  if (loading) {
    return <div className="p-6">Loading projects...</div>;
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const colorKey = project.fields.color?.key || 'blue';
          const colorClass = colorMap[colorKey] || 'bg-blue-500';
          const stats = projectStats[project.id] || { total: 0, open: 0, inProgress: 0, completed: 0 };
          const progress = projectProgress[project.id] || 0;
          const memberCount = ((project as any).attachments?.members?.members || []).length;
          
          return (
            <div 
              key={project.id} 
              onClick={() => router.push(`/project/${project.id}`)}
              className="bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className={`h-2 ${colorClass}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-neutral-900">{project.fields.name}</h3>
                    <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{project.fields.description || 'No description'}</p>
                  </div>
                  <Folder className="h-5 w-5 text-neutral-400 flex-shrink-0 ml-2" />
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
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold text-neutral-900">{loadingStats ? '-' : stats.open}</p>
                        <p className="text-xs text-neutral-500">Open</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-neutral-900">{loadingStats ? '-' : stats.inProgress}</p>
                        <p className="text-xs text-neutral-500">Active</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-neutral-900">{loadingStats ? '-' : stats.completed}</p>
                        <p className="text-xs text-neutral-500">Done</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <Users className="h-4 w-4" />
                      <span>{memberCount} members</span>
                    </div>
                    <span className="text-xs text-neutral-500">{stats.total} tasks</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
