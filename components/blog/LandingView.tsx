import {
  Calendar,
  FileText,
  BookOpen,
  Star,
  User,
  ChevronRight,
  ClipboardList,
  Newspaper,
  Loader2,
} from 'lucide-react';
import type { ApiBlogPost } from '@/lib/blog/types';
import { formatEpoch, getWeekday } from '@/lib/blog/helpers';

export function LandingView({ onNavigate, techPosts, reportPosts, loading }: {
  onNavigate: (view: 'tech' | 'report') => void;
  techPosts: ApiBlogPost[];
  reportPosts: ApiBlogPost[];
  loading: boolean;
}) {
  const latestReport = reportPosts[0];
  const latestTech = techPosts[0];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="text-center py-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Phabricator Blog</h1>
        <p className="text-sm text-neutral-500 max-w-md mx-auto">
          选择你的阅读方向 — 跟进团队进度，或深度探索技术实践。
        </p>
      </section>

      {/* Dual Entry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {/* Entry 1: 周报 */}
        <div
          onClick={() => onNavigate('report')}
          className="group bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="h-2 bg-blue-500" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">周报</h2>
                <p className="text-xs text-neutral-500">Report</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-5">
              快速了解团队进度、本周计划与当前阻塞。以时间线驱动，聚焦执行与协作。
            </p>
            <div className="bg-neutral-50 rounded-lg p-4 mb-5 space-y-2.5">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>加载中...</span>
                </div>
              ) : latestReport ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Calendar className="h-3.5 w-3.5 text-neutral-400" />
                    <span>最近一期：{formatEpoch(latestReport.datePublished || latestReport.dateCreated)}（{getWeekday(latestReport.datePublished || latestReport.dateCreated)}）</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <FileText className="h-3.5 w-3.5 text-neutral-400" />
                    <span className="line-clamp-1">{latestReport.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <BookOpen className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{reportPosts.length} 篇周报</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-neutral-400">暂无周报</div>
              )}
            </div>
            <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
              查看周报
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Entry 2: 技术博客 */}
        <div
          onClick={() => onNavigate('tech')}
          className="group bg-white border border-neutral-200 rounded-lg overflow-hidden hover:shadow-lg transition-all cursor-pointer"
        >
          <div className="h-2 bg-neutral-900" />
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                <Newspaper className="h-5 w-5 text-neutral-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">技术博客</h2>
                <p className="text-xs text-neutral-500">Tech Blog</p>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-5">
              技术实践、架构设计与经验沉淀。深度文章，记录工程团队的思考与方法论。
            </p>
            <div className="bg-neutral-50 rounded-lg p-4 mb-5 space-y-2.5">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>加载中...</span>
                </div>
              ) : latestTech ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Star className="h-3.5 w-3.5 text-amber-500" />
                    <span className="line-clamp-1">最新: {latestTech.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <User className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{latestTech.authorName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <BookOpen className="h-3.5 w-3.5 text-neutral-400" />
                    <span>{techPosts.length} 篇已发布文章</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-neutral-400">暂无技术博客</div>
              )}
            </div>
            <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 rounded-lg group-hover:bg-neutral-200 transition-colors">
              进入技术博客
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
