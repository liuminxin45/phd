import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Project } from '@/lib/api';
import { httpClient } from '@/lib/httpClient';
import { ProjectDetailPanel } from '@/components/project/ProjectDetailPanel';

export default function ProjectPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchProject = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await httpClient<{ data: Project[] }>(`/api/projects/${id}`);
        if (data.data && data.data.length > 0) {
          setProject(data.data[0]);
        } else {
          setError('项目未找到');
        }
      } catch (err: any) {
        setError(err.message || '加载项目失败');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [id]);

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-neutral-600">加载项目中...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600 mb-4">{error || '项目未找到'}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-neutral-900">{project.fields.name}</h1>
              <p className="text-sm text-neutral-500 mt-1">#{project.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto py-6 h-[calc(100vh-88px)]">
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 h-full">
          <ProjectDetailPanel project={project} isModal={false} />
        </div>
      </div>
    </div>
  );
}
