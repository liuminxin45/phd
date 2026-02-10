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
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function LandingView({ onNavigate, techPosts, reportPosts, loading }: {
  onNavigate: (view: 'tech' | 'report') => void;
  techPosts: ApiBlogPost[];
  reportPosts: ApiBlogPost[];
  loading: boolean;
}) {
  const latestReport = reportPosts[0];
  const latestTech = techPosts[0];

  return (
    <div className="space-y-8 py-4">
      {/* Hero */}
      <section className="text-center py-10 max-w-2xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
          Phabricator Blog
        </h1>
        <p className="text-base text-muted-foreground">
          选择你的阅读方向 — 跟进团队进度，或深度探索技术实践。
        </p>
      </section>

      {/* Dual Entry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto px-4">
        {/* Entry 1: 周报 */}
        <Card
          onClick={() => onNavigate('report')}
          className="group cursor-pointer border-t-4 border-t-blue-500 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
        >
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <ClipboardList className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground group-hover:text-blue-600 transition-colors">周报</h2>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Weekly Report</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed h-10">
              快速了解团队进度、本周计划与当前阻塞。以时间线驱动，聚焦执行与协作。
            </p>
            
            <div className="bg-muted/30 rounded-xl p-5 mb-8 space-y-3 group-hover:bg-blue-50/50 transition-colors">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>加载中...</span>
                </div>
              ) : latestReport ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>最近一期：{formatEpoch(latestReport.datePublished || latestReport.dateCreated)}（{getWeekday(latestReport.datePublished || latestReport.dateCreated)}）</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-1">{latestReport.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span>{reportPosts.length} 篇周报</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">暂无周报</div>
              )}
            </div>
            
            <Button className="w-full group-hover:bg-blue-600 group-hover:text-white transition-colors" variant="secondary">
              查看周报
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>

        {/* Entry 2: 技术博客 */}
        <Card
          onClick={() => onNavigate('tech')}
          className="group cursor-pointer border-t-4 border-t-primary hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
        >
          <CardContent className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                <Newspaper className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">技术博客</h2>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tech Blog</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed h-10">
              技术实践、架构设计与经验沉淀。深度文章，记录工程团队的思考与方法论。
            </p>
            
            <div className="bg-muted/30 rounded-xl p-5 mb-8 space-y-3 group-hover:bg-primary/5 transition-colors">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>加载中...</span>
                </div>
              ) : latestTech ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span className="line-clamp-1">最新: {latestTech.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{latestTech.authorName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    <span>{techPosts.length} 篇已发布文章</span>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground">暂无技术博客</div>
              )}
            </div>
            
            <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors" variant="secondary">
              进入技术博客
              <ChevronRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
